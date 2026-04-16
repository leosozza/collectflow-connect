

# Correções: Cancelamento de boletos + Busca de endereço para geração

## Problema 1: Boletos NÃO são cancelados ao quebrar/cancelar acordo

A função `cancelAgreement` em `agreementService.ts` (linha 395-468) apenas:
- Atualiza o status do acordo para `cancelled`
- Reverte os títulos (clients) para `pendente`
- Recalcula o score

**Não há nenhuma lógica para cancelar os boletos na `negociarie_cobrancas`**. Os boletos pendentes continuam ativos na Negociarie mesmo após quebra/cancelamento.

### Solução
Adicionar na `cancelAgreement` uma chamada para marcar todos os boletos pendentes como `cancelado` na tabela `negociarie_cobrancas`, e opcionalmente chamar a API da Negociarie para cancelá-los lá também.

---

## Problema 2: Endereço não encontrado ao gerar boleto

A Edge Function `generate-agreement-boletos` faz:
1. Busca em `client_profiles` por `tenant_id` + `cpf` (digits only)
2. Se `email` ou `cep` estiver vazio, faz fallback na tabela `clients`

**O problema real**: Os dados da query confirmam que `client_profiles` frequentemente tem `cep`, `endereco`, `bairro`, `cidade`, `uf` como `NULL` — mesmo quando a tabela `clients` tem esses dados preenchidos.

A condição de fallback (linha 204) é:
```
if (!clientData.email || !clientData.cep)
```

Isso faz fallback **apenas se email OU cep estiver vazio**. Se o profile tiver email preenchido mas sem endereço, o fallback não é acionado — resultando em dados incompletos.

### Solução
Alterar a lógica de fallback para verificar **todos os campos obrigatórios** individualmente, não apenas `email` e `cep`. Se qualquer campo obrigatório estiver vazio no profile, deve buscar o fallback nos `clients`.

---

## Alterações técnicas

### 1. `src/services/agreementService.ts` — `cancelAgreement`
Após atualizar o status do acordo, adicionar:
```typescript
// Cancelar boletos pendentes na negociarie_cobrancas
await supabase
  .from("negociarie_cobrancas")
  .update({ status: "cancelado" })
  .eq("agreement_id", id)
  .in("status", ["pendente", "em_aberto"]);
```

### 2. `supabase/functions/generate-agreement-boletos/index.ts` — Lógica de fallback
Alterar a condição de fallback (linha 204) de:
```typescript
if (!clientData.email || !clientData.cep)
```
Para:
```typescript
const needsFallback = ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf"]
  .some(f => !String(clientData[f] || "").trim());
if (needsFallback)
```

E alterar a lógica de merge para preencher **todos** os campos faltantes do `clients`, não apenas os que estão vazios no profile.

### Arquivos alterados
- `src/services/agreementService.ts` — cancelar boletos ao quebrar/cancelar acordo
- `supabase/functions/generate-agreement-boletos/index.ts` — corrigir condição de fallback de endereço

