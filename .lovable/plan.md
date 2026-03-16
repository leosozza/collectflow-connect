

# Fix AtendimentoPage: read clientId from query parameter

## Problem
The previous fix changed the navigation from `/atendimento/:id` to `/atendimento?clientId=...`, but `AtendimentoPage` still uses `useParams` to extract `id`. Since there's no route param, `id` is always `undefined`, causing "Cliente nao encontrado".

## Solution
In `src/pages/AtendimentoPage.tsx`:

1. Import `useSearchParams` from `react-router-dom` (or use `useLocation`)
2. Replace `const { id } = useParams()` with reading from query params:
   ```ts
   const [searchParams] = useSearchParams();
   const id = searchParams.get("clientId");
   ```
3. No other changes needed -- all downstream references to `id` remain the same since it's still a string.

Single file change, single line modification.

