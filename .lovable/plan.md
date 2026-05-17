# Correção do módulo de Personalização + Importação de Carteira

## Diagnóstico

Investigando o fluxo (Cadastros → Personalização → Custom Fields, Carteira → Importar Planilha, `importService.ts`, `clientService.ts`, `validations.ts`) encontrei **5 bugs** que se combinam para causar o erro relatado pela Candy Gloss:

1. **Template "Baixar Modelo" é hardcoded** (`CarteiraPage.tsx:448`). Não busca `custom_fields` do tenant, então campos personalizados nunca aparecem na planilha modelo.
2. **Campos personalizados são perdidos no parsing**. `ImportDialog` permite mapear colunas para `custom:field_key`, mas `parseRows` (importService.ts) só copia campos do sistema — o `custom:*` é descartado antes de chegar no banco.
3. **CPF/CNPJ — validação rejeita CNPJ.** `clientSchema.cpf` exige regex `^\d{3}\.\d{3}\.\d{3}-\d{2}$` (validations.ts:11). Tenants com PJ falham no `validateImportRows` → erro silencioso ("Erro ao importar clientes" sem detalhe).
4. **Toast genérico esconde a causa.** `onError: () => toast.error("Erro ao importar clientes")` (CarteiraPage.tsx:413) descarta a `Error.message` real do `bulkCreateClients` (que já vem formatada com "Linha X: ...").
5. **Tabela do Preview sem scroll horizontal.** O `<ScrollArea>` da etapa Preview (ImportDialog.tsx) não tem `orientation="horizontal"` nem `<ScrollBar orientation="horizontal" />`, e a `<Table>` não tem `min-w` — por isso as colunas ficam cortadas ("Pendent...") na tela da Candy Gloss.

## Mudanças

### 1. `src/lib/cpfUtils.ts` — validação CPF/CNPJ
- Adicionar `isValidCNPJ(value)` (mod-11 dos 14 dígitos).
- Adicionar helper `isValidCpfOrCnpj(value)` que aceita 11 ou 14 dígitos.
- `formatCPFDisplay` já formata ambos — manter.

### 2. `src/lib/validations.ts` — schema aceita CPF e CNPJ
- Trocar regex do campo `cpf` por validação refinada:
  ```ts
  cpf: z.string().trim().refine(v => /^(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})$/.test(v),
    "CPF/CNPJ inválido")
  ```
- Permitir `custom_data: z.record(z.any()).optional().nullable()` no `clientSchema` para que não seja stripado.

### 3. `src/services/importService.ts` — preservar custom fields
- Em `parseRows`, após popular campos do sistema, varrer `colMap` por chaves que começam com `custom:` e montar `custom_data: { [field_key]: valor }` no row retornado.
- Adicionar `custom_data?: Record<string, any>` em `ImportedRow`.
- `cleanCPF` (cpfUtils) já aceita 14 dígitos — manter.

### 4. `src/services/clientService.ts` — persistir custom_data
- Em `bulkCreateClients`, preservar `custom_data` no `records.map` (hoje o spread `...rest` já leva, mas como o schema strip-ava, ficava perdido). Após o fix no schema (passo 2), ele chega íntegro.
- Em `fieldsToCompare` do log de update, **não** incluir `custom_data` (evita logs ruidosos; é tratado como overwrite).

### 5. `src/pages/CarteiraPage.tsx` — template dinâmico + erro real
- `downloadTemplate` vira `async`: carregar `fetchCustomFields(tenant.id)` (sem `credor_id` = campos globais do tenant) e anexar uma coluna por campo ativo após as colunas padrão. Linhas-exemplo recebem `""` nas novas colunas.
- Mudar `onError: (err) => toast.error(err?.message || "Erro ao importar clientes")` com `description` longa quando vier multi-linha.
- Header da coluna no template muda de `"CPF"` para `"CPF/CNPJ"`.

### 6. `src/components/clients/ImportDialog.tsx` — scroll horizontal + UX
- Envolver a `<Table>` do Preview num wrapper com `overflow-x-auto` (ou usar `ScrollArea` com `<ScrollBar orientation="horizontal" />` da shadcn).
- Adicionar `className="min-w-[1100px]"` na `<Table>` do Preview, garantindo barra de rolagem quando há muitas colunas.
- Mesmo tratamento para a `<Table>` do Mapeamento.
- Renomear label do campo CPF para "CPF/CNPJ" na coluna Status do preview.
- Quando houver custom fields mapeados, mostrar colunas adicionais no preview (renderizar `row.custom_data` se existir).

### 7. `src/services/fieldMappingService.ts`
- Já tem label `"CPF/CNPJ"` (linha 17). Apenas confirmar que auto-detect aceita header `CNPJ` isolado: acrescentar `"CNPJ": "cpf"` no `builtinMap` do ImportDialog.

## Garantias de não-regressão (Y.BRASIL)

- **Tenants sem custom_fields**: `fetchCustomFields` retorna `[]` → template idêntico ao atual.
- **Planilhas sem CNPJ**: regex CPF antigo continua válido dentro do novo refine.
- **Mapeamentos salvos antigos** (`field_mappings`): não referenciam `custom:*`, então comportamento preserva.
- **`bulkCreateClients` mantém assinatura** — Y.BRASIL e demais tenants não notam diferença até cadastrarem custom fields.
- **Trigger DB** que injeta `tenant_id` em `clients` continua funcionando (não tocamos no SQL).
- Nada no fluxo de **acordos/portal/Negociarie** é tocado.

## Detalhes técnicos

- `custom_data` é coluna `jsonb` em `public.clients` (já existe nos types).
- CNPJ regex aceita formato com pontuação: `00.000.000/0000-00`. `cleanCPF` retorna 14 dígitos válidos, e `formatCPFDisplay` já formata para CNPJ.
- Não precisa migração SQL.

## Plano de teste (a executar após aprovação)

1. Tenant **Candy Gloss**: baixar modelo → deve trazer colunas custom configuradas.
2. Importar 10 linhas (planilha do print) → deve concluir sem erro; verificar `clients.custom_data` populado via read_query.
3. Tenant **Y.BRASIL**: baixar modelo (sem custom) → idêntico ao atual. Importar 1 planilha pequena → ok.
4. Testar 1 linha com CNPJ (`12.345.678/0001-90`) → aceito.
5. Testar 1 linha com CPF inválido (`111.111.111-11`) → erro claro no toast com nº da linha.
6. Conferir scroll horizontal abrindo o Preview com >10 colunas.
