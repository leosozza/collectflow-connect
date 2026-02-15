## Reformulacao da Pagina de Detalhes do Cliente (/carteira/:cpf)

### Visao Geral

Reestruturar completamente a pagina de detalhes do devedor para incluir: header compacto com botoes de contato, informacoes colapsaveis, e uma calculadora de acordo completa integrada na pagina.

---

### 1. Header Compacto com Botoes de Contato

**Layout proposto:**

```text
[<-]  NOME DO DEVEDOR                    [WhatsApp] [Telefone] [Formalizar Acordo]
      CPF: xxx | Tel: xxx | Email: xxx | Credor: xxx | Em Aberto: R$ xxx
```

- Linha principal: nome + 3 botoes a direita
- Linha secundaria: CPF, Telefone, Email, Credor e Total em Aberto em uma unica linha compacta
- **Botao WhatsApp**: icone verde do WhatsApp (MessageCircle com cor verde), abre `https://wa.me/{phone}` em nova aba
- **Botao Telefone**: icone Phone, ao clicar navega para `/atendimento/:id` (mesma acao do botao "Atender" atual)
- **Botao "Formalizar Acordo"**: substitui o botao laranja "Atender", com cor primaria e icone de documento

### 2. Informacoes Detalhadas Colapsaveis

Apos o header, um bloco colapsavel (usando Collapsible ja existente) com seta para expandir, contendo:

- Total Pago, Parcelas pagas/total
- Endereco completo (endereco, cidade, UF, CEP)
- Telefones adicionais (se existirem)
- Observacoes
- External ID / Cod. Devedor / Cod. Contrato

Por padrao ficara **fechado**.

### 3. Calculadora de Acordo (nova aba ou secao principal)

Adicionar uma nova aba **"Acordo"** ao TabsList, contendo uma calculadora completa:

**Funcionalidades:**

- **Selecao de parcelas**: checkboxes na lista de titulos em aberto para selecionar quais parcelas entram no acordo
- **Resumo automatico**: total original calculado das parcelas selecionadas
- **Desconto em porcentagem**: campo numerico com calculo em tempo real
- **Desconto em valor fixo (R$)**: campo para informar desconto absoluto, atualizando automaticamente o percentual
- **Valor de entrada**: campo para valor + data da entrada
- **Parcelas restantes**: numero de parcelas e calculo automatico do valor de cada
- **Data do 1o vencimento**: date picker para a primeira parcela apos a entrada
- **Resumo visual**: card com Valor Original, Desconto, Valor Proposto, Entrada, Demais Parcelas (Nx de R$xx)
- **Observacoes**: textarea para notas
- **Botao "Gerar Acordo"**: cria o acordo usando o `agreementService.createAgreement`

### 4. Atualizacao do Import Service

Atualizar `src/services/importService.ts` para mapear corretamente as colunas da planilha "Pagamentos (2).xlsx":


| Coluna Planilha        | Campo DB                                                 |
| ---------------------- | -------------------------------------------------------- |
| CREDOR (col 0)         | credor                                                   |
| COD_DEVEDOR (col 1)    | external_id                                              |
| COD_CONTRATO (col 2)   | observacoes (concatenar)                                 |
| NOME_DEVEDOR (col 3)   | nome_completo                                            |
| TITULO (col 4)         | (referencia interna)                                     |
| CNPJ_CPF (col 5)       | cpf                                                      |
| FONE_1 (col 6)         | phone                                                    |
| FONE_2 (col 7)         | observacoes (concatenar)                                 |
| FONE_3 (col 8)         | observacoes (concatenar)                                 |
| EMAIL (col 9)          | email                                                    |
| ENDERECO (col 10)      | endereco (concatenar com numero, complemento, bairro)    |
| NUMERO (col 11)        | endereco                                                 |
| COMPLEMENTO (col 12)   | endereco                                                 |
| BAIRRO (col 13)        | endereco                                                 |
| CIDADE (col 14)        | cidade                                                   |
| ESTADO (col 15)        | uf                                                       |
| CEP (col 16)           | cep                                                      |
| PARCELA (col 21)       | numero_parcela                                           |
| DT_VENCIMENTO (col 23) | data_vencimento                                          |
| VL_TITULO (col 25)     | valor_parcela                                            |
| VL_SALDO (col 26)      | (pode usar como referencia)                              |
| VL_ATUALIZADO (col 27) | valor_parcela (se disponivel, priorizar sobre VL_TITULO) |
| STATUS (col 29)        | status (ATIVO=pendente, CANCELADO=quebrado)              |


### 5. Detalhes Tecnicos

**Arquivos a modificar:**

- `src/pages/ClientDetailPage.tsx` - Reestruturacao completa (header, colapsavel, aba de acordo)
- `src/services/importService.ts` - Novo mapeamento de colunas para a planilha

**Componentes reutilizados:**

- `Collapsible` / `CollapsibleTrigger` / `CollapsibleContent` para dados ocultos
- `Checkbox` para selecao de parcelas
- `Card`, `Input`, `Button`, `Tabs` ja existentes
- `agreementService.createAgreement` para persistir o acordo

**Nenhuma migracao de banco de dados necessaria** - todos os campos ja existem na tabela `clients`.   
  
O campo Codigo do devedor e Codigo do contrato, nosso sistema pode criar quando o credor não tiver essas funções.    
  
