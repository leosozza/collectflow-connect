
Objetivo

Corrigir a orquestração dos disparos para seguir a regra certa de operação: não-oficial com ritmo conservador e rotação segura, oficial separado, sem concorrência duplicando envios.

Diagnóstico do que encontrei

- O anti-ban básico já existe em `supabase/functions/send-bulk-whatsapp/index.ts`:
  - delay aleatório de 8–15s
  - descanso de 2 min a cada 15 mensagens
- Então o problema não é “falta total de delay”.
- Os pontos que hoje quebram o desenho planejado são:
  1. `provider_category` e `supports_campaign_rotation` existem, mas quase não participam da execução.
  2. O sistema ainda aceita cenário `mixed`, mesmo com oficial e não-oficial exigindo políticas diferentes.
  3. A função busca recipients com `status = "pending"` direto, sem claim/lock atômico. Se houver duas invocações da mesma campanha, pode haver sobreposição.
  4. O loop atual é global; ele não controla a fila por instância.
  5. O fluxo legado (`client_ids`) ainda bypassa a política principal e usa delay de 100ms.

Plano de implementação

1. Separar oficialmente “oficial” de “não-oficial”
- Bloquear campanha mista no frontend e no backend.
- Se a seleção tiver instâncias dos dois tipos, impedir início e orientar a criar campanhas separadas.
- Usar `provider_category` como regra real de execução, não só metadata.

2. Colocar trava real de processamento
- Adicionar lock de campanha para impedir duas execuções simultâneas da mesma campanha.
- Adicionar claim/lease dos recipients para que cada worker pegue somente seu lote.
- Expirar locks antigos para retomada segura em caso de queda/interrupção.

3. Mudar o processamento do não-oficial para fila por instância
- Agrupar recipients por `assigned_instance_id`.
- Controlar cooldown, contador e descanso por instância.
- Manter a política conservadora atual para não-oficial, mas aplicada da forma correta e previsível.

4. Dar fluxo próprio para oficial
- Oficial não vai herdar automaticamente a mesma heurística do não-oficial.
- O orquestrador vai escolher a estratégia pelo tipo da campanha/provedor.
- O motor de envio continua separado; o ajuste principal fica na camada de orquestração.

5. Fechar os bypasses
- O fluxo legado não poderá mais servir como “bulk rápido”.
- Se houver mais de 1 destinatário, ele deve entrar na mesma política segura de campanha, ou ser bloqueado/redirecionado.

6. Ajustar a criação/distribuição da campanha
- Revisar a distribuição round-robin para ela respeitar a estratégia de rotação permitida.
- Passar a usar `supports_campaign_rotation` de verdade.
- Evitar comportamento implícito que hoje parece “disparo sem controle”.

7. Melhorar feedback operacional
- Exibir no UI quando a campanha estiver em modo protegido de não-oficial.
- Informar quando houver lock ativo (“campanha já em processamento”).
- Refletir descanso/andamento real para o operador entender o ritmo do envio.

Validação que vou fazer depois da implementação

- Tentativa com campanha mista: deve ser bloqueada.
- Tentativa dupla da mesma campanha: a segunda deve ser recusada/ignorada.
- Campanha não-oficial com múltiplas instâncias: deve respeitar fila e cooldown por instância.
- Fluxo legado com múltiplos contatos: não pode mais furar a política de segurança.

Arquivos principais

- `supabase/functions/send-bulk-whatsapp/index.ts`
- `src/services/whatsappCampaignService.ts`
- `src/components/carteira/WhatsAppBulkDialog.tsx`
- migration SQL para `whatsapp_campaigns` e `whatsapp_campaign_recipients`

Detalhes técnicos

- Vou reaproveitar a estrutura já existente (`provider_category`, `supports_campaign_rotation`) em vez de criar outra convenção.
- A proteção principal ficará no backend, para não depender do comportamento do frontend.
- Não vou misturar a lógica do não-oficial com a do oficial; serão políticas distintas de execução.

Resultado esperado

- O não-oficial passa a disparar no ritmo correto, sem rajadas e sem risco por concorrência acidental.
- Oficial e não-oficial deixam de compartilhar a mesma regra operacional.
- Campanhas mistas deixam de acontecer.
- O comportamento real do disparo passa a bater com o que foi planejado.
