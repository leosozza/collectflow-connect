

## Plano: ajustes no módulo Telefonia (3CPlus)

Três correções pontuais no painel de Telefonia, sem mexer no fluxo de atendimento que acabou de ser publicado.

---

### 1. Remover "Agressividade" da UI

A 3CPlus expõe o campo `aggressiveness` na API mas a operação real do discador **não respeita** essa configuração para o tenant atual (testes mostram que mover o slider não muda comportamento). Para evitar confusão do operador/admin, remover a UI inteira e o código de suporte.

**Arquivos:**

- `src/components/contact-center/threecplus/CampaignOverview.tsx`
  - Remover coluna "Agressividade" do `<TableHeader>` e do `<TableBody>` (linhas ~109 e ~148-161).
  - Remover handler `handleAggressiveness` (linhas 59-79) e import do `Slider`.
  - Remover linha "Agressividade" do bloco expandido (linhas 196-199).
  - Ajustar `colSpan={8}` → `colSpan={7}`.

- `src/components/contact-center/threecplus/CampaignsPanel.tsx`
  - Remover bloco "Aggressiveness Slider" (linhas 453-470) do detalhe expandido.
  - Remover `handleSaveAggressiveness` (linhas 211-221), states `aggressiveness`/`savingAggr` (linhas 50-51), e mapeamento `aggrMap` em `loadCampaigns` (linhas 126-133).
  - Remover import `Gauge` e `Slider` se não usados em outro lugar.

- `src/lib/threecplusUtils.ts`
  - Manter o cálculo no `normalizeCampaignStatus` (não quebra nada), mas pode ser limpo depois — não é bloqueante.

---

### 2. Atualização das campanhas (Dashboard + detalhe da campanha)

Dois pontos distintos:

**(a) Dashboard (`CampaignOverview` em `TelefoniaDashboard`)** — auto-refresh existe (30s para admin, 3s para operador), mas as métricas exibidas vêm do enriquecimento por `campaign_statistics` que está mascarado com `try/catch` silencioso. Quando esse endpoint falha, o card mostra os dados antigos sem indicar erro. Correção:
  - Em `TelefoniaDashboard.tsx` linhas 446-461: logar erro do `campaign_statistics` no console (manter UI silenciosa).
  - Adicionar timestamp visível "Atualizado há Xs" no header do `CampaignOverview` (já existe `lastUpdate` no parent — passar via prop e exibir).
  - Reduzir intervalo padrão admin de 30s → **15s** (dashboard de operação ativa precisa ser mais reativo).

**(b) Detalhe expandido da campanha (`CampaignsPanel`)** — aqui não há **nenhum** polling. Os cards "Total Discado / Atendidas / Abandonadas / ASR / Tempo Médio / Na Fila / Completados / Sem Atender" só atualizam ao clicar em "Atualizar Detalhes". Correção:
  - Em `CampaignsPanel.tsx`: adicionar `useEffect` que dispara `loadCampaignDetails(expandedCampaign)` a cada **15s** enquanto houver campanha expandida.
  - Mostrar timestamp da última atualização ao lado do botão "Atualizar Detalhes".

---

### 3. Grupo de Intervalos não persiste na criação da campanha

**Causa:** o payload enviado em `create_campaign` (proxy linha 152) usa `work_break_group_id`, mas a API REST da 3CPlus para `POST /campaigns` espera o campo dentro de `dialer_settings` (igual a `aggressiveness`). O endpoint aceita o campo top-level sem erro mas **não persiste** — por isso ao reabrir a campanha, o grupo aparece vazio.

**Verificação adicional:** o leitor `loadCampaigns` (CampaignsPanel linhas 128-132) tenta ler `c.work_break_group_id` direto do `list_campaigns`, mas a 3CPlus normalmente retorna esse campo aninhado em `c.dialer_settings.work_break_group_id` ou `c.work_break_group?.id`. Por isso, mesmo se a criação tivesse persistido, o select continuaria vazio.

**Correção (3 pontos):**

- `supabase/functions/threecplus-proxy/index.ts` linha 152: enviar `work_break_group_id` aninhado:
  ```ts
  if (body.work_break_group_id) {
    campaignPayload.dialer_settings = {
      ...(campaignPayload.dialer_settings || {}),
      work_break_group_id: body.work_break_group_id,
    };
    // manter top-level também por segurança (alguns tenants aceitam)
    campaignPayload.work_break_group_id = body.work_break_group_id;
  }
  ```

- `src/components/contact-center/threecplus/CampaignsPanel.tsx` linha 131: ler de múltiplas fontes:
  ```ts
  const wbgId = c.work_break_group_id 
    ?? c.work_break_group?.id 
    ?? c.dialer_settings?.work_break_group_id;
  if (wbgId) wbgMap[String(c.id)] = String(wbgId);
  ```

- Mesma lógica em `update_campaign` (proxy linhas 157-168): se `work_break_group_id` vier no body, espelhar para `dialer_settings.work_break_group_id`.

---

### Validação pós-deploy

1. Painel /telefonia (admin): coluna "Agressividade" sumiu; campanhas atualizam progresso a cada 15s sem clicar.
2. Expandir campanha: métricas "Total Discado / Atendidas / etc." atualizam sozinhas a cada 15s.
3. Criar nova campanha selecionando "Grupo de Intervalos" → reabrir a campanha → o grupo aparece pré-selecionado no dropdown.

### Fora de escopo

- Mexer no fluxo de chamada/pausa do operador (já publicado e estável).
- Adicionar polling no dashboard de operador (já está em 3s).
- Refatorar `CampaignOverview` para componente menor.

