

# Tornar nome do cliente clicável em /acordos — todas as views

## Situação atual

- `AgreementsList.tsx` — **já tem** nome clicável (navega para `/carteira/:cpf?tab=acordo`)
- `PaymentConfirmationTab.tsx` — nome do cliente é **texto simples** (linha 157), sem link

## Solução

### Arquivo: `src/components/acordos/PaymentConfirmationTab.tsx`

Adicionar `useNavigate` e tornar o nome do cliente clicável na tabela de baixas manuais, com a mesma lógica já usada em `AgreementsList`:

```tsx
// Linha 157 — de:
<TableCell className="font-medium">{p.agreement?.client_name || "—"}</TableCell>

// Para:
<TableCell>
  <span
    className="font-medium cursor-pointer text-primary hover:underline"
    onClick={() => {
      const cpf = p.agreement?.client_cpf?.replace(/\D/g, "");
      if (cpf) navigate(`/carteira/${cpf}?tab=acordo`);
    }}
  >
    {p.agreement?.client_name || "—"}
  </span>
</TableCell>
```

Importar `useNavigate` de `react-router-dom` e instanciar no componente.

### Resultado
- Nome clicável em **todas** as abas de `/acordos` (lista principal + baixas manuais)
- Ao clicar, abre o perfil do devedor direto na aba de acordo

