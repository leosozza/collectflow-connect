

# Plano: Correção e Blindagem da Gestão de Campanhas

## Problemas Identificados

1. **Dashboard mostra métricas falsas**: `responseRate` calcula entrega como resposta, `totalResponded` e `totalAgreements` hardcoded em 0
2. **Respostas frágeis**: qualquer conversa criada após a campanha no mesmo telefone conta como "resposta" — falsos positivos óbvios
3. **Acordos frágeis**: qualquer acordo com mesmo CPF após campanha é atribuído — ignora origem real
4. **N+1 pesado**: `fetchCampaignAgreements` chama `fetchManagedRecipients` (que já enriquece clients + instances) + `fetchCampaignDetail` separadamente; `fetchInstanceMetrics` e `CampaignSummaryTab` cada um carrega todos os recipients de novo; `CampaignMetricsTab` carrega recipients DUAS vezes
5. **Sem paginação**: recipients, respostas e acordos carregam tudo de uma vez
6. **Detalhe sem proteção**: `fetchCampaignDetail` não valida `tenant_id` nem `created_by`
7. **Filtro de instância quebrado**: dropdown de instâncias no RecipientsTab não tem opções reais
8. **SummaryTab exibe "Taxa Entrega" mas label diz "resposta"** — confuso

## Alterações

### 1. Service `campaignManagementService.ts` — Refatoração completa

**Dashboard stats** — remover métricas falsas:
- `responseRate` → `null` (não disponível ainda)
- `agreementRate` → `null`
- Remover `totalResponded` e `totalAgreements` do dashboard (ou mostrar "—")
- Manter apenas: `totalCampaigns`, `totalSent`, `totalDelivered`, `totalFailed`

**Respostas** — reduzir falsos positivos:
- Em vez de buscar TODAS conversas do tenant após `started_at`, buscar apenas `chat_messages` com `direction = 'inbound'` para os phones da campanha
- Filtrar por janela temporal: mensagem recebida entre `started_at` e `completed_at + 72h` (ou `started_at + 7 dias` se não completada)
- Documentar no código que é correlação temporal, não prova causal
- Adicionar comentário `// LIMITATION: correlation by phone+time window, not causal link`

**Acordos** — reduzir falsos positivos:
- Manter filtro por CPF + data, mas adicionar janela máxima de 30 dias após campanha (em vez de infinito)
- Não recarregar recipients inteiros: buscar CPFs direto de `whatsapp_campaign_recipients` + `clients` com query única
- Não rechamar `fetchCampaignDetail` — receber `startDate` como parâmetro

**Eliminar N+1**:
- `fetchCampaignAgreements(campaignId, tenantId, startDate)` — receber startDate, não rechamar detail
- `fetchInstanceMetrics(campaignId)` — query direta em `whatsapp_campaign_recipients` com `GROUP BY assigned_instance_id` + join `whatsapp_instances` em batch — sem carregar todos recipients
- `CampaignSummaryTab` e `CampaignMetricsTab` compartilhar cache via `queryKey` — evitar duplicação

**Paginação**:
- `fetchManagedRecipients` — adicionar `page` e `pageSize` (default 50), usar `.range()`
- `fetchCampaignResponses` — limitar a 200 resultados
- `fetchCampaignAgreements` — limitar a 200 resultados
- `fetchManagedCampaigns` — adicionar `.range()` com limit 100

**Proteção do detalhe**:
- `fetchCampaignDetail` — adicionar `.eq("tenant_id", tenantId)` obrigatório
- Receber `tenantId` e `userId` + `onlyOwn` como parâmetros
- Se `onlyOwn`, adicionar `.eq("created_by", userId)`

### 2. `CampaignManagementTab.tsx` — Dashboard honesto

- Remover cards de "Respostas" e "Taxa de Resposta" que não existem no backend
- Manter apenas 4 cards: Campanhas, Enviadas, Entregues, Falhas
- Adicionar debounce de 500ms na busca textual

### 3. `CampaignDetailView.tsx` — Proteção por permissão

- Passar `tenantId` e permissões para `fetchCampaignDetail`
- Se campanha retornar null (tenant/permissão), mostrar "Sem acesso"
- Receber `onlyOwn` e `userId` da tab pai

### 4. `CampaignSummaryTab.tsx` — Métricas honestas

- Renomear "Taxa Entrega" para label correto
- Remover cálculo falso de `responseRate`
- Não carregar todos recipients para gráficos — usar `fetchInstanceMetrics` (já otimizado) para distribuição por instância
- Para pie chart de status, fazer query leve: `SELECT status, count(*) FROM whatsapp_campaign_recipients WHERE campaign_id = ? GROUP BY status`

### 5. `CampaignRecipientsTab.tsx` — Paginação + filtros funcionais

- Implementar paginação com botões Anterior/Próximo
- Corrigir dropdown de instâncias: popular a partir da campanha `selected_instance_ids` + join `whatsapp_instances`
- Mostrar total real (não apenas da página)

### 6. `CampaignResponsesTab.tsx` — Indicador de correlação

- Adicionar aviso visual: "Respostas identificadas por correlação (telefone + janela temporal). Pode incluir conversas não diretamente relacionadas à campanha."
- Usar Badge "Correlação" em vez de apresentar como certeza

### 7. `CampaignAgreementsTab.tsx` — Indicador de correlação

- Header: "Acordos possivelmente vinculados à campanha" (em vez de "gerados após")
- Aviso: "Vinculação por CPF e período. Acordos podem ter outras origens."

### 8. `CampaignMetricsTab.tsx` — Eliminar dupla carga

- Usar `fetchInstanceMetrics` otimizado (query direta, sem carregar recipients)
- Remover segunda query de `fetchManagedRecipients` — usar contadores da campanha (`campaign.sent_count`, etc.)

### 9. Nova função auxiliar no service

`fetchRecipientStatusCounts(campaignId)` — query leve:
```sql
SELECT status, count(*)::int as count 
FROM whatsapp_campaign_recipients 
WHERE campaign_id = ? 
GROUP BY status
```
Usada pelo SummaryTab para pie chart sem carregar todos recipients.

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/services/campaignManagementService.ts` | Refatorar queries, paginação, proteção tenant, eliminar N+1, janela temporal |
| `src/components/contact-center/whatsapp/CampaignManagementTab.tsx` | Remover cards falsos, debounce busca |
| `src/components/contact-center/whatsapp/campaigns/CampaignDetailView.tsx` | Proteção tenant/permissão no detalhe |
| `src/components/contact-center/whatsapp/campaigns/CampaignSummaryTab.tsx` | Métricas honestas, query leve |
| `src/components/contact-center/whatsapp/campaigns/CampaignRecipientsTab.tsx` | Paginação, filtro instâncias funcional |
| `src/components/contact-center/whatsapp/campaigns/CampaignResponsesTab.tsx` | Aviso correlação |
| `src/components/contact-center/whatsapp/campaigns/CampaignAgreementsTab.tsx` | Aviso correlação, janela temporal |
| `src/components/contact-center/whatsapp/campaigns/CampaignMetricsTab.tsx` | Eliminar dupla carga |

Nenhuma migration. Nenhuma alteração em tabelas, edge functions, disparo, conversas ou automação.

