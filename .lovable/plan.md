

# Plano: Corrigir leitura dos logs de higienização

## Problema

A tabela `enrichment_logs` armazena apenas `data_returned` (JSONB) com o objeto completo retornado pela API. O frontend tenta ler colunas `phones_found`, `emails_found` e `error_message` que não existem, resultando em dados sempre vazios ("Telefones: -", "Email: -").

## Solução

No `EnrichmentConfirmDialog.tsx`, ao mapear os logs (linhas 146-155 e 171-176), extrair telefones e emails de dentro de `data_returned`, usando a mesma lógica de extração da edge function:

```ts
// Extrair phones de data_returned
const raw = l.data_returned || {};
const phones: string[] = [];
if (Array.isArray(raw.telefones)) {
  raw.telefones.forEach(t => {
    const num = typeof t === "string" ? t : t.numero || t.telefone || "";
    if (num) phones.push(num);
  });
} else if (raw.celular) phones.push(String(raw.celular));

const emails: string[] = [];
if (Array.isArray(raw.emails)) {
  raw.emails.forEach(e => {
    const addr = typeof e === "string" ? e : e.email || "";
    if (addr) emails.push(addr);
  });
} else if (raw.email) emails.push(raw.email);

const errorMsg = raw.error || null;
```

Aplicar nos dois locais:
1. `setLogs` mapping (linha 146-155) — popular `phones_found`, `emails_found`, `error_message` a partir de `data_returned`
2. Toast "Copiar Log" (linha 171-176) — mesma extração

## Arquivo modificado

| Arquivo | Alteração |
|---------|-----------|
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Extrair phones/emails/error de `data_returned` |

