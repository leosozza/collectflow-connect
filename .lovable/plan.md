
## Reestruturacao Completa da Pagina de Detalhes do Cliente

### 1. Card Principal Unificado (Header + Colapsavel)

Unificar o `ClientDetailHeader` e `ClientCollapsibleDetails` em um unico Card. O Card tera:

**Parte visivel (sempre aparece):**
- Linha 1: Botao Voltar + Nome do Devedor + Botoes de acao (WhatsApp, Telefone, Formalizar Acordo)
- Linha 2: CPF, Tel, Email, Credor, Em Aberto
- Linha 3: Trigger colapsavel com texto "Mais informacoes" e seta apontando para BAIXO na direita

**Icones melhorados:**
- WhatsApp: trocar `MessageCircle` por um icone SVG inline do logo oficial do WhatsApp (circulo verde com telefone branco), ou usar um icone mais reconhecivel com fundo circular verde
- Telefone/Atendimento: usar `Headset` (fone de atendimento) em vez de `Phone` simples, com fundo circular azul

**Parte colapsavel (ao clicar na seta):**
- Grid com todas as informacoes da planilha importada:
  - Cod. Devedor (external_id)
  - Cod. Contrato (extraido das observacoes)
  - Endereco completo (endereco, cidade, UF, CEP)
  - Telefone 2 e Telefone 3 (extraidos das observacoes, pois foram concatenados no import)
  - Total Pago e Parcelas pagas/total
  - Observacoes

### 2. Abas Reorganizadas

Nova ordem das abas:
```
Titulos em Aberto | Acordos | Historico | Documentos | Assinatura | Anexos
```

### 3. Nova Aba "Documentos"

Card com 4 botoes/cards para download dos documentos pre-definidos pelo admin no cadastro do credor:
- Carta de Acordo (`template_acordo`)
- Recibo de Pagamento (`template_recibo`)
- Carta de Quitacao (`template_quitacao`)
- Descricao de Divida (`template_descricao_divida`)

**Logica:**
1. Buscar o credor do devedor na tabela `credores` (pelo campo `razao_social` ou `nome_fantasia` que corresponda a `client.credor`)
2. Carregar os templates do credor
3. Substituir as variaveis do template pelos dados reais do devedor (nome, CPF, valores, datas, etc.)
4. Gerar arquivo TXT ou abrir em nova aba para impressao/download

Templates usam variaveis como `{nome_devedor}`, `{cpf_devedor}`, `{valor_divida}`, `{razao_social_credor}`, etc. Ja definidos no `CredorForm.tsx`.

### 4. Nova Aba "Assinatura"

Permite ao operador enviar a carta de acordo para o devedor assinar digitalmente. Opcoes de envio:
- **Por E-mail**: Envia um link do portal de assinatura para o email do devedor
- **Por WhatsApp**: Abre o WhatsApp com o link pre-preenchido na mensagem
- **Copiar Link**: Copia o link de assinatura para a area de transferencia

**Logica:**
1. Verificar se existe um acordo aprovado com `checkout_token`
2. Se existir, gerar o link do portal: `{URL_BASE}/portal?token={checkout_token}`
3. Mostrar status da assinatura (assinado/pendente) consultando `agreement_signatures`
4. Se nao houver acordo aprovado, exibir mensagem informando que e necessario formalizar e aprovar um acordo primeiro

### 5. Detalhes Tecnicos

**Arquivos a criar:**
- `src/components/client-detail/ClientDocuments.tsx` - Aba de documentos com download dos 4 templates
- `src/components/client-detail/ClientSignature.tsx` - Aba de envio de assinatura digital

**Arquivos a modificar:**
- `src/components/client-detail/ClientDetailHeader.tsx` - Melhorar icones de WhatsApp e Telefone; integrar a area colapsavel dentro do mesmo Card
- `src/components/client-detail/ClientCollapsibleDetails.tsx` - Sera removido como componente separado e integrado dentro do Header
- `src/pages/ClientDetailPage.tsx` - Reorganizar abas, adicionar as novas abas Documentos e Assinatura, remover import do `ClientCollapsibleDetails`

**Queries adicionais no ClientDetailPage:**
- Query para buscar o credor na tabela `credores` (para os templates de documentos)
- Query para buscar assinaturas em `agreement_signatures` (para aba Assinatura)

**Nenhuma migracao de banco necessaria** - todos os campos e tabelas ja existem.
