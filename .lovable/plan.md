

# Melhorias no Formulario de Cobranca Negociarie (Boleto, Pix, Cartao)

## Problemas Atuais

1. **Bug critico**: O formulario envia `client_id: null` ao salvar no banco, mas a coluna `client_id` na tabela `negociarie_cobrancas` e NOT NULL -- isso causa erro no INSERT
2. **Sem mascara de CPF**: O campo CPF aceita qualquer texto sem formatacao
3. **Sem validacao robusta**: Apenas verifica se campos estao preenchidos, sem validar formato de CPF, valor minimo, data no passado, etc.
4. **Sem feedback visual do resultado**: Apos gerar a cobranca, nao mostra o link do boleto, codigo Pix ou link do cartao gerado -- o usuario precisa procurar na lista
5. **Sem mascara de telefone**: Campo telefone sem formatacao
6. **Sem confirmacao antes de enviar**: Nenhum dialog de confirmacao para evitar envios acidentais

## Plano de Implementacao

### 1. Corrigir bug do client_id (migracao de banco)
- Alterar a coluna `client_id` na tabela `negociarie_cobrancas` para ser NULLABLE, ja que cobracas podem ser geradas sem vincular a um cliente do sistema

### 2. Melhorar o CobrancaForm
- Adicionar mascara de CPF (000.000.000-00) com formatacao automatica ao digitar
- Adicionar mascara de telefone ((00) 00000-0000)
- Validar CPF com 11 digitos apos remover formatacao
- Validar valor minimo (maior que zero)
- Validar data de vencimento nao pode ser no passado
- Adicionar dialog de confirmacao antes de enviar com resumo dos dados
- Apos sucesso, exibir um card/modal com os dados de pagamento gerados:
  - Boleto: link do boleto + linha digitavel (com botao copiar)
  - Pix: codigo copia-e-cola (com botao copiar) + QR code se disponivel
  - Cartao: link de pagamento (com botao copiar/abrir)

### 3. Melhorar o CobrancasList
- Adicionar tooltip nos botoes de acao para clareza
- Mostrar mais informacoes (nome/CPF se disponiveis)

### 4. Melhorar tratamento de erros no edge function
- Adicionar logging no `negociarie-proxy` para facilitar debug
- Retornar mensagens de erro mais descritivas

## Detalhes Tecnicos

### Migracao SQL
```sql
ALTER TABLE negociarie_cobrancas ALTER COLUMN client_id DROP NOT NULL;
```

### Arquivos modificados
- `src/components/integracao/CobrancaForm.tsx` -- Mascaras, validacao, dialog de confirmacao, exibicao do resultado
- `src/services/negociarieService.ts` -- Remover cast `as any` e ajustar tipagem
- `supabase/functions/negociarie-proxy/index.ts` -- Adicionar console.log para debug
- Nova funcao utilitaria de mascaras em `src/lib/formatters.ts` (se nao existir mascaras la)

### Fluxo melhorado do usuario
1. Preenche formulario com mascaras automaticas
2. Clica em "Gerar Boleto/Pix/Cartao"
3. Dialog de confirmacao aparece com resumo
4. Confirma e aguarda resposta
5. Card de sucesso aparece com os dados de pagamento (link, linha digitavel, pix copia-cola)
6. Lista de cobrancas atualiza automaticamente

