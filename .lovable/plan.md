## Diagnóstico do estado atual

Analisei o repositório após o push do Antigravity:

**Está consistente:**
- `docs/README.md` (Manual de Governança) presente, com as 4 regras críticas (multi-tenant, vault, metas, financeiro).
- `docs/rivo-vault/` com os 5 documentos restaurados (Diretrizes, Backend, Integrações, UI/UX, Checklist).
- `src/components/dashboard/DashboardMetaCard.tsx` importa corretamente `fetchMyGoals`, `fetchGoals` e `fetchTenantGoalsMode` de `@/services/goalService`.
- `src/services/goalService.ts` exporta as três funções + tipo `GoalsMode` e usa o modo (`global` / `per_credor` / `all`) para filtrar `credor_id IS NULL` ou `IS NOT NULL`.
- O modo é lido via `fetchTenantGoalsMode(tenantId)` e propagado nas `queryKey`, então a troca em "Gerenciar Metas" invalida e recalcula o card do Dashboard.

**Conclusão:** o ajuste do Antigravity está alinhado com o que implementamos. Não há mais sobreposição no fluxo de Metas — o R$ 255.000 não deve voltar enquanto o tenant estiver em modo `global` (e mesmo em `per_credor`, agora cada lado soma só o que lhe pertence).

---

## Por que aconteceu a sobreposição (root cause)

Duas IAs editando os **mesmos arquivos** sem um contrato compartilhado:

1. **Antigravity** mexia em camadas de UI/serviço sem saber das regras do Lovable (multi-tenant, separação Carteira × Acordos, status hierárquico).
2. **Lovable** corrigia, mas não havia documento "lei" no repositório — então a próxima edição do Antigravity reintroduzia o bug (ex.: somar global + per_credor).
3. Resultado: regressões cíclicas (meta voltou a 255k, tenant `y.brasil` com valores errados, etc.).

O `docs/README.md` que o Antigravity criou agora resolve o **vetor de comunicação**, mas precisamos formalizar o protocolo de trabalho para não recair.

---

## Plano: Protocolo Anti-Sobreposição (sem mudar código)

### 1. Reforçar o Manual de Governança (`docs/README.md`)
Adicionar 3 seções que faltam para fechar as brechas que já causaram regressões:

- **Separação de domínios**: `clients` (Carteira/dívida original) ≠ `agreements` (acordos comerciais). Nunca misturar nas queries.
- **Status hierárquico CPF-cêntrico**: ordem `QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA > INADIMPLENTE > EM DIA` — uma única IA não pode reordenar.
- **Modo de Metas (Global vs Per Credor)**: documentar que a fonte do modo é `tenants.settings.goals_mode` e que `DashboardMetaCard` **deve** filtrar por esse modo. Proibido somar os dois grupos.

### 2. Política de "quem edita o quê" (matriz de responsabilidade)
Criar `docs/IA_BOUNDARIES.md` com a matriz:

```text
Camada                          | Lovable | Antigravity
--------------------------------|---------|-------------
src/services/*                  |   ✅    |   ⚠ leitura
supabase/migrations             |   ✅    |   ❌
supabase/functions/*            |   ✅    |   ⚠ leitura
src/components/dashboard/*      |   ✅    |   ✅ (UI only)
src/components/gamificacao/*    |   ✅    |   ✅ (UI only)
docs/rivo-vault/*               |   ✅    |   ✅
RLS / SQL policies              |   ✅    |   ❌
```

Regra de ouro: **lógica de negócio e schema = Lovable**. **Refino visual e docs = ambos**.

### 3. Checklist obrigatório no topo de arquivos críticos
Adicionar comentário-cabeçalho em 4 arquivos sensíveis (somente comentário, sem alterar código):

- `src/components/dashboard/DashboardMetaCard.tsx`
- `src/services/goalService.ts`
- `src/components/gamificacao/GoalsManagementTab.tsx`
- `src/services/whatsappCampaignService.ts`

Formato:
```ts
/**
 * ⚠ ARQUIVO CRÍTICO — ler docs/README.md antes de editar.
 * Regras: multi-tenant, modo de metas (global|per_credor), nunca somar os dois.
 */
```

### 4. Procedimento de sincronização
Quando você for usar o Antigravity:
1. Sempre **publicar no Lovable antes** de pedir mudanças no Antigravity (estado limpo).
2. Antes de fazer push do Antigravity, ele deve ler `docs/README.md` e `docs/IA_BOUNDARIES.md`.
3. Após push, abrir o Lovable e pedir "analise o que mudou e valide contra docs/README.md" antes de qualquer nova feature.

---

## Resposta direta às suas perguntas

> **"Está ajustado agora?"**
Sim. Importações, exports e a lógica de filtro por modo estão íntegras. A meta não vai voltar a 255k enquanto o modo do tenant continuar `global`.

> **"Como não acontecer de novo?"**
Aprovar este plano para eu (a) ampliar o `docs/README.md` com as 3 seções faltantes, (b) criar o `docs/IA_BOUNDARIES.md` com a matriz, e (c) adicionar os cabeçalhos `⚠ ARQUIVO CRÍTICO` nos 4 arquivos sensíveis. Tudo só documentação/comentário — zero impacto em runtime.