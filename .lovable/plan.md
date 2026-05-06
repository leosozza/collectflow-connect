## Objetivo

Remover a opção **"Outro"** dos seletores de Meio de Pagamento na confirmação manual, forçando operadores a escolher: PIX, Boleto, Cartão, Dinheiro ou Transferência. Registros históricos já gravados como "Outro" permanecem intactos.

## Alterações (somente frontend)

1. **`src/components/acordos/ManualPaymentDialog.tsx`** (linha 31)
   - Remover `{ value: "Outro", label: "Outro" }` da lista de opções.

2. **`src/components/acordos/PaymentConfirmationTab.tsx`** (linha 25)
   - Alterar `PAYMENT_METHODS` para `["PIX", "Boleto", "Cartão", "Dinheiro", "Transferência"]`.

## O que NÃO será alterado (proteções)

- **Banco de dados**: nenhuma migração. Linhas existentes com `payment_method = 'Outro'` ficam preservadas.
- **`BaixasRealizadasPage.tsx`**: o filtro "Meio" é populado dinamicamente a partir dos dados (`useMemo` sobre `rows`), então "Outro" continuará aparecendo no filtro **apenas** enquanto existirem baixas históricas com esse valor — comportamento correto, não quebra nada.
- **Exportação Excel**: continua funcionando normalmente; o valor é apenas uma string.
- **Outras ocorrências de "Outro"** no codebase (CRM Leads, CredorForm bancos/gateways, etc.) **não serão tocadas** — são contextos diferentes.

## Validação pós-mudança

- Abrir `ManualPaymentDialog` (Acordos → confirmar pagamento manual): selector mostra apenas as 5 opções.
- Abrir `PaymentConfirmationTab`: idem.
- Página **Baixas Realizadas**: registros antigos com "Outro" continuam visíveis e filtráveis.