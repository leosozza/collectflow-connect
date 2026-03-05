

## Plano: Agrupar clientes por CPF na Carteira

### Problema
Hoje a tabela em `/carteira` exibe uma linha por parcela. O usuário quer ver **uma linha por cliente (agrupado por CPF)**, com o primeiro vencimento visível. As parcelas individuais ficam acessíveis ao entrar no perfil do cliente.

### Alterações

**`src/pages/CarteiraPage.tsx`**

1. **Criar agrupamento por CPF** no `displayClients` (useMemo): após filtrar e ordenar, agrupar por CPF usando um `Map<string, Client[]>`, mantendo de cada grupo:
   - `nome_completo`, `cpf`, `credor` (do primeiro registro)
   - `data_vencimento`: menor data de vencimento do grupo (primeiro vencimento)
   - `valor_total`: soma de `valor_parcela` de todas as parcelas do grupo
   - `total_parcelas`: contagem de registros no grupo
   - `propensity_score`: maior score do grupo
   - `status_cobranca_id`: do primeiro registro
   - Um `id` representativo (primeiro registro, usado para seleção/ações)
   - Lista de IDs originais para seleção em massa

2. **Remover colunas** da tabela:
   - "Parcela" (coluna `numero_parcela`)
   - "Pagamento" (coluna com ícone de status pago/pendente/quebrado)

3. **Ajustar coluna "Vencimento"**: exibir o primeiro (menor) vencimento do cliente agrupado

4. **Ajustar coluna "Valor"**: exibir valor total das parcelas pendentes do grupo

5. **Manter navegação**: clicar no nome continua levando a `/carteira/:cpf` (perfil do cliente com todas as parcelas)

6. **Ajustar seleção**: checkbox seleciona todos os IDs do grupo (para bulk actions como WhatsApp/Discador funcionarem com todas as parcelas)

7. **Ajustar export Excel**: exportar dados agrupados

**`src/components/carteira/CarteiraTable.tsx`** (se usado em outro lugar)
- Mesma lógica: remover coluna Parcela, agrupar por CPF

### Estrutura da linha agrupada

| Modelo | Nome | CPF | Credor | Vencimento (1º) | Valor Total | Score | Status Cobrança | Ações |
|--------|------|-----|--------|-----------------|-------------|-------|-----------------|-------|

### Observações
- Nenhuma alteração no banco de dados
- O perfil do cliente (`/carteira/:cpf`) já exibe todas as parcelas individuais
- Filtros continuam funcionando normalmente (aplicados antes do agrupamento)

