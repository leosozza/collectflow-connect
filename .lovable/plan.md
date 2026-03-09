

## Análise: Status de Carteira — Regras Atuais e Problemas

Analisei toda a lógica de classificação de status de cobrança no sistema. Segue o mapeamento de cada status, sua regra esperada, e o que está funcionando ou não.

---

### 1. Aguardando Acionamento
**Regra esperada:** Cliente com parcela(s) vencida(s), sem acordo vigente, pronto para cobrança.
**Implementação atual (auto-status-sync):**
- Atribui para registros com `status IN ('pendente','vencido')` e `data_vencimento < hoje`
- Atribui para registros sem `status_cobranca_id` que estão vencidos

**Problema:** A Edge Function `auto-break-overdue` muda o `status` de `pendente` → `quebrado` após 48h de vencimento. Clientes `quebrado` **não são considerados** pelo auto-status-sync (que filtra apenas `pendente/vencido`). Resultado: clientes quebrados ficam sem status de cobrança atualizado ou "presos" no status anterior.

---

### 2. Acordo Vigente
**Regra esperada:** Cliente com acordo formalizado ativo (status do registro = `em_acordo`).
**Implementação atual:**
- Edge Function: Força `status_cobranca_id` = "Acordo Vigente" quando `clients.status = 'em_acordo'`
- Frontend (CarteiraPage): Força "Acordo Vigente" se o CPF existe na tabela `agreements` com status `pending/approved`
- Frontend também **exclui** registros `em_acordo` da listagem (linha 209)

**Problema:** Dupla exclusão — se `em_acordo` é filtrado fora da listagem, o status "Acordo Vigente" nunca aparece na Carteira. O frontend tenta forçar pelo CPF nos agreements, mas os registros base já foram removidos.

---

### 3. Em dia
**Regra esperada:** Todas as parcelas pendentes do CPF/credor têm vencimento futuro (≥ hoje).
**Implementação atual (auto-status-sync):**
- Verifica se TODOS os registros `pendente` de um CPF/credor têm `data_vencimento >= hoje`
- Se sim, atribui "Em dia"
- Registros novos sem status_cobranca_id e vencimento futuro → "Em dia"

**Problema:** Funciona corretamente para `pendente`, mas ignora registros `vencido` do mesmo CPF. Se um CPF tem 1 parcela `vencido` e 3 `pendente` futuras, as pendentes podem ser classificadas como "Em dia" mesmo com dívida vencida no mesmo grupo.

---

### 4. Quebra de Acordo
**Regra esperada:** Acordo cancelado/quebrado por falta de pagamento após X dias.
**Implementação atual:**
- NÃO existe lógica no auto-status-sync para atribuir este status_cobranca_id
- `auto-break-overdue` muda `clients.status` → `quebrado` mas NÃO atualiza `status_cobranca_id`
- `auto-expire-agreements` cancela agreements após `prazo_dias_acordo` mas NÃO atualiza `status_cobranca_id` dos clients

**Problema:** Este status de cobrança nunca é atribuído automaticamente. Ele existe apenas como cadastro. Quando um acordo é cancelado, os registros ficam como `quebrado` mas o `status_cobranca_id` não muda para "Quebra de Acordo".

---

### 5. Quitado
**Regra esperada:** Cliente com todas as parcelas pagas (somente leitura).
**Implementação atual:**
- NÃO existe lógica para atribuir `status_cobranca_id` = "Quitado"
- O filtro de quitados na Carteira usa `clients.status === 'pago'`, mas não atualiza o `status_cobranca_id`

**Problema:** Status de cobrança "Quitado" nunca é atribuído. Clientes pagos mantêm qualquer `status_cobranca_id` que tinham antes.

---

### 6. Em Negociação
**Regra esperada:** Cliente travado por X dias para o operador responsável.
**Implementação atual:**
- NÃO existe lógica para atribuir ou expirar este status automaticamente
- Regra define `tempo_expiracao_dias: 10` e `auto_transicao: "Aguardando acionamento"` mas nenhuma Edge Function implementa essa transição

**Problema:** Não há mecanismo para expirar automaticamente "Em negociação" → "Aguardando acionamento" após os 10 dias configurados.

---

### 7. Risco de Processo
**Regra esperada:** Alerta visual, atribuição manual.
**Implementação atual:** Apenas visual (badge vermelha no cadastro).
**Status:** OK — é um status manual, funciona como esperado.

---

### Resumo dos Problemas

| Status | Funciona? | Problema |
|---|---|---|
| Aguardando Acionamento | Parcial | Ignora clientes `quebrado` |
| Acordo Vigente | Parcial | Registros `em_acordo` excluídos da listagem |
| Em dia | Parcial | Ignora `vencido` do mesmo CPF |
| Quebra de Acordo | Não | Nunca atribuído automaticamente |
| Quitado | Não | Nunca atribuído automaticamente |
| Em Negociação | Não | Expiração automática não implementada |
| Risco de Processo | Sim | Manual, OK |

### Plano de Correção

**Arquivo principal:** `supabase/functions/auto-status-sync/index.ts`

1. Adicionar lógica para `quebrado` → atribuir "Quebra de Acordo" ou "Aguardando Acionamento"
2. Adicionar lógica para `pago` → atribuir "Quitado"
3. Incluir `vencido` na verificação de grupo CPF para "Em dia"
4. Adicionar expiração de "Em negociação" baseada em `status_cobranca_locked_at` + `tempo_expiracao_dias`
5. Manter registros `em_acordo` visíveis na Carteira com badge "Acordo Vigente" (remover filtro de exclusão no frontend)

**Arquivo secundário:** `src/pages/CarteiraPage.tsx`
- Remover ou ajustar exclusão de `em_acordo` (linha 209)

**Arquivo secundário:** `supabase/functions/auto-expire-agreements/index.ts`
- Ao cancelar acordo, atualizar `status_cobranca_id` para "Quebra de Acordo"

