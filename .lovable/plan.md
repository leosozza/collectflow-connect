

## Plano: 3 Mudancas no Cadastro de Credores e Calculadora de Acordos

### 1. Faixas de Aging por Credor (aba Negociacao)

**Banco de dados:**
- Adicionar coluna `aging_discount_tiers` (jsonb, default `'[]'`) na tabela `credores`
- Estrutura: `[{ min_days: 0, max_days: 59, discount_percent: 10 }, { min_days: 60, max_days: 120, discount_percent: 20 }, ...]`

**Frontend (`CredorForm.tsx` - aba Negociacao):**
- Adicionar secao "Faixas de Desconto por Aging" abaixo das regras de acordo existentes
- Interface com botao "Adicionar Faixa" e tabela editavel com colunas: De (dias), Ate (dias), Desconto (%)
- Salvar no campo `aging_discount_tiers` junto com os demais dados do credor

### 2. Modelo de Documento "Notificacao Extrajudicial"

**Banco de dados:**
- Adicionar coluna `template_notificacao_extrajudicial` (text, default `''`) na tabela `credores`

**Frontend (`CredorForm.tsx`):**
- Adicionar entrada "Notificacao Extrajudicial" ao array `TEMPLATES`
- Criar constante `TEMPLATE_NOTIFICACAO_EXTRAJUDICIAL_DEFAULT` com texto validado juridicamente (notificacao formal com variaveis dinamicas como `{nome_devedor}`, `{cpf_devedor}`, `{valor_divida}`, `{data_vencimento}`, `{razao_social_credor}`, `{cnpj_credor}`, `{data_atual}`)

### 3. Modelos Pre-fixados na Calculadora de Acordos

**Frontend (`AgreementCalculator.tsx`):**
- Buscar dados do credor (desconto maximo, juros, multa, parcelas, entrada minima, aging tiers) via query ao Supabase
- Adicionar 3 botoes de modelo acima dos campos manuais:
  - **Modelo 1 - A vista**: Aplica desconto baseado na faixa de aging do credor (ou desconto maximo se nao houver faixa). Parcelas = 1, sem entrada.
  - **Modelo 2 - Entrada + Parcelas**: Entrada de 30% + 5 parcelas do saldo restante, com desconto da faixa de aging.
  - **Modelo 3 - Cartao (sem juros/multa)**: Valor total sem juros e multa, parcelado no maximo de parcelas do credor.
- Ao clicar num modelo, preenche automaticamente os campos (desconto, entrada, parcelas) respeitando as regras do credor.
- O operador pode ajustar manualmente apos selecionar o modelo.

### Detalhes tecnicos

| Componente | Acao |
|---|---|
| Migration SQL | Adicionar `aging_discount_tiers jsonb DEFAULT '[]'` e `template_notificacao_extrajudicial text DEFAULT ''` em `credores` |
| `CredorForm.tsx` | Secao de aging tiers na aba Negociacao + template notificacao nos Documentos |
| `AgreementCalculator.tsx` | 3 botoes de modelo que consultam regras do credor e preenchem campos |
| `cadastrosService.ts` | Garantir que novos campos sao persistidos no upsert |

