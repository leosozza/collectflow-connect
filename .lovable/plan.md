

# Plano: Normalizar telefones com validação completa (DDI + DDD + 9 dígitos)

## Problema

Os telefones no banco podem estar em diversos formatos:
- `11972583005` (11 dígitos — DDD + número com 9)
- `1172583005` (10 dígitos — DDD + número sem 9, fixo ou celular antigo)
- `5511972583005` (13 dígitos — já com DDI)
- `972583005` (9 dígitos — só o número sem DDD)

Atualmente o `whatsapp-sender.ts` envia o número bruto, sem normalização. Precisa garantir que o número final tenha **13 dígitos**: `55` + DDD(2) + número com 9(9).

## Correção

**Arquivo**: `supabase/functions/_shared/whatsapp-sender.ts`

Adicionar função `normalizePhoneBR` no topo e aplicar antes do envio em cada provedor:

```typescript
function normalizePhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, "");

  // Já tem 13 dígitos (55 + DDD + 9 dígitos) — ok
  if (digits.length === 13 && digits.startsWith("55")) return digits;

  // 12 dígitos com 55 — celular sem o 9 → inserir 9
  if (digits.length === 12 && digits.startsWith("55")) {
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }

  // 11 dígitos — DDD + 9 dígitos → prefixar 55
  if (digits.length === 11) return "55" + digits;

  // 10 dígitos — DDD + 8 dígitos (sem 9) → prefixar 55 + inserir 9
  if (digits.length === 10) {
    return "55" + digits.slice(0, 2) + "9" + digits.slice(2);
  }

  // 9 dígitos — só número sem DDD → não tem como resolver, retorna como está
  // 8 dígitos — fixo sem DDD → idem
  return digits;
}
```

Aplicar nos 3 pontos de envio:
- **Linha 35** (WuzAPI): `phone: \`${normalizePhoneBR(phone)}@s.whatsapp.net\``
- **Linha 51** (Gupshup): `destination: normalizePhoneBR(phone)`
- **Linha 74** (Evolution): `number: normalizePhoneBR(phone)`

## Resumo

| Arquivo | Alteração |
|---|---|
| `supabase/functions/_shared/whatsapp-sender.ts` | Adicionar `normalizePhoneBR` e aplicar nos 3 provedores |

Nenhuma alteração no frontend ou banco de dados.

