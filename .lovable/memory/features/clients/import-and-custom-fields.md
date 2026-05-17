---
name: Import & Custom Fields
description: Pipeline de importação de Carteira com suporte a CPF/CNPJ e campos personalizados (custom_data)
type: feature
---

# Importação de Carteira

## CPF/CNPJ
- `clientSchema.cpf` (validations.ts) aceita CPF (`000.000.000-00`) **e** CNPJ (`00.000.000/0000-00`).
- `cleanCPF` aceita 11 ou 14 dígitos; `formatCPFDisplay` formata ambos.
- `isValidCpfOrCnpj` em `cpfUtils.ts` valida checksum dos dois.
- Headers de planilha reconhecidos: `CPF`, `CNPJ`, `CPF/CNPJ`, `CPF_CNPJ`, `CNPJ_CPF`.

## Custom Fields
- Tabela `custom_fields` por tenant (opcional `credor_id`). Coluna alvo em `clients` é `custom_data jsonb`.
- `ImportDialog` lista campos ativos como opções `custom:{field_key}`. `parseRows` (importService) coleta esses targets e monta `custom_data` no row.
- `clientSchema` permite `custom_data: z.record(z.any()).optional().nullable()` — não é stripado.
- Template "Baixar Modelo" (CarteiraPage.downloadTemplate) busca `fetchCustomFields(tenant.id)` e anexa uma coluna por campo ativo.

## UX da Importação
- Tabelas de Mapeamento e Preview usam `overflow-auto` + `min-w-[700px]/[1100px]` para scroll horizontal.
- `onError` do `importMutation` mostra `err.message` (multi-linha vai em `description`), expondo erros do `validateImportRows`.
- Preview exibe colunas extras para cada `custom_data.key` mapeado.
