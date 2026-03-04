

## Plano: Corrigir metricas do Dashboard por operador e revisar status de titulos ao formalizar acordo

### Problema 1 — R$1.800 do VITOR
O `totalProjetado` soma `valor_parcela` de TODOS os clientes que tem acordo ativo no sistema, sem filtrar pelo operador. O fluxo e:
1. `filteredAgreements` filtra por `created_by` do operador (correto)
2. `agreementCpfs` usa `activeAgreements` (TODOS os acordos ativos, nao filtrado) — **BUG**
3. `filteredClients` cruza clientes com `agreementCpfs` global
4. `totalProjetado` soma tudo sem filtro de operador

**Correcao**: Usar `filteredAgreements` (ja filtrado por operador) para construir `agreementCpfs`, nao `activeAgreements`.

### Problema 2 — Titulos nao mudam de status ao formalizar acordo
Hoje, ao criar um acordo, os titulos originais permanecem `pendente`. Isso causa:
- Duplicidade nos calculos (titulo pendente + acordo vigente)
- Confusao visual no perfil do cliente

**Proposta**: Quando um acordo e criado, marcar os titulos originais (mesmo CPF + credor) como `em_acordo`. Isso os remove das metricas de "pendente" sem perder o historico.

Porem, adicionar um novo enum requer migration. Alternativa mais simples: usar o campo `observacoes` ou criar uma flag. Mas a solucao mais limpa e adicionar `em_acordo` ao enum `client_status`.

### Alteracoes

#### 1. Migration — Adicionar `em_acordo` ao enum `client_status`
```sql
ALTER TYPE public.client_status ADD VALUE IF NOT EXISTS 'em_acordo';
```

#### 2. `src/services/agreementService.ts` — Ao criar acordo, marcar titulos
No `createAgreement`, apos inserir o acordo, atualizar os titulos pendentes do mesmo CPF+credor para `em_acordo`:
```typescript
await supabase.from("clients")
  .update({ status: "em_acordo" })
  .eq("cpf", data.client_cpf)
  .eq("credor", data.credor)
  .in("status", ["pendente", "vencido"]);
```

#### 3. `src/services/agreementService.ts` — Ao cancelar acordo, reverter titulos
No `cancelAgreement`, reverter titulos de `em_acordo` para `pendente` (ou `vencido` se vencidos):
```typescript
await supabase.from("clients")
  .update({ status: "pendente" })
  .eq("cpf", cpf)
  .eq("credor", credor)
  .eq("status", "em_acordo");
```

#### 4. `src/pages/DashboardPage.tsx` — Corrigir filtro por operador
- Construir `agreementCpfs` a partir de `filteredAgreements` (filtrado por operador) em vez de `activeAgreements` (global)
- Titulos `em_acordo` nao aparecem em "Pendentes" (ja saem automaticamente por nao terem status `pendente`)

#### 5. UI — Tratar novo status `em_acordo`
- No Dashboard e tabelas, exibir "Em Acordo" com cor azul/indigo
- Na edge function `auto-expire-agreements`, NAO marcar titulos `em_acordo` como `vencido`

### Arquivos

| Arquivo | Alteracao |
|---|---|
| Migration SQL | Adicionar `em_acordo` ao enum client_status |
| `src/services/agreementService.ts` | Marcar titulos como `em_acordo` ao criar; reverter ao cancelar |
| `src/pages/DashboardPage.tsx` | Usar `filteredAgreements` para `agreementCpfs`; tratar status `em_acordo` |
| `supabase/functions/auto-expire-agreements/index.ts` | Excluir `em_acordo` da marcacao automatica de vencido |

### Fluxo final de status dos titulos

```text
pendente → (acordo criado) → em_acordo → (acordo pago) → pago
pendente → (venceu) → vencido → (acordo criado) → em_acordo
em_acordo → (acordo cancelado) → pendente/vencido
em_acordo → (pagamento registrado) → pago
```

