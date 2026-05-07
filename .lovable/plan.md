## Causa raiz

Race condition em `src/hooks/useModules.ts` que faz "Contact Center" e "Gamificação" sumirem do menu no primeiro carregamento e voltarem após reabrir.

### O que está acontecendo

Em `AppLayout.tsx`, cada item do menu é filtrado por:
```ts
permissions.canViewGamificacao && isModuleEnabled("gamificacao")
permissions.canViewContactCenter && (contactCenterEnabled || ...)
```

Em `useModules.ts`:
```ts
const { data: enabledSlugs = [], isLoading } = useQuery({
  queryKey: ["enabled-modules", tenant?.id],
  queryFn: ...,
  enabled: !!tenant?.id && !isSuperAdmin,   // ⚠️
});

const isModuleEnabled = (slug) => {
  if (isSuperAdmin) return true;
  if (isLoading) return true;            // proteção contra "flash sem menu"
  return enabledSlugs.includes(slug);
};
```

O problema: quando `enabled = false` (tenant ainda não carregou), o React Query coloca a query em estado **`idle`**, não `loading`. Resultado: `isLoading === false` e `enabledSlugs === []`. A função então cai direto em `enabledSlugs.includes(slug) === false` → **todos os itens condicionados a `isModuleEnabled` somem do menu**.

Por que só "Contact Center" e "Gamificação" somem? Porque os outros itens ("Dashboard", "Carteira", "Financeiro", "Automação", "Cadastros") são módulos absorvidos pelo CRM (`CRM_ABSORBED_SLUGS`) ou nem são checados via `isModuleEnabled` — então passam mesmo com `enabledSlugs = []`. "Gamificação" e "Contact Center" são os únicos que dependem do slug específico estar presente.

Quando você sai e entra de novo, o React Query rehidrata do cache (chave `["enabled-modules", tenant.id]`), os slugs já vêm prontos no primeiro render → menu completo.

## Correção

Em `src/hooks/useModules.ts`, alterar o guard para também tratar "tenant ainda não disponível" como loading:

```ts
const isModuleEnabled = useCallback(
  (slug: string): boolean => {
    if (isSuperAdmin) return true;
    // Enquanto tenant não carregou OU query ainda está rodando,
    // considera tudo habilitado para evitar sumir item do menu.
    if (!tenant?.id || isLoading) return true;

    if (CRM_ABSORBED_SLUGS.includes(slug)) {
      return enabledSlugs.includes("crm") || enabledSlugs.includes(slug);
    }
    return enabledSlugs.includes(slug);
  },
  [isSuperAdmin, isLoading, enabledSlugs, tenant?.id]
);
```

Mudança mínima: 1 arquivo, 2 linhas (`!tenant?.id ||` no guard + `tenant?.id` nas deps).

## Por que a correção é segura

- Não altera lógica para super admin (já retorna `true`).
- Quando o tenant existir e a query terminar, volta ao comportamento atual (`enabledSlugs.includes`).
- Não deixa nenhum item indevido visível em runtime real: se o módulo está realmente desabilitado, o `ModuleGuard`/RLS bloqueia a página ao tentar abrir. O guard atual já tem essa filosofia para o estado `isLoading`.

## Validação

1. Hard refresh em `/dashboard` (Ctrl+F5) — "Gamificação" e "Contact Center" devem aparecer já no primeiro paint.
2. Abrir uma aba anônima e logar — mesmo comportamento.
3. Tenant que tem o módulo realmente desabilitado: a página continua bloqueada pelo `ModuleGuard` (verificação real do backend).

## Escopo

- 1 arquivo: `src/hooks/useModules.ts`.
- Sem mudança de RLS, RPC, edge function ou schema.
- Sem alteração em `usePermissions`, `useTenant` ou `AppLayout`.
