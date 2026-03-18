

# Correção do envio de mailing para 3CPlus

## Problema

A API do 3CPlus retorna erro 422: `"O campo Telefone é obrigatório"` no path `mailing.0.phone`. O payload atual usa `areacodephone` como campo de telefone, mas a API espera `phone`.

## Causa

No edge function `threecplus-proxy`, o `send_mailing` envia:
- **header**: `['identifier', 'areacodephone', ...]`
- **mailing**: objetos com campo `areacodephone`

A API 3CPlus exige o campo `phone` (não `areacodephone`).

## Correção

### 1. Edge function (`supabase/functions/threecplus-proxy/index.ts`)

Alterar o header e o mapeamento do mailing de `areacodephone` para `phone`:

```js
header: ['identifier', 'phone', 'Nome', 'Extra1', 'Extra2', 'Extra3'],
```

### 2. Componente de teste (`src/components/integracao/ThreeCPlusTab.tsx`)

No `MailingTestCard`, alterar o payload de teste:

```js
// De:
areacodephone: testPhone.replace(/\D/g, ""),
// Para:
phone: testPhone.replace(/\D/g, ""),
```

### 3. Qualquer outro ponto que monte mailings

Verificar se há outros locais no código que enviam `areacodephone` ao `send_mailing` e corrigir para `phone`.

## Resultado

O payload enviado à API ficará:
```json
{"identifier":"00000000000","phone":"11945542245","Nome":"Contato Teste",...}
```

Alinhado com o que a API 3CPlus exige.

