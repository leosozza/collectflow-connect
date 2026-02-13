
# Reestruturar Contact Center e Integracao

## Conceito

Separar **configuracao** de **operacao**:

- `/integracao` -- aba "Telefonia" com sub-aba "3CPlus" para salvar credenciais (dominio + token) e testar conexao
- `/contact-center` -- tela operacional com opcao de canal (Telefonia ou WhatsApp), onde Telefonia mostra Campanhas, Enviar Mailing e Historico do discador integrado

## Alteracoes

### 1. Pagina `/integracao` -- restaurar aba 3CPlus

- Adicionar de volta a aba "Telefonia" no TabsList (ao lado de CobCloud e Negociarie)
- Dentro da aba Telefonia, mostrar o componente `ThreeCPlusTab` existente (que ja tem o formulario de credenciais com dominio, token, salvar e testar conexao)
- O componente `src/components/integracao/ThreeCPlusTab.tsx` ja existe e esta pronto, basta importar e adicionar na pagina

### 2. Pagina `/contact-center` -- remover aba de configuracao

- Remover a sub-aba "Configuracao" do `ThreeCPlusPanel.tsx` (ficam apenas: Campanhas, Enviar Mailing, Historico)
- Quando as credenciais nao estiverem configuradas, exibir mensagem orientando o admin a ir em Integracoes para configurar
- Os paineis de Campanhas e Mailing ja leem as credenciais de `tenant.settings`, entao continuam funcionando normalmente

### 3. Remover `ConfigPanel.tsx` do contact-center

- O arquivo `src/components/contact-center/threecplus/ConfigPanel.tsx` deixa de ser usado no Contact Center (pode ser removido, pois o `ThreeCPlusTab` em integracao ja cumpre essa funcao)

## Detalhes Tecnicos

### Arquivos modificados
- `src/pages/IntegracaoPage.tsx` -- adicionar aba "Telefonia" importando `ThreeCPlusTab`
- `src/components/contact-center/threecplus/ThreeCPlusPanel.tsx` -- remover tab "config" e import do ConfigPanel; adicionar aviso quando credenciais nao existirem

### Arquivos removidos
- `src/components/contact-center/threecplus/ConfigPanel.tsx` -- nao mais necessario

### Nenhum arquivo novo necessario
Todos os componentes ja existem, so precisam ser reorganizados.
