

# Plano: Corrigir tabulação, pausa e intervalos do operador

## Problemas identificados

### 1. Tabulações não carregam — action inexistente
O dashboard chama `invoke("campaign_qualifications", { campaign_id })` mas **essa action não existe no proxy**. Resultado: as qualificações retornam erro 400 silenciosamente e a lista fica vazia. O proxy tem `list_qualification_list_items` que aceita `list_id`, não `campaign_id`.

### 2. Sistema fica em pausa após tabular na ficha
O `qualifyOn3CPlus` usa `callId` que vem como prop do componente. Se o `callId` é `undefined`, o fallback usa `"current"` (linha 334 do dispositionService). A API 3CPlus não aceita `"current"` como call_id — a qualificação falha silenciosamente. Mas o `sessionStorage` recebe `3cp_qualified_from_disposition`, suprimindo a tela ACW fallback. Resultado: agente fica preso em pausa sem opção de sair.

### 3. Intervalos não aparecem para o operador
`loadPauseIntervals` busca o `work_break_group_id` primeiro em `campaigns.find()`, mas para operadores o `campaigns` array está **vazio** (a `list_campaigns` global não é chamada). O fallback `campaign_details` funciona, mas depende de encontrar a chave certa na resposta. Alternativamente, os dados da campanha já existem em `agentCampaigns`.

## Correções

### 1. `supabase/functions/threecplus-proxy/index.ts` — Adicionar action `campaign_qualifications`

Novo case que busca detalhes da campanha para obter `qualification_list`, depois busca os itens dessa lista:

```
case 'campaign_qualifications':
  // GET /campaign/{id} → pega qualification_list id
  // GET /qualification_lists/{list_id}/qualifications → retorna itens
```

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**Corrigir intervalos** — No `loadPauseIntervals`, usar `agentCampaigns` como fonte além de `campaigns`:

```typescript
const allCampaigns = [...campaigns, ...agentCampaigns];
const campaign = allCampaigns.find(c => c.id === campaignId || String(c.id) === String(campaignId));
```

**Corrigir callId para qualify** — Passar o `lastCallId` (do sessionStorage ou state) como callId ao `AtendimentoPage` embedded, em vez de depender do `activeCall` que já foi limpo quando a chamada terminou.

**Corrigir flag de qualified** — Se `qualifyOn3CPlus` falhar (catch), NÃO setar `3cp_qualified_from_disposition`. Mover o `sessionStorage.setItem` para dentro do `.then()` somente se o qualify realmente teve sucesso (checar resposta).

### 3. `src/pages/AtendimentoPage.tsx`

Verificar se `qualifyOn3CPlus` retornou sucesso antes de setar a flag. Adicionar verificação do resultado:

```typescript
qualifyOn3CPlus({...})
  .then((result) => {
    // Só marcar como qualificado se realmente funcionou
    if (result !== false) {
      sessionStorage.setItem("3cp_qualified_from_disposition", "true");
    }
  })
```

### 4. `src/services/dispositionService.ts`

Modificar `qualifyOn3CPlus` para retornar `boolean` indicando sucesso/falha, em vez de swallow silencioso.

## Fluxo corrigido

```text
Operador loga na campanha
  → Salva campaign_id no sessionStorage ✓
  → loadPauseIntervals busca em agentCampaigns (não vazio) ✓
  → Intervalos aparecem ✓

Ligação cai → ficha do cliente abre
  → lastCallId salvo no state e sessionStorage ✓
  → callId passado corretamente ao AtendimentoPage ✓

Operador tabula na ficha
  → qualifyOn3CPlus usa callId real (não "current") ✓
  → Se qualify sucesso → flag setada → ACW screen suprimida ✓
  → Se qualify falha → flag NÃO setada → ACW fallback aparece ✓
  → Agente retorna ao idle automaticamente ✓
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/threecplus-proxy/index.ts` | Nova action `campaign_qualifications` |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Usar `agentCampaigns` nos intervalos; passar `lastCallId` correto |
| `src/pages/AtendimentoPage.tsx` | Verificar sucesso do qualify antes de setar flag |
| `src/services/dispositionService.ts` | Retornar boolean de sucesso em `qualifyOn3CPlus` |

