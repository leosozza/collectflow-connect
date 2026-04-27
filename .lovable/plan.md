## Diagnóstico

Sim, é exatamente isso. Confirmei no código (`src/pages/ClientDetailPage.tsx`, linha 641):

```tsx
{agreement.status === "cancelled" && !hasActiveAgreement && (
  <Button ...>Reabrir</Button>
)}
```

O botão **"Reabrir"** só aparece quando o acordo está com status **`cancelled`** (Cancelado). Acordos com status **`completed`** (Quitado) não têm a opção exposta na UI.

Isso é uma decisão de design intencional: tradicionalmente, "reabrir" foi pensado para reverter cancelamentos, não quitações. Mas no caso da Renata Cibin (e outros casos legítimos de baixa indevida / estorno), faz sentido permitir reabrir um acordo `completed` também.

## Plano proposto

### 1. UI — Liberar botão "Reabrir" também para `completed`
**Arquivo:** `src/pages/ClientDetailPage.tsx` (linha 641)

Trocar a condição:
```tsx
// Antes
agreement.status === "cancelled" && !hasActiveAgreement

// Depois
["cancelled", "completed"].includes(agreement.status) && !hasActiveAgreement
```

Ajustar também o texto do `AlertDialog` de confirmação (linha 802) para deixar claro o efeito quando o acordo estava quitado: "O acordo voltará ao status Vigente. Parcelas pagas permanecem pagas — use o botão de reabrir parcelas individuais se precisar estornar pagamentos."

### 2. Service — Garantir que `reopenAgreement` aceita `completed`
**Arquivo:** `src/services/agreementService.ts` (função `reopenAgreement`, linha 791)

Verificar/ajustar a guarda de status para aceitar tanto `cancelled` quanto `completed` como entrada válida. Ao reabrir:
- Status do acordo → `approved` (vigente)
- Marcar títulos/clients vinculados como "em acordo" (já existe na função)
- Registrar `client_event` `agreement_reopened` (já existe)
- **Não mexer no status das parcelas individuais** — se o acordo estava `completed`, as parcelas estão `paid`. O operador decide depois se reabre parcelas pagas via o fluxo já existente (`reabrir_parcelas`, linha 130).

### 3. Auditoria
A função `reopenAgreement` já registra em `audit_logs` e `client_events` (`agreement_reopened`) com `reopened_by: userId`. Mantém igual.

### 4. Sem mudanças de schema
Nenhuma migração necessária. Apenas frontend + ajuste leve no service.

## Resultado esperado
- Na página da Renata Cibin (e qualquer outro acordo `completed`), o botão "Reabrir" aparecerá ao lado do badge de status, desde que o cliente não tenha outro acordo ativo no mesmo credor.
- Ao clicar, o acordo volta a `approved` (Vigente). Se houver baixa indevida, o operador usa em seguida o fluxo de "Reabrir parcela" para reverter pagamentos específicos.

Confirma que quer liberar também para `completed`, ou prefere uma permissão extra (ex.: só admin pode reabrir quitados)?