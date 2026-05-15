# Correção global: Acordos não aparecem no perfil de NENHUM cliente

## Diagnóstico confirmado

Verifiquei o banco da Y.BRASIL: o acordo da Gabriella Rocha Costa (criado pela Maria Eduarda em 20/04/2026, R$ 1.761,90, status `pending`) **existe normalmente**. O dado está certo — o problema é 100% front-end e afeta **todos os clientes**, não só esse.

## Causa raiz (única, global)

Em `src/pages/ClientDetailPage.tsx`, a query que carrega os acordos do perfil (linha 218) está com:

```ts
enabled: !!cpf
```

A rota da Carteira para o perfil é `/carteira/perfil/:id` — abre pelo UUID do registro mestre, **sem `:cpf` na URL**. Resultado: `cpf` é `undefined`, a query **nunca dispara** e a aba "Acordos" sempre mostra "Nenhum acordo registrado", para qualquer cliente acessado por essa rota.

A query irmã de `clients` (linha 176) já tem o `enabled` correto (`!!(cpf || id) && !!tenant?.id`) e resolve `targetCpf`/`targetCredor` a partir do `id`. A regressão foi só na query de `agreements`.

Há ainda uma fragilidade: dentro do `queryFn` de agreements, a resolução do CPF tenta usar `clients.find(...)` em memória, mas `clients` não está em `queryKey`/`enabled` — corrida potencial. Vou alinhar com o padrão da query de `clients` (buscar o master direto no Supabase).

## Mudança (mínima e cirúrgica)

Arquivo único: `src/pages/ClientDetailPage.tsx`, bloco da query `agreements` (linhas 218–267).

1. Trocar `enabled: !!cpf` por `enabled: !!(cpf || id) && !!tenant?.id` (igual à query `clients`).
2. No `queryFn`, quando houver `id`, buscar o master via `supabase.from("clients").select("cpf, credor").eq("id", id).eq("tenant_id", tenant.id).maybeSingle()` em vez de depender do array `clients` em memória.
3. Manter intactos: filtro `tenant_id`, OR de `client_cpf` com/sem máscara, filtro de `credor`, enriquecimento de `creator_name`, ordenação `created_at desc`.

Sem mudanças de schema, RLS, edge functions ou regra de negócio. Sem impacto em Dashboard, Baixas Realizadas, Ranking ou qualquer outra tela.

## Validação

- Abrir o perfil da Gabriella (`/carteira/perfil/8b0078fa-...?credor=TESS+MODELS...`) como admin Y.BRASIL → aba **Acordos** deve listar o `pending` da Maria Eduarda (R$ 1.761,90) e o `cancelled` anterior.
- Abrir 2–3 outros clientes da Carteira (ex: um com acordo vigente, um sem acordo) → vigentes aparecem, "sem acordo" continua mostrando vazio corretamente.
- Spot-check em rota legada com `:cpf` (se ainda houver entrada por essa rota) para garantir não-regressão.
