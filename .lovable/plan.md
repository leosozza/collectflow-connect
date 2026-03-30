

# Plano: Corrigir Leitura de Metricas de Campanha 3CPlus

## Causa Raiz

O proxy retorna `{ ...data, status: 200, success: true }`. Quando a 3CPlus retorna `{ data: { total_dialed: 100 } }`, o proxy devolve `{ data: { total_dialed: 100 }, status: 200, success: true }`. O frontend salva esse objeto inteiro em `campaignMetrics[cid]` e depois tenta ler `m.total_dialed` — mas o valor real está em `m.data.total_dialed`. O mesmo problema afeta `campaignListsMetrics`, `campaignAgentsMetrics` e `campaignQualifications`.

## Correções

### 1. Helper de extração de objeto único (`threecplusUtils.ts`)

Adicionar `extractObject(data)` que desempacota respostas de objeto único:
```typescript
export function extractObject(data: any): Record<string, any> {
  if (!data || typeof data !== 'object') return {};
  // Se tem .data e .data é objeto (não array), desempacota
  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    // Pode ter data.data.data (3CPlus inconsistente)
    if (data.data.data && typeof data.data.data === 'object' && !Array.isArray(data.data.data)) {
      return data.data.data;
    }
    return data.data;
  }
  // Remove campos do proxy (status, success) e retorna o resto
  const { status, success, ...rest } = data;
  return rest;
}
```

### 2. CampaignsPanel.tsx — Corrigir `loadCampaignDetails`

- `totalMetrics`: usar `extractObject(totalMetrics)` antes de salvar em `campaignMetrics`
- `listsMetrics`: já usa `extractList` — OK
- `agentsMetricsRes`: já usa `extractList` — OK
- `qualsRes`: já usa `extractList` — OK

Na aba **Visão Geral** (linha 525-538), aplicar fallbacks robustos nos campos:
```typescript
const m = campaignMetrics[cid] || {};
const dialed = m.total_dialed ?? m.dialed ?? m.total_calls ?? m.total ?? 0;
const answered = m.answered ?? m.connected ?? m.delivered ?? 0;
const abandoned = m.abandoned ?? m.dropped ?? 0;
const asr = m.asr ?? (dialed > 0 ? (answered / dialed * 100) : null);
const talkTime = m.average_talk_time ?? m.avg_talk_time ?? m.talk_time_avg ?? 0;
const inQueue = m.in_queue ?? m.pending ?? m.queue ?? 0;
const completed = m.completed ?? m.completion ?? 0;
const noAnswer = m.no_answer ?? m.unanswered ?? 0;
```

### 3. CampaignOverview.tsx (Dashboard) — Mesma correção

Na `TelefoniaDashboard`, as campanhas são enriquecidas com `statistics` via `campaign_statistics`. O mesmo problema: `c.statistics` pode conter `{ data: {...}, status, success }`. Aplicar `extractObject` ao resultado antes de mesclar:
```typescript
const stats = await invoke("campaign_statistics", { campaign_id: c.id });
return { ...c, statistics: extractObject(stats) };
```

Depois em `normalizeCampaignStatus`, os campos já buscam de `c.statistics?.total_records` etc — com o unwrap correto, passarão a funcionar.

### 4. Proxy — Melhorar logs diagnósticos

Na resposta final (linha 1199-1208), adicionar log da shape:
```typescript
const shape = Array.isArray(data) ? `array[${data.length}]` 
  : data?.data ? (Array.isArray(data.data) ? `{data:array[${data.data.length}]}` : `{data:object}`)
  : 'object';
console.log(`3CPlus response: ${response.status} shape=${shape}`);
```

### 5. Qualificações — Separar configuração de estatística

Na aba Qualificações, o endpoint `campaign_qualifications` retorna os items da lista de qualificação (configuração), não resultados estatísticos. Adicionar nota visual: "Lista de qualificações configuradas. Resultados quantitativos disponíveis em Produtividade." Remover a tentativa de calcular percentual quando `q.count` é null.

### 6. Barra de progresso no `normalizeCampaignStatus`

Após o unwrap, os campos `statistics.total_records` e `statistics.worked_records` serão lidos corretamente. Adicionar fallbacks extras:
```typescript
const total = c.statistics?.total_records ?? c.statistics?.total 
  ?? c.total_records ?? c.total ?? c.statistics?.mailing_total ?? 0;
const worked = c.statistics?.worked_records ?? c.statistics?.completed 
  ?? c.worked_records ?? c.completed ?? c.statistics?.mailing_worked ?? 0;
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/lib/threecplusUtils.ts` | Adicionar `extractObject` + fallbacks em `normalizeCampaignStatus` |
| `src/components/contact-center/threecplus/CampaignsPanel.tsx` | Usar `extractObject` no totalMetrics, fallbacks nos MetricCards |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Usar `extractObject` ao enriquecer campanhas com statistics |
| `supabase/functions/threecplus-proxy/index.ts` | Log de shape da resposta |

## O que NÃO muda
- Endpoints do proxy (mesmas URLs)
- Criação/gestão de campanhas
- Tabulação, login/logout de agentes
- Mailing, agentes vinculados

