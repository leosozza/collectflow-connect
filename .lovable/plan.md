

# Plano: Corrigir acesso ao MaxList para tenant Y.BRASIL

## Problema

O MaxList não abre porque tanto o frontend (`MaxListPage.tsx`, linha 55) quanto o backend (`maxsystem-proxy/index.ts`, linha 14) restringem acesso aos slugs `["maxfama", "temis"]`. O tenant atual tem slug `ybrasil`, que não está na lista. O componente redireciona para `/` imediatamente.

## Alterações

### 1. `src/pages/MaxListPage.tsx`
- Adicionar `"ybrasil"` ao array `ALLOWED_SLUGS` na linha 55

### 2. `supabase/functions/maxsystem-proxy/index.ts`
- Adicionar `"ybrasil"` ao array `ALLOWED_SLUGS` na linha 14

## Resultado
Ambos os arrays passarão a ser `["maxfama", "temis", "ybrasil"]`, permitindo o acesso ao MaxList pelo tenant Y.BRASIL.

