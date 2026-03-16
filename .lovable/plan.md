

# Mover Tokens para aba própria

## Situação atual
Na `TenantSettingsPage.tsx`, o conteúdo de Tokens (saldo + histórico) está embutido dentro da aba "Serviços" (linhas 463-474). As abas atuais são: Financeiro, Contrato, Serviços, Cancelamento.

## Alteração

**Arquivo:** `src/pages/TenantSettingsPage.tsx`

1. Adicionar nova `TabsTrigger` com valor `"tokens"` na `TabsList` (após "Serviços")
2. Mover o bloco de Tokens (TokenBalance + Card com TokenHistoryTable) da aba "Serviços" para um novo `TabsContent value="tokens"`
3. A aba "Serviços" ficará apenas com o catálogo de serviços
4. A nova aba "Tokens" terá o saldo, botão de compra e histórico de transações

Resultado final das abas: **Financeiro | Contrato | Serviços | Tokens | Cancelamento**

