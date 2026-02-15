

## Adicionar template "Descricao de Divida" aos Modelos de Documentos

### O que sera feito
Adicionar um quarto modelo de documento chamado **"Descricao de Divida"** na secao de Modelos de Documentos da aba Negociacao. Este documento serve para detalhar formalmente a divida do devedor, com informacoes como credor, valor, vencimento e composicao do debito. O template seguira o padrao de mercado utilizado por assessorias de cobranca.

### Template padrao (modelo de mercado)

```text
DESCRICAO DE DIVIDA

Credor: {razao_social_credor} - CNPJ: {cnpj_credor}
Devedor: {nome_devedor} - CPF: {cpf_devedor}

Informamos que consta em nossos registros o seguinte debito em nome do devedor acima qualificado:

Valor Original: R$ {valor_divida}
Data de Vencimento: {data_vencimento}
Parcela: {numero_parcela}/{total_parcelas}
Valor da Parcela: R$ {valor_parcela}

O debito acima descrito encontra-se vencido e nao quitado ate a presente data ({data_atual}), estando sujeito a incidencia de juros, multa e correcao monetaria conforme previsto contratualmente.

Colocamo-nos a disposicao para negociacao e regularizacao do debito.

{razao_social_credor}
CNPJ: {cnpj_credor}
```

### Detalhes Tecnicos

**1. Migracao de banco de dados** - Adicionar coluna `template_descricao_divida` na tabela `credores`:
```sql
ALTER TABLE credores ADD COLUMN template_descricao_divida text DEFAULT '';
```

**2. Arquivo:** `src/components/cadastros/CredorForm.tsx`
- Adicionar constante `TEMPLATE_DESCRICAO_DIVIDA_DEFAULT` com o texto padrao acima
- Adicionar entrada no array `TEMPLATES`: `{ key: "template_descricao_divida", label: "Descricao de Divida" }`
- Incluir `template_descricao_divida` no estado inicial do formulario (quando nao ha edicao)

Nenhuma outra alteracao necessaria -- o card compacto e o Dialog de edicao ja sao renderizados dinamicamente pelo array `TEMPLATES`.
