

# Trocar "ASSESSORIA" por "COBRADORA" no campo Recebedor

## Análise

O campo "Recebedor" aparece em dois componentes:

1. **`PaymentConfirmationTab.tsx`** (linha 26): Define a constante `RECEIVERS = ["CREDOR", "ASSESSORIA"]` usada no diálogo de edição de informações da parcela
2. **`ManualPaymentDialog.tsx`**: Usa opções fixas `CREDOR` e `COBRADORA` (linhas 109-110)

## Alterações necessárias

### Arquivo: `src/components/acordos/PaymentConfirmationTab.tsx`

**Linha 26:**
```typescript
// De:
const RECEIVERS = ["CREDOR", "ASSESSORIA"];

// Para:
const RECEIVERS = ["CREDOR", "COBRADORA"];
```

## Verificação de impacto

- A mudança é apenas visual/UI — o valor armazenado no banco (`receiver`) será "COBRADORA" ao invés de "ASSESSORIA"
- O `ManualPaymentDialog.tsx` já usa "COBRADORA" corretamente
- Esta alteração unifica a nomenclatura entre os dois componentes

