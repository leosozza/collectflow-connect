
# Mapear Todas as Colunas do CobCloud na Importacao

## Problema

A importacao do CobCloud esta mapeando apenas 7 dos 30 campos disponiveis. Campos importantes como telefone, email, endereco, cidade, estado, CEP e external_id existem na tabela `clients` mas nao estao sendo preenchidos pela importacao.

Alem disso, os nomes dos campos usados no mapeamento podem nao corresponder aos nomes reais da API CobCloud (ex: `NOME_DEVEDOR` vs `nome`).

## Campos que serao adicionados ao mapeamento

| Campo CobCloud | Campo clients | Logica |
|---|---|---|
| COD_DEVEDOR | external_id | Identificador unico do devedor |
| FONE_1 + FONE_2 + FONE_3 | phone | Concatenar telefones separados por " / " |
| EMAIL | email | Direto |
| ENDERECO + NUMERO + COMPLEMENTO | endereco | Concatenar com virgula |
| CIDADE | cidade | Direto |
| ESTADO | uf | Direto |
| CEP | cep | Direto |
| VL_SALDO | valor_pago | Usar como referencia se valor_pago nao existir |
| NM. ou total de parcelas | total_parcelas | Se disponivel |

## Alteracoes Tecnicas

### Edge Function `cobcloud-proxy/index.ts`

Nos dois blocos de mapeamento (handleImportTitulos e handleImportAll), expandir o `rawRecord` para incluir:

```text
rawRecord atual:
  nome_completo, cpf, credor, numero_parcela, valor_parcela, valor_pago, data_vencimento, status

rawRecord novo (adicionar):
  external_id  <- t.cod_devedor || t.COD_DEVEDOR || t.external_id
  phone        <- concatenar(t.fone_1 || t.FONE_1, t.fone_2 || t.FONE_2, t.fone_3 || t.FONE_3)
  email        <- t.email || t.EMAIL
  endereco     <- concatenar(t.endereco || t.ENDERECO, t.numero || t.NUMERO, t.complemento || t.COMPLEMENTO)
  cidade       <- t.cidade || t.CIDADE
  uf           <- t.estado || t.ESTADO || t.uf
  cep          <- t.cep || t.CEP
  total_parcelas <- t.nm || t.total_parcelas (se numerico)
```

Tambem expandir os fallbacks dos nomes de campos existentes para cobrir os nomes em maiuscula que a API CobCloud pode retornar:

```text
nome_completo <- t.nome || t.devedor_nome || t.nome_completo || t.NOME_DEVEDOR || t.nome_devedor
cpf           <- t.cpf || t.documento || t.cpf_cnpj || t.CNPJ_CPF || t.cnpj_cpf
credor        <- t.credor || t.empresa || t.CREDOR
parcela       <- t.parcela || t.numero_parcela || t.PARCELA
valor         <- t.valor || t.valor_titulo || t.valor_parcela || t.VL_TITULO || t.vl_titulo
data_venc     <- t.vencimento || t.data_vencimento || t.DT_VENCIMENTO || t.dt_vencimento
status        <- t.status || t.situacao || t.STATUS
```

### Schema de validacao

Atualizar o `importedRecordSchema` para incluir os novos campos opcionais:

```text
external_id: z.string().max(100).optional()
phone: z.string().max(200).optional()
email: z.string().max(200).optional()
endereco: z.string().max(500).optional()
cidade: z.string().max(100).optional()
uf: z.string().max(2).optional()
cep: z.string().max(20).optional()
total_parcelas: z.number().int().min(1).max(9999).optional()
```

### Resumo

- 1 arquivo alterado: `supabase/functions/cobcloud-proxy/index.ts`
- Os dois handlers de importacao (handleImportTitulos e handleImportAll) serao atualizados com o mapeamento expandido
- Nenhuma alteracao no banco de dados (as colunas ja existem na tabela clients)
