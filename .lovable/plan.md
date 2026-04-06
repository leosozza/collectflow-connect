

# Plano: Implementar as 3 correções pendentes da Carteira

As alterações do plano anterior não foram aplicadas. Vou implementá-las agora.

## 1. Navegação com credor (CarteiraPage + CarteiraKanban)

**`src/pages/CarteiraPage.tsx`** linha 755 — adicionar `?credor=`:
```tsx
navigateWithOrigin(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}?credor=${encodeURIComponent(client.credor)}`)
```

**`src/components/carteira/CarteiraKanban.tsx`** linha 139 — mesma alteração:
```tsx
navigate(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}?credor=${encodeURIComponent(client.credor)}`, { state: { from: originUrl } })
```

## 2. Filtro por credor no ClientDetailPage

**`src/pages/ClientDetailPage.tsx`** — ler `credor` dos search params e aplicar filtro nas queries de clients e agreements quando presente.

## 3. Remover sort de status_cobranca

**`src/pages/CarteiraPage.tsx`** linhas 733-737 — trocar o botão por texto estático:
```tsx
<TableHead className="text-center">Status Cobrança</TableHead>
```

## Resumo

| Arquivo | Alteração |
|---|---|
| `CarteiraPage.tsx` | Navegação com credor + remover sort status_cobranca |
| `CarteiraKanban.tsx` | Navegação com credor |
| `ClientDetailPage.tsx` | Filtrar por credor do URL |

