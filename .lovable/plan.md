## Análise Final + Próxima Correção

### O que validei (10 verificações cruzadas no banco)

| Check | Resultado |
|---|---|
| `paid_count` da `agreements` bate com soma real de parcelas pagas | ✅ **0 divergências** |
| Acordos ativos sem parcelas geradas | ✅ **0** |
| Parcelas órfãs (sem acordo) | ✅ **0** |
| Manual payments confirmados sem casar com SSOT | ✅ Só **1** (caso TESS já documentado) |
| Status mismatch entre carteira legacy e SSOT | ✅ **0** após sync |
| Auditoria SSOT diária funcionando | ✅ Cron 03:00 BRT estável |

**Conclusão**: SSOT está íntegro, recebimentos batem, lógica de pagamento parcial preserva dívida em aberto. Migração foi bem-sucedida.

### 2 problemas reais encontrados

**🔴 #1 — CRÍTICO: `maxlist-import` está perdendo dados em silêncio**

Nos logs do import recente vi:
```
Chunk upsert error: invalid input value for enum client_status: "cancelado_maxlist"
```

A edge function `maxlist-import` (linhas 357–359, 525, 591, 690) gera o valor `cancelado_maxlist` quando o registro vem com `cancellation_date` da MaxList, mas o enum `client_status` no banco só aceita: `pendente, pago, quebrado, vencido, em_acordo`. **Resultado: chunks inteiros falham e os clientes cancelados na MaxList não são atualizados no Rivo.**

**🟡 #2 — 4 acordos `status='completed'` com parcelas ainda em aberto**

A função `complete_agreement` (ou equivalente) marcou esses acordos como concluídos cedo demais. Casos:
- `715e16a3` (CPF 41679072838) — pago R$ 118,87 da parcela R$ 133,52 (parcial)
- `0165fc54` (CPF 33816949878) — parcela 2 (R$ 250,74) sem pagamento
- `8df557ee` (CPF 15199482980) — parcela 3 (R$ 269,12) sem pagamento
- `c7493649` (CPF 30654851840) — caso TESS já documentado

A SSOT está correta (parcelas de fato em aberto), só o flag `agreements.status='completed'` está errado.

### Plano desta rodada

**Parte A — Corrigir o bug crítico do maxlist** (5 min, 1 migration + 1 edge edit)

Tenho 2 opções:
- **A1 (recomendado)**: Adicionar `'cancelado_maxlist'` ao enum `client_status` para refletir o que o código realmente quer. Mantém histórico distinguível de cancelamento upstream vs quebra interna.
- **A2**: Mapear `cancelado_maxlist` → `quebrado` no código e remover o enum novo.

Recomendo **A1**: é mais informativo e a MaxList realmente diferencia "cancelado pelo credor" de "quebra de acordo". Posso já refletir esse status na hierarquia (vai ser tratado como `vencido` para fins de cobrança, mas exibido distintamente).

**Parte B — Reverter os 4 acordos `completed` indevidos**

Atualizar `agreements.status` desses 4 IDs de `completed` → `approved` e disparar `rebuild_agreement_installments` para recalcular tudo. Nenhum dado de pagamento é alterado, só o flag de "concluído".

**Parte C — Criar guard preventivo**

Adicionar trigger `BEFORE UPDATE ON agreements` que bloqueia transição para `status='completed'` enquanto existir parcela `NOT paid AND NOT cancelled`. Isso impede o problema de voltar a ocorrer.

### O que NÃO mexer

- ❌ SSOT (`agreement_installments`, `manual_payments`, `negociarie_cobrancas`) intocada
- ❌ Triggers de pagamento intocados
- ❌ Lógica de cobrança intocada

---

## Explicação simples (para responder "o que fizemos e por quê")

### 🎯 O problema original

Antes da migração SSOT, **a verdade sobre "quem pagou o quê" estava espalhada em 3 lugares diferentes** que podiam discordar entre si:

1. `agreements.paid_count` (um contador)
2. `manual_payments` (pagamentos confirmados pelo admin)
3. `negociarie_cobrancas` (recebimentos automáticos da Negociarie)

Resultado: às vezes o painel mostrava 2 parcelas pagas, o relatório mostrava 3, e a parcela do cliente continuava cobrando porque o sistema não tinha certeza se foi paga.

### 🔧 O que fizemos (5 fases)

1. **Criamos uma única tabela "verdade"**: `agreement_installments` — uma linha por parcela, com `paid=true/false`, `paid_amount`, `paid_source` (manual ou negociarie), `paid_at`. **Toda regra de cobrança lê daqui.**

2. **Padronizamos as chaves das parcelas**: `entrada`, `entrada_2`, `1`, `2`, `3`... (canônico, independente da entrada). Antes o sistema misturava numeração com e sem entrada e bagunçava o casamento de pagamentos.

3. **Backfill histórico**: rodamos a função `rebuild_agreement_installments` em todos os acordos existentes, recalculando do zero a partir das fontes brutas (manual_payments + negociarie_cobrancas), com regra anti-leak (mesmo pagamento não pode ser usado em 2 parcelas).

4. **Trigger automático**: toda vez que um manual_payment é criado/atualizado/deletado, ou uma cobrança Negociarie chega, a SSOT é recalculada **automaticamente** para aquele acordo.

5. **Auditoria diária com cron**: às 3h da manhã uma edge function compara a SSOT com as fontes brutas e registra qualquer divergência em `ssot_shadow_checks`. Hoje refinamos para eliminar 51 falsos positivos — restou só **1 caso real** que merece ação humana.

### 💡 O que melhorou

| Antes | Depois |
|---|---|
| Painel, relatório e cobrança discordavam às vezes | Todos lêem da mesma fonte → sempre consistentes |
| Pagamento manual + cobrança Negociarie podiam contar dobrado | Anti-leak garante 1 pagamento = 1 parcela |
| Pagamento parcial era mascarado como "pago" em alguns lugares | Continua devendo até quitar (correto) |
| Bug silencioso podia ficar meses sem ser detectado | Cron diário detecta em até 24h |
| Não tinha como provar que os números estavam corretos | Auditoria automática com histórico em `ssot_shadow_checks` |

### 🎁 Bônus desta rodada (se você aprovar)

- Para de perder dados de cancelamento da MaxList (bug crítico atual)
- 4 acordos voltam a aparecer como ativos (faturamento correto)
- Trigger preventivo impede que algum código futuro marque acordo como concluído antes da hora

Posso executar as Partes A, B e C?