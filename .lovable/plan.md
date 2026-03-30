

# Plano: Habilitar pesquisa por telefone e e-mail na Carteira

## Resumo

A pesquisa atual em `/carteira` busca apenas por **nome** e **CPF**. Adicionar telefone e e-mail ao filtro de busca.

---

## Mudança única

**Arquivo**: `src/services/clientService.ts` (linhas 83-91)

Expandir o `.or()` do Supabase para incluir `phone`, `phone2`, `phone3` e `email`:

```typescript
if (filters?.search?.trim()) {
  const term = filters.search.trim();
  const cleanTerm = term.replace(/\D/g, "");
  if (cleanTerm.length > 0 && cleanTerm === term.replace(/[.\-\/\s]/g, "")) {
    // Numeric input: search CPF + phones
    query = query.or(
      `nome_completo.ilike.%${term}%,cpf.ilike.%${cleanTerm}%,phone.ilike.%${cleanTerm}%,phone2.ilike.%${cleanTerm}%,phone3.ilike.%${cleanTerm}%,email.ilike.%${term}%`
    );
  } else {
    // Text input: search name + email + CPF
    query = query.or(
      `nome_completo.ilike.%${term}%,cpf.ilike.%${term}%,phone.ilike.%${term}%,phone2.ilike.%${term}%,phone3.ilike.%${term}%,email.ilike.%${term}%`
    );
  }
}
```

Nenhum outro arquivo precisa ser alterado. O campo de busca existente na UI já suporta texto livre.

