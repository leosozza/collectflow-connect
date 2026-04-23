

## Análise: o que acontece com os boletos hoje quando o acordo é quebrado

### Estado atual (já implementado)

**Quebra manual** (`agreementService.cancelAgreement`, linhas 412-436):
- Atualiza `agreements.status = 'cancelled'`
- **Marca os registros em `negociarie_cobrancas` como `status = 'cancelado'`** (apenas os que estavam `pendente` ou `em_aberto`). Boletos já pagos são preservados.
- Mas **não chama o Negociarie** para invalidar o boleto no provider — o link continua tecnicamente acessível se o devedor já tinha em mãos.

**Quebra automática** (`auto-expire-agreements`, linhas 153-200):
- Cancela o acordo e atualiza clientes para "Quebra de Acordo".
- **NÃO atualiza `negociarie_cobrancas`** — registros ficam como `pendente` no banco interno (bug de inconsistência vs. quebra manual).

**Reabertura** (`agreementService.reopenAgreement`, linhas 680-753):
- Volta `agreements.status = 'pending'` e re-marca títulos como `em_acordo`.
- **Não toca em `negociarie_cobrancas`**: os boletos antigos continuam com status `cancelado` (se quebra manual) ou `pendente` (se auto-expirado).
- **Não regera boletos automaticamente.** O operador precisa ir na aba "Acordos" e clicar manualmente em **"Reemitir boletos"** parcela por parcela (botão FileBarChart já existente em `AgreementInstallments`).

### Resumo direto para sua pergunta

| Cenário | Boletos no Rivo | Boletos no Negociarie/cliente |
|---|---|---|
| Quebra manual | Marcados `cancelado` | **Continuam acessíveis** pelo link antigo (não cancela no provider) |
| Quebra automática (vencimento + prazo) | **Permanecem `pendente`** (bug) | Continuam acessíveis |
| Reabertura | Permanecem como estavam | Não regenera; operador precisa reemitir manualmente |

### Problemas identificados

1. **Inconsistência entre quebra manual e automática**: a auto-expiração não cancela os boletos no banco interno.
2. **Boleto antigo continua válido no Negociarie** após quebra: se o cliente já recebeu o link antes, ele consegue pagar mesmo com o acordo cancelado. Isso pode gerar conciliação confusa (pagamento entra mas acordo está cancelado).
3. **Reabertura não dispara regeneração automática**: o operador precisa lembrar de corrigir datas e reemitir cada parcela manualmente. Friction operacional + risco de esquecer parcelas.

---

## Plano: padronizar quebra + automatizar reemissão na reabertura

### 1) Quebra automática passa a cancelar boletos (paridade com quebra manual)

Em `supabase/functions/auto-expire-agreements/index.ts` (após linha 159, dentro do bloco on-demand, e também no bloco do cron por volta da linha 412):
- Adicionar `UPDATE negociarie_cobrancas SET status = 'cancelado' WHERE agreement_id IN (...) AND status IN ('pendente','em_aberto')`.

### 2) Cancelar boleto no Negociarie (não só no Rivo)

A API Negociarie tem `DELETE /cobranca/{id_parcela}` (cancelamento). Hoje **não está exposta** no `negociarie-proxy`.

- Adicionar case `"cancelar-cobranca"` em `negociarie-proxy/index.ts` que chama `DELETE /cobranca/{id_parcela}`.
- Em `cancelAgreement` e na auto-expiração: para cada `negociarie_cobrancas` com `id_parcela` e status pendente, disparar a chamada de cancelamento (em `Promise.allSettled` para não bloquear se o provider falhar).
- Marcar localmente como `cancelado` independente do resultado da chamada externa (consistência de UI prevalece; falha só vai para log).

### 3) Reabertura regenera boletos automaticamente em background

Em `agreementService.reopenAgreement` (linha 717, logo após o UPDATE do status):
- Após o UPDATE de `status = 'pending'`, disparar `supabase.functions.invoke("generate-agreement-boletos", { body: { agreement_id: id } })` em **fire-and-forget** (mesma UX otimista que já adotamos no fechamento de acordo).
- A função `generate-agreement-boletos` já tem a lógica de **substituir** boletos antigos: faz `UPDATE ... SET status = 'substituido'` antes de inserir o novo (linhas 400-406). E ela já **pula parcelas com `dueDate < today`** (linha 324), exatamente o comportamento desejado: o operador precisa primeiro corrigir as datas vencidas, senão essas parcelas ficam sem boleto.
- Adicionar toast: "Acordo reaberto. Regerando boletos das parcelas futuras…" + segundo toast quando concluir.

### 4) UI: avisar operador na reabertura sobre datas vencidas

No `ClientDetailPage` `handleReopenAgreement` (linha 293): após reabrir, se houver parcelas com `dueDate < today`, exibir toast warning destacado: *"Atenção: X parcelas estão com data vencida e NÃO terão boleto gerado. Corrija as datas em 'Acordos do cliente' e clique em 'Reemitir' para essas parcelas."*

### 5) Evento de auditoria

Adicionar entrada em `client_events` com tipo `agreement_broken` (já existe no enum) e `agreement_reopened` para timeline do cliente — capturar quem fez, quando e quantos boletos foram cancelados/regerados.

---

### Resultado esperado

| Ação | Boletos no Rivo | Boletos no Negociarie | UX |
|---|---|---|---|
| Quebra manual | `cancelado` | **Cancelado no provider** | igual hoje |
| Quebra automática | `cancelado` (corrigido) | **Cancelado no provider** | igual hoje |
| Reabertura | Antigos viram `substituido`; novos `pendente` para parcelas futuras | Boletos novos gerados; antigos cancelados | Modal fecha imediato + toast de progresso; warning para parcelas vencidas |

### Arquivos a alterar

1. `supabase/functions/auto-expire-agreements/index.ts` — cancelar `negociarie_cobrancas` no bloco on-demand (≈linha 160) e no bloco do cron (≈linha 412).
2. `supabase/functions/negociarie-proxy/index.ts` — adicionar case `"cancelar-cobranca"` chamando `DELETE /cobranca/{id_parcela}`.
3. `src/services/agreementService.ts`:
   - `cancelAgreement`: após marcar `cancelado` localmente, chamar Negociarie (Promise.allSettled).
   - `reopenAgreement`: disparar `generate-agreement-boletos` fire-and-forget; logar evento `agreement_reopened`.
4. `src/pages/ClientDetailPage.tsx` `handleReopenAgreement`: detectar parcelas com data vencida e exibir toast warning.

### Validação

1. **Quebra manual** de acordo com 5 boletos pendentes → no Rivo ficam `cancelado`; no link antigo do Negociarie retorna "cancelado/expirado".
2. **Quebra automática** via `auto-expire-agreements` → mesma consistência (corrige bug atual onde ficavam `pendente`).
3. **Boleto já pago** antes da quebra → preservado, não é cancelado.
4. **Reabertura** com todas as parcelas com data futura → modal fecha; toast "Regerando boletos…"; em ~3s aba Acordos exibe os novos links via Realtime; antigos ficam `substituido`.
5. **Reabertura** com 2 parcelas vencidas → toast warning destacado; aba Acordos mostra novos boletos só para as futuras; após corrigir datas e clicar "Reemitir", as 2 últimas geram normalmente.
6. **Falha do Negociarie** ao cancelar → log de erro, mas estado local fica consistente como `cancelado` (não bloqueia operador).

