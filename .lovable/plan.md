

## Revisão das mudanças recentes — bugs encontrados

Após revisar `addressEnrichmentService.ts`, `ClientDetailHeader.tsx`, `AgreementCalculator.tsx`, `InlineEditableField.tsx` e o Edge `generate-agreement-boletos`, identifiquei **5 problemas reais** introduzidos nas últimas alterações. Eles afetam: edição inline, formalização de acordos, performance da carteira e consistência de dados. Não impactam diretamente score, WhatsApp ou discador (esses módulos não foram tocados).

### 🔴 Bug 1 — `updateSingleField` invalida todas as queries `["clients"]` (impacto severo na carteira)
`ClientDetailHeader.tsx` linhas 273 e 310 chamam `invalidateQueries({ queryKey: ["clients"] })` sem `exact: true`. Isso invalida **todas** as queries que começam com `["clients"]` — listagem da carteira (170k+ linhas), agrupamentos, contadores, filtros etc. **Cada CEP digitado dispara 4 chamadas** de `updateSingleField` em paralelo (rua/bairro/cidade/UF), forçando 4 refetches da carteira inteira. Isso causa congelamento perceptível e, com paginação grande, pode travar a aba.

**Correção:** invalidar somente `["client-detail", cpf]` (mais preciso) ou usar `refetchType: "none"` no `["clients"]` para apenas marcar stale, sem refetch imediato.

### 🔴 Bug 2 — Loop de re-render no `InlineEditableField` ao auto-preencher CEP
O `useEffect` de auto-lookup (linha 48) tem `onCepResolved` no array de dependências. No `ClientDetailHeader` linha 599, `onCepResolved` é uma **arrow function inline** recriada a cada render. Sequência:
1. Usuário digita 8 dígitos → effect roda → `onCepResolved` chama 4 `updateSingleField` → invalidação → re-render do header → nova função `onCepResolved` → effect roda **de novo** (mesmo CEP).
O `lastLookupRef` previne novo fetch HTTP, mas **a chamada `onCepResolved` é re-executada toda vez** porque o guard só cobre o lookup, não o callback. Isso pode disparar múltiplos updates duplicados no banco.

**Correção:** mover guard de `lastLookupRef` para englobar também a chamada de `onCepResolved`, ou envolver `onCepResolved` em `useCallback` no pai.

### 🟠 Bug 3 — `updateClientMutation` faz UPDATE sequencial em loop (lento)
Linhas 240-243 e 296-301: o código faz `for (const id of clientIds) { await supabase.update(...).eq("id", id) }`. Para um CPF com 30 parcelas isso vira 30 round-trips sequenciais. Já era assim antes, mas agora o problema piora porque cada update dispara invalidação ampla (Bug 1).

**Correção:** trocar por um único `update(...).in("id", clientIds)` (compatível com a regra de campos compartilhados; campos unique já são tratados separadamente).

### 🟠 Bug 4 — Race condition no `enrichClientAddress` durante formalização
`AgreementCalculator.handleSubmit` (linhas 470-482) chama `await enrichClientAddress` **mas não usa o retorno**. Em seguida cria o acordo e invoca `generate-agreement-boletos`, que **lê `client_profiles` via fetch separado**. Se o `upsertClientProfile` dentro do enrich ainda não estiver visível para a próxima leitura (replicação/cache do PostgREST), o Edge pode encontrar dados vazios e marcar `boleto_pendente: true` mesmo após o enrich ter sucesso.

**Correção:** após enrich bem-sucedido, rechecar via `checkRequiredFields()` antes de criar o acordo. Se ainda faltar, abrir o diálogo de campos faltantes em vez de seguir cego para a geração de boletos.

### 🟡 Bug 5 — `updateClientMutation` não persiste `bairro` em `client_profiles`
Linhas 256-267: o upsert canônico inclui `endereco`, `cidade`, `uf`, `cep` mas **omite `bairro`**. O bairro é gravado em `clients` (linha 232) porém não em `client_profiles`. Como o Edge de boletos lê primeiro o profile, o operador edita o bairro no diálogo, salva, e o Edge ainda vê profile sem bairro até o fallback rodar. Isso reintroduz parcialmente o bug original.

**Correção:** incluir `bairro: (data.bairro || "").trim()` no payload do `upsertClientProfile`.

### 🟢 Verificações que passaram (sem alterações de risco)
- `viaCep.ts` está correto e isolado.
- `ClientForm.tsx` — `bairro` agora vai no payload e o auto-trigger funciona.
- Edge `generate-agreement-boletos` — fallback consolidado e validação de `bairro` estão OK.
- `addressEnrichmentService.ts` — normalização de CPF e sync dual estão OK.
- **Score, WhatsApp, discador, APIs**: nenhum dos arquivos relacionados (`useScoreRecalc`, `whatsappCampaignService`, `dispositionAutomationService`, `threecplus-proxy`, `negociarie-proxy`) foi tocado. Logs do `threecplus-proxy` mostram fluxo saudável (200s contínuos).

### Plano de correção

**1. `src/components/client-detail/ClientDetailHeader.tsx`**
- `updateSingleField`: trocar `invalidateQueries({ queryKey: ["clients"] })` por `invalidateQueries({ queryKey: ["clients"], refetchType: "none" })`. Manter o invalidate exato em `["client-detail", cpf]`.
- `updateClientMutation`: mesma mudança nas invalidações.
- Substituir o loop de `update().eq("id", id)` por um único `update(sharedData).in("id", clientIds)`. Manter a chamada extra para campos unique (`cod_contrato`, `external_id`) restrita ao `clientIds[0]`.
- Adicionar `bairro` ao payload de `upsertClientProfile` no `updateClientMutation` (linhas 256-267).
- Envolver o `onCepResolved` da linha 599 em `useCallback` para estabilizar a referência.

**2. `src/components/client-detail/InlineEditableField.tsx`**
- Mover o set de `lastLookupRef.current` para **antes** de chamar `onCepResolved`, e adicionar guard explícito: se o CEP já foi resolvido, não chamar `onCepResolved` de novo, mesmo se a função mudou de identidade.
- Alternativa mais robusta: remover `onCepResolved` do array de deps do `useEffect` e usar uma `ref` para chamá-lo sempre na versão atual.

**3. `src/components/client-detail/AgreementCalculator.tsx`**
- Após `enrichClientAddress`, rechamar `checkRequiredFields()`. Se ainda houver campos faltantes, abrir o diálogo `missingFieldsOpen` antes de criar o acordo, em vez de criar acordo + tentar boleto + cair no `boleto_pendente`.

### Validação esperada

1. Editar CEP inline no perfil → 1 toast "Endereço preenchido", 4 campos atualizados, **sem travar a navegação** entre clientes.
2. Carteira aberta em outra aba não dá flash de loading a cada edição inline.
3. Formalizar acordo sem endereço → enrich roda, recheck confirma sucesso, boletos geram na primeira tentativa (sem `boleto_pendente`).
4. Salvar pelo diálogo "Editar Dados" → bairro aparece imediatamente no Edge na próxima geração de boleto.
5. Score, WhatsApp e discador continuam funcionando (não foram alterados).

### Fora de escopo
- Refatorar a estratégia geral de cache do TanStack Query.
- Mudar a fonte canônica `client_profiles`.
- Alterar Edge Functions de score, WhatsApp, 3CPlus ou Negociarie.

