

# Plano: Limpar tela de Configuracoes > Telefonia (3CPlus)

## Problema

Ao clicar "Testar Conexao", o sistema exibe dois cards desnecessarios nessa pagina:
1. **Campanhas Disponiveis** — lista de campanhas (linhas 383-405)
2. **Teste de Envio de Mailing** — formulario de envio de teste (linhas 407-414 + componente MailingTestCard)

Alem disso, o card **Status de Sincronizacao** aparece sempre que ha tabulacoes, mas deveria ficar fechado por padrao e abrir apenas apos o teste de conexao.

## Correcoes em `src/components/integracao/ThreeCPlusTab.tsx`

### 1. Remover card "Campanhas Disponiveis" (linhas 383-405)

Remover o bloco condicional `{campaigns.length > 0 && (<Card>...Campanhas Disponíveis...</Card>)}` e o state `campaigns` / `setCampaigns`.

### 2. Remover card "Teste de Envio de Mailing" (linhas 407-414)

Remover o bloco condicional que renderiza `<MailingTestCard>` e remover o componente `MailingTestCard` inteiro (linhas 25-209), incluindo imports nao usados (`FlaskConical`, `Send`).

### 3. Status de Sincronizacao — fechado por padrao, abre apos testar conexao

- Adicionar state `showSyncStatus` (default `false`)
- No `handleTestConnection`, ao obter sucesso, setar `showSyncStatus = true`
- Condicionar a renderizacao do card de Status de Sincronizacao a `showSyncStatus && tenantDispositions.length > 0`

## Arquivo a editar

| Arquivo | Mudanca |
|---|---|
| `src/components/integracao/ThreeCPlusTab.tsx` | Remover MailingTestCard + card Campanhas; Status de Sync condicionado a teste bem-sucedido |

