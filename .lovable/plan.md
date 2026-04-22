
## Plano: corrigir a falsa “pausa” da campanha e parar o watchdog de ficar ressuscitando campanhas antigas

### O que está acontecendo agora

A campanha `Disparo carteira 10:32` **não está parada de verdade neste momento**. No banco ela continua em `sending`, com `last_chunk_at` recente e os contadores subindo (já passou de 71/6 para 80/7 depois do print). O problema é duplo:

1. **A UI fica presa no estado “pausado pelo limite de execução”**
   - `send-bulk-whatsapp` grava `progress_metadata.timed_out = true` quando um ciclo bate no limite.
   - Quando o próximo worker retoma, `updateCheckpoint()` **não limpa esse flag**.
   - Resultado: o banner continua dizendo “pausado”, mesmo com envio retomado.

2. **Os cards do resumo ficam com números antigos**
   - `CampaignSummaryTab` só atualiza ao vivo `status` + `progress_metadata`.
   - Os KPIs (`sent_count`, `failed_count`) continuam vindo do objeto `campaign` carregado uma vez em `CampaignDetailView`.
   - Resultado: a tela mostra 71/6 enquanto o banco já está em 80/7.

3. **O watchdog está gastando energia com campanhas antigas que nunca foram encerradas**
   - Hoje há várias campanhas antigas ainda marcadas como `sending`, com `last_chunk_at` de dias atrás e pendências residuais.
   - O `dispatch-scheduled-campaigns` tenta reativá-las a cada minuto, poluindo o watchdog e confundindo o diagnóstico operacional.

### Correção proposta

#### 1. Fazer a UI refletir o estado real da campanha em tempo quase real

Em `CampaignDetailView.tsx`:
- adicionar polling do detalhe completo da campanha enquanto `status === "sending"` (ex.: a cada 5s);
- passar a versão atualizada do objeto `campaign` para `CampaignSummaryTab`.

Em `CampaignSummaryTab.tsx`:
- usar os contadores live (`sent_count`, `failed_count`, `delivered_count`, `updated_at`, `progress_metadata`) da consulta mais recente;
- recalcular cards, badge de status e métricas a partir da campanha live, não do snapshot inicial;
- exibir banner de timeout **só se realmente estiver sem progresso recente**.

#### 2. Limpar o estado de “timeout” assim que um novo worker reassume

Em `supabase/functions/send-bulk-whatsapp/index.ts`:
- ao adquirir lock com sucesso, limpar flags transitórias do `progress_metadata`, como:
  - `timed_out`
  - `batch_resting`
  - `resting_instance`
- no `updateCheckpoint()`, gravar explicitamente que a campanha voltou a processar, por exemplo:
  - `timed_out: false`
  - `batch_resting: false`
  - `resumed_at`
  - `worker_id`
- no final da campanha, garantir que o `progress_metadata` final não carregue restos de ciclo anterior.

Isso faz o banner sair automaticamente quando a campanha já retomou.

#### 3. Melhorar a lógica visual do banner “Disparo pausado”

Hoje o banner depende muito de `timed_out`. Vou ajustar para priorizar o comportamento real:
- se `status === sending` e `last_chunk_at` é recente: mostrar “Em envio / retomado automaticamente”, não “pausado”;
- se está em pausa anti-ban: mostrar o painel de pausa anti-ban;
- se `timed_out === true` **e** o tempo sem progresso passou do limiar: mostrar banner de retomada manual;
- se o watchdog já retomou e o progresso voltou a andar: esconder o banner de pausa.

#### 4. Encerrar campanhas antigas órfãs para limpar o watchdog

Há 13 campanhas antigas em `sending` com `last_chunk_at` de dias atrás. Vou fazer um cleanup controlado:
- identificar campanhas `sending` com:
  - `pending = 0` e `processing = 0` → marcar como `completed` / `completed_with_errors`;
  - `pending > 0` mas claramente órfãs/antigas → avaliar caso a caso e retomar ou encerrar corretamente;
- evitar que o `dispatch-scheduled-campaigns` fique reinvocando lixo histórico todo minuto.

Isso melhora a confiabilidade do watchdog para as campanhas realmente ativas.

#### 5. Validação específica da campanha da Bárbara

Após aplicar:
1. Abrir `Disparo carteira 10:32`.
2. Confirmar que:
   - banner de “pausado” some quando houver novo progresso;
   - cards passam a refletir o número real enviado/falhado sem precisar recarregar a página;
   - ao bater novo ciclo de execução, a campanha entra em retomada automática sem ficar “travada visualmente”.
3. Acompanhar logs do dispatcher e da função de envio para garantir que:
   - há novo worker assumindo;
   - o `last_chunk_at` avança;
   - o watchdog não fica preso reprocessando campanhas históricas inúteis.

### Arquivos a alterar

- `src/components/contact-center/whatsapp/campaigns/CampaignDetailView.tsx`
- `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx`
- `supabase/functions/send-bulk-whatsapp/index.ts`
- migration SQL para cleanup/normalização das campanhas antigas em `sending`

### Resultado esperado

- A campanha pode continuar trabalhando em ciclos, respeitando os delays anti-ban, **sem parecer pausada quando já retomou**.
- O admin vê os números reais subindo na tela.
- O botão “Retomar agora” só aparece quando houver travamento de verdade.
- O watchdog deixa de desperdiçar tentativas com campanhas velhas penduradas.

### Fora de escopo

- Alterar o ritmo anti-ban (8–15s e pausas por lote continuam iguais).
- Reescrever o motor de envio em outro modelo.
- Mudar regras de distribuição por instância.
