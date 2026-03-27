

# Plano: Simplificar tabela de acordos + corrigir status do título

## Parte 1 — Simplificar colunas da tabela `/acordos`

Remover colunas: Original, Proposto, Parcelas, Vencimento, Ações (botão ExternalLink).

Colunas finais: **Cliente** (clicável → abre perfil), **CPF**, **Credor**, **Operador**, **Status**.

### `src/components/acordos/AgreementsList.tsx`
- Remover os `TableHead` e `TableCell` de Original, Proposto, Parcelas, Vencimento
- Remover o botão ExternalLink da coluna Ações
- Tornar o nome do cliente clicável: `<span className="cursor-pointer text-primary hover:underline" onClick={...}>`
- Manter os botões de Aprovar/Rejeitar na coluna Ações (aparecem só quando `showOperationalActions`)
- Se não há ações operacionais visíveis, esconder a coluna Ações inteira
- Remover imports não usados (`formatCurrency`, `getEffectiveAgreementSummary`, `format`, `ExternalLink`)

## Parte 2 — Corrigir CPF na atualização de status do título

O problema: quando o acordo é criado, o código faz `.eq("cpf", data.client_cpf)` mas o CPF pode estar em formato diferente (com pontos/traço vs sem).

### `src/services/agreementService.ts`
- Na função `createAgreement` (~linha 132-137): normalizar o CPF e usar `.or()` com ambos os formatos (raw e formatado) ao atualizar `clients.status` para `em_acordo`
- Na função `cancelAgreement` (~linha 364-388): aplicar a mesma normalização de CPF

## Parte 3 — Backfill do Raul via migration

- SQL migration para atualizar `clients.status = 'em_acordo'` onde existe um acordo vigente (`agreements.status = 'pending'`) e o título ainda está como `vencido`/`pendente`

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/acordos/AgreementsList.tsx` | Simplificar colunas, nome clicável |
| `src/services/agreementService.ts` | Normalizar CPF no create e cancel |
| Migration SQL | Backfill status dos títulos com acordo vigente |

