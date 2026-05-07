# Matriz de Responsabilidade — Lovable × Antigravity

> Documento obrigatório. Toda IA deve ler **antes** de editar este repositório.
> Complementa `docs/README.md`.

## Por que este documento existe

Duas IAs editando os mesmos arquivos sem contrato compartilhado geraram regressões cíclicas
(meta voltando a R$ 255.000, valores errados em `y.brasil`, sobreposição de schema, etc.).
A matriz abaixo elimina esse vetor de conflito.

## Matriz de quem pode editar o quê

| Camada                                  | Lovable | Antigravity |
|-----------------------------------------|:-------:|:-----------:|
| `src/services/*` (lógica de negócio)    |   ✅    | ⚠ leitura   |
| `supabase/migrations/*`                 |   ✅    |     ❌      |
| `supabase/functions/*` (edge)           |   ✅    | ⚠ leitura   |
| RLS / SQL policies / triggers           |   ✅    |     ❌      |
| `src/integrations/supabase/*`           |   ✅    |     ❌      |
| `src/components/dashboard/*` (UI only)  |   ✅    |     ✅      |
| `src/components/gamificacao/*` (UI only)|   ✅    |     ✅      |
| Demais `src/components/*` (UI/estilo)   |   ✅    |     ✅      |
| `docs/rivo-vault/*`                     |   ✅    |     ✅      |
| `docs/README.md` / `docs/IA_BOUNDARIES.md` |  ✅  | ⚠ proposta  |
| `package.json` / lockfiles              |   ✅    |     ❌      |

**Regra de ouro:**
- **Lógica de negócio, schema, RLS e edge functions = Lovable.**
- **Refino visual e documentação = ambos.**

## Procedimento de sincronização

1. **Antes** de pedir mudanças no Antigravity, **publique no Lovable** (estado limpo).
2. Antes de fazer push pelo Antigravity, ele deve ler `docs/README.md` e este arquivo.
3. **Após** o push do Antigravity, abra o Lovable e peça:
   *"Analise o que mudou e valide contra `docs/README.md` antes de qualquer nova feature."*
4. Se ambos editarem o mesmo arquivo crítico (cabeçalho `⚠ ARQUIVO CRÍTICO`), o Lovable é a fonte da verdade.
5. Quando uma prop for marcada como obrigatória num componente `⚠ ARQUIVO CRÍTICO` (ex.: `tenantId` em `DashboardMetaCard`), nenhuma IA pode removê-la do callsite sem registrar o motivo em `docs/README.md`.

## Arquivos com cabeçalho `⚠ ARQUIVO CRÍTICO`

Estes arquivos têm comentário-cabeçalho exigindo leitura de `docs/README.md` antes de qualquer edição:

- `src/components/dashboard/DashboardMetaCard.tsx`
- `src/services/goalService.ts`
- `src/components/gamificacao/GoalsManagementTab.tsx`
- `src/services/whatsappCampaignService.ts`

Esta lista cresce conforme novas regressões forem identificadas.
