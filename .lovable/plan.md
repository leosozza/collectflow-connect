

## Plano: Exibir todas as informações do cliente no perfil da Carteira

O `ClientDetailHeader` atualmente mostra apenas: nome, CPF, telefone (1), email, credor, endereço (rua+cidade+uf+cep), cod. devedor, total pago, parcelas e observações. Faltam vários campos que existem na tabela `clients` e são importados via planilha/MaxList.

### Campos faltantes a adicionar

**Na área colapsável ("Mais informações"):**
- `phone2` / `phone3` (Telefone 2, Telefone 3)
- `bairro`
- `cod_contrato`
- `valor_saldo` / `valor_atualizado`
- `data_pagamento` / `data_quitacao`
- `status_cobranca_id` (nome do status via lookup)
- `tipo_divida_id` (nome do tipo via lookup)

**No Sheet de edição:**
- `phone2`, `phone3`
- `bairro`
- `cod_contrato`

### Alterações em `src/components/client-detail/ClientDetailHeader.tsx`

1. **Linha 2 (metadados)**: Adicionar `phone2`/`phone3` ao lado do telefone principal
2. **Seção colapsável**: Reorganizar em grid com todos os campos:
   - Cod. Devedor, Cod. Contrato, Credor
   - Telefones 1/2/3
   - Endereço completo (rua, bairro, cidade, UF, CEP)
   - Valores: Total Pago, Saldo Devedor, Valor Atualizado
   - Datas: Pagamento, Quitação
   - Status Cobrança, Tipo Dívida, Perfil Devedor
3. **Sheet de edição**: Adicionar campos `phone2`, `phone3`, `bairro`, `cod_contrato`
4. **Mutation de update**: Incluir os novos campos no payload de atualização
5. **Queries**: Adicionar lookup de `tipos_divida` e `tipos_status` para exibir nomes

### Arquivo
- `src/components/client-detail/ClientDetailHeader.tsx`

