# Auditoria 360 das correções de Importação + Personalização

## O que foi verificado

| Área | Resultado |
|---|---|
| `cpfUtils.isValidCNPJ` / `isValidCpfOrCnpj` | OK, mod-11 padrão Receita Federal. |
| `validations.clientSchema.cpf` aceita CPF e CNPJ | OK, regex `^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$`. |
| `validations.clientSchema.custom_data` permitido (não stripado) | OK. |
| `importService.parseRows` coleta `custom:{key}` para `custom_data` | OK, só no caminho `isCustomMapping=true`. |
| `ImportDialog` scroll horizontal (mapping + preview) | OK, `overflow-auto` + `min-w-[700px]/[1100px]`. |
| `ImportDialog` aceita header `CNPJ`/`CPF/CNPJ` no auto-detect | OK. |
| `CarteiraPage.downloadTemplate` injeta colunas custom do tenant | OK, dynamic import de `fetchCustomFields`. |
| `CarteiraPage` toast de erro mostra mensagem real do `bulkCreateClients` | OK. |
| Edge functions (logs últimas 30 min) | Sem erros relacionados; cron `dispatch-scheduled-campaigns` segue logando ruído antigo (`utf-8-validate`, não relacionado). |
| RLS policies de `clients` | `INSERT WITH CHECK (tenant_id = get_my_tenant_id())` — exige `tenant_id` no payload. |

## Bug crítico encontrado durante auditoria

**`bulkCreateClients` NUNCA preenche `tenant_id` nos registros.**

- `clients.tenant_id` é `NOT NULL` (confirmado via `information_schema`).
- Não há trigger BEFORE INSERT que injete `tenant_id` (verificado em `pg_trigger`).
- A política RLS exige `tenant_id = get_my_tenant_id()`.
- `import_logs` mostra **zero** imports do tipo `source='spreadsheet'` em 30 dias (todos imports da Y.BRASIL são `source='maxlist'`, que vai por outra edge function que já injeta `tenant_id` corretamente).
- `clientSchema` (zod) faz strip de chaves desconhecidas, então mesmo que a UI tentasse mandar `tenant_id`, seria descartado.
- Conclusão: o erro "Erro ao importar clientes" da Candy Gloss é, em última instância, NOT NULL violation / RLS denied — **não** apenas o custom field perdido.

Sem essa correção, todas as outras melhorias não resolvem o sintoma do print.

## Ajustes adicionais a aplicar

### A. `src/services/clientService.ts` — injetar `tenant_id`
- Antes do `valid.map(...)`, buscar `profiles.tenant_id` pelo `operatorId` (mesma lógica de `createClient` linhas 162–170).
- Lançar erro claro: `"Operador sem empresa vinculada"` se vier null.
- `records.map` passa a colocar `tenant_id` em cada registro.
- Usar `tenantId` na consulta de `existingMap` (`.eq("tenant_id", tenantId).in("external_id", ...)` e idem para CPF) para evitar colisão cross-tenant em ambientes com CPFs repetidos entre tenants — proteção defensiva mesmo com RLS.
- `upsert` com `onConflict: "external_id,tenant_id"` já está correto; manter.

### B. `src/lib/validations.ts` — aceitar tenant_id no schema
- Adicionar `tenant_id: z.string().uuid().optional()` ao `clientSchema` para evitar que zod descarte (defesa em profundidade — o serviço também injeta).

### C. `src/services/importService.ts` — endurecer cleanCPF para CNPJ no parsing
- `cleanCPF` em `cpfUtils.ts` já tolera 14 dígitos, mas `padStart(11, "0")` ainda pode mascarar lixo curto. Verificar no `parseRows`: se `rawCpf.length` ∉ {11,14}, pular linha (já é o caso — `if (!rawCpf) continue`). OK, sem mudança.

### D. `src/components/clients/ClientForm.tsx` — UI manual aceitar CNPJ (escopo secundário)
- Trocar `maxLength={14}` por `maxLength={18}`.
- Usar `formatCPFDisplay` no onChange (já formata os dois).
- Label: `"CPF/CNPJ"`.
- Sem afetar fluxo de import.

### E. Nada toca em edge functions
- `maxlist-import` tem lógica própria (CPF padding); fora do escopo, mantida.
- `portal-lookup` exige CPF 11 dígitos (linha 106): fora do escopo (PJ não negocia via portal hoje).

## Plano de validação (executar após approval)

1. **DB inspect**: rodar `SELECT count(*), max(created_at) FROM clients WHERE custom_data <> '{}'::jsonb GROUP BY tenant_id` antes/depois do teste para confirmar persistência.
2. **Tenant Candy Gloss**:
   - Baixar modelo → conferir colunas custom presentes.
   - Importar a planilha do print (10 linhas) → esperar sucesso, `import_logs` com `source='spreadsheet'`, `inserted=10`.
   - Verificar `clients.custom_data` populado.
3. **Tenant Y.BRASIL**:
   - Importar 2–3 linhas sintéticas (CPFs novos) → sucesso.
   - Confirmar que imports `maxlist` antigos (que dominam o tenant) seguem funcionando — nenhum código de maxlist foi tocado.
4. **CNPJ**:
   - Linha com `12.345.678/0001-90` → aceito; `clients.cpf` salvo limpo (14 dígitos).
5. **CPF inválido**:
   - `000.000.000-00` → recusado com mensagem `Linha N: CPF/CNPJ inválido` no toast (description).
6. **Scroll horizontal**:
   - Abrir Preview com Candy Gloss (10+ colunas) → barra de rolagem visível, botões `Cancelar / Importar` permanecem clicáveis sem sobreposição.
7. **Cross-tenant safety**:
   - Confirmar via `SELECT cpf, tenant_id, count(*) FROM clients GROUP BY 1,2 HAVING count(*) > 1` que upserts ficaram restritos ao tenant correto.

## Riscos residuais (documentados, fora deste plano)

- `ClientForm` (criação avulsa) continuará rejeitando CNPJ visualmente até a alínea D ser aplicada.
- `portal-lookup` rejeita CNPJ (devedores PJ não conseguirão acessar portal). Será endereçado em fluxo dedicado quando aparecer demanda.
- `maxlist-import` força padding para 11 dígitos — só importa empresas que usam o sistema Maxlist (todos PF hoje na Y.BRASIL).
