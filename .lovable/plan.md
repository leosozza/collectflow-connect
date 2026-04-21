
## Auditoria do módulo de Disparo + Plano de Melhorias

### Parte A — Auditoria do estado atual

#### A.1 Anti-ban (boas práticas) — ✅ Bem implementado

Confirmado em `supabase/functions/send-bulk-whatsapp/index.ts`:

| Item | Não-Oficial | Oficial Meta | AI Agent |
|---|---|---|---|
| Delay entre mensagens | 8–15s aleatório | 1–3s | 3–6s |
| Pausa em lote | 120s a cada 15 | 30s a cada 50 | 60s a cada 25 |
| Aplicação | **Por instância** (não global) | Por instância | Por instância |
| Lock de campanha | ✅ `try_lock_campaign` evita worker duplicado | ✅ | ✅ |
| Claim atômico | ✅ `claim_campaign_recipients` (RPC) | ✅ | ✅ |
| Round-robin entre instâncias | ✅ Loop interleaved (linhas 299–483) | ✅ | ✅ |
| Checkpoint em `progress_metadata` | ✅ `last_chunk_at`, `batch_resting`, `resting_instance` | ✅ | ✅ |
| Retomada em timeout | ✅ Reseta `processing` → `pending` | ✅ | ✅ |
| Bloqueio de mistura oficial+não-oficial | ✅ Bloqueia campanhas `mixed` | ✅ | ✅ |

**Conclusão:** as boas práticas anti-ban estão sólidas. Cada instância tem seu próprio cooldown, e o sistema processa em round-robin para que enquanto uma "descansa" outra envie.

#### A.2 Permissões — ⚠️ Parcial

- O Edge `send-bulk-whatsapp` **já valida** `campanhas_whatsapp.create` (linhas 134–179) — isso é bom.
- O **frontend** (`CarteiraPage.tsx:629`) gateia o botão por `permissions.canCreateCampanhas`.
- ❌ **Problema:** o perfil padrão `gerente` em `usePermissions.ts:67` **não tem** `create` em `campanhas_whatsapp` (só `view_all` e `view_metrics`). Então hoje **só admin/super_admin** disparam por padrão — o que está alinhado ao seu pedido, mas não há UI para o admin **delegar** essa permissão a operadores específicos sem mexer em código.
- Existe a infra: `permission_profiles.permissions` (perfil customizado) e `user_permissions` (override por usuário) — o Edge já lê os dois.
- ❌ Não há um UI claro de "quem pode disparar" para o admin gerenciar.

#### A.3 Distribuição entre instâncias — ⚠️ Funciona, mas só "igual"

`distributeRoundRobin` em `whatsappCampaignService.ts:127`:
- Embaralha destinatários e atribui em round-robin: `instanceIds[i % instanceIds.length]`.
- ✅ Distribui **igual** para todos os números selecionados.
- ❌ **Não permite peso** — não dá para dizer "número A recebe 60%, B recebe 30%, C recebe 10%".
- ❌ Não considera "saúde" da instância (idade do número, histórico de bloqueio, capacidade restante).

#### A.4 Pontos finos detectados

- ✅ Confirmação obrigatória antes do envio (W2.1) implementada.
- ✅ Estimativa de tempo coerente com o backend.
- ⚠️ A UI mostra "round-robin automático" mas não permite ao admin **ajustar pesos**.
- ⚠️ O Edge ainda tem o "fluxo legado" (linhas 549–686) para ≤5 destinatários — esse fluxo **não passa por campanha** e usa só a instância default. Funciona, mas seria mais limpo unificar tudo em campanha.

---

### Parte B — Plano de melhorias

Priorizei pelo seu pedido: **gate de permissão + delegação + distribuição ponderada**. Divido em 3 entregas independentes.

#### Entrega 1 — Gate "só admin (ou delegado)" com clareza

**Objetivo:** garantir que por padrão só admin dispare, e que admin tenha um lugar claro para delegar a operadores específicos.

1. **Reforço visual no botão de disparo** (`CarteiraPage.tsx`):
   - Se o usuário não tem `canCreateCampanhas`, esconder botão (já é o comportamento) — manter.
   - Se tem, adicionar `Tooltip` no botão indicando "Permissão de disparo: ativa".

2. **Permissão padrão por role** (`usePermissions.ts`):
   - Confirmar `admin`/`super_admin` com `create + start + pause` (já tem).
   - **Remover** `create` de `gerente`/`supervisor`/`operador` (já não têm — só conferir).
   - Mensagem de fallback no Edge mantém-se: `403 Forbidden`.

3. **Tela de delegação para admin** (nova):
   - Criar `WhatsAppDispatchPermissionsPage.tsx` (ou aba dentro de `Configurações > Permissões`).
   - Lista todos os usuários do tenant (`profiles`) com toggle "Pode disparar campanhas WhatsApp".
   - Toggle ON: faz `upsert` em `user_permissions` (`module: 'campanhas_whatsapp', actions: ['create','start']`).
   - Toggle OFF: remove a linha.
   - Acessível apenas a admin/super_admin (gate por rota).

4. **Indicador no header da campanha**:
   - Em `CampaignSummaryTab` mostrar `Criada por: <nome>` (já existe `created_by`, só renderizar com join em `profiles`).

#### Entrega 2 — Distribuição ponderada entre números

**Objetivo:** permitir distribuir igual (default) **ou** atribuir percentual customizado por instância.

1. **`WhatsAppBulkDialog.tsx` — Step 2 evoluído:**
   - Manter checkbox de seleção das instâncias.
   - Adicionar toggle no topo: **"Distribuição: Igual (round-robin) | Personalizada (por peso)"**.
   - Modo **Igual** (default): comportamento atual.
   - Modo **Personalizada**: para cada instância selecionada, slider de 0-100% com soma travada em 100%.
     - Botão "Equalizar" para resetar.
     - Mostra ao vivo "X destinatários (~Y%)" por instância.
     - Validação: soma === 100% e nenhuma instância com 0% se selecionada.

2. **Novo método `distributeWeighted`** em `whatsappCampaignService.ts`:
   - Input: `recipients`, `[{instanceId, weight}]` com `sum(weight)===100`.
   - Cálculo: `count_i = round(total * weight_i/100)`; ajusta o último para fechar o total.
   - Embaralha e atribui blocos sequenciais, depois reembaralha o array final para que envios não saiam "em ordem por instância".
   - Round-robin existente vira um caso especial onde todos os pesos são iguais.

3. **Persistir o peso na campanha:**
   - Adicionar coluna `instance_weights jsonb` em `whatsapp_campaigns` (migration).
   - Preencher na criação (`createCampaign`) — útil para auditoria e relatórios.
   - O Edge **não precisa mudar** porque a distribuição já é gravada nos `recipients` (`assigned_instance_id`). O Edge só consome o que está atribuído.

4. **No diálogo de confirmação (W2.1):**
   - Mostrar a distribuição final: `"Instância A: 60 msg (60%) · Instância B: 30 msg (30%)..."` em vez do "round-robin automático".

#### Entrega 3 — Saúde e proteção da instância (opcional, recomendado)

Para tornar a "distribuição inteligente" um diferencial real:

1. **Recomendação automática de pesos** baseada em:
   - Idade da instância (`whatsapp_instances.created_at`): números mais velhos suportam mais volume.
   - Volume nas últimas 24h (somar `chat_messages` outbound onde `endpoint_id = inst.id`).
   - Última falha registrada.
2. Botão **"Sugerir distribuição"** no Step 2 que pré-preenche os pesos com uma fórmula conservadora (números novos < 1 semana ficam com no máximo 30 msg/dia, antigos com até 200 msg/dia).
3. **Limite diário por instância** configurável em `whatsapp_instances.daily_send_limit` (nova coluna). O Edge respeita: se a instância já bateu o limite no dia, marca recipients dela como `failed` com motivo "limite diário atingido" (ou pula e redistribui — a escolher).

---

### Recomendação de execução

Sugiro fazer **Entregas 1 + 2 juntas** numa rodada (cobre 100% do que você pediu) e deixar a **Entrega 3** para validar uso real antes.

### Arquivos que serão alterados (Entregas 1 + 2)

- `src/pages/CarteiraPage.tsx` — Tooltip no botão.
- `src/components/carteira/WhatsAppBulkDialog.tsx` — Step 2 com modo igual/ponderado, atualização do diálogo de confirmação.
- `src/services/whatsappCampaignService.ts` — função `distributeWeighted`, persistência de `instance_weights`.
- `src/hooks/usePermissions.ts` — auditar e confirmar matriz default.
- Nova página: `src/pages/admin/WhatsAppDispatchPermissionsPage.tsx` + rota em `App.tsx` + item de menu em Configurações.
- Migration SQL: `whatsapp_campaigns.instance_weights jsonb` (nullable).

### Fora de escopo

- Edge `send-bulk-whatsapp` (não precisa mexer — já consome o que `assigned_instance_id` define).
- Anti-ban backend (já está sólido).
- Campanhas mistas oficial+não-oficial (continuam bloqueadas).

### Próximo passo

Confirme **"Aplicar Entregas 1 + 2"** ou se prefere quebrar (ex.: só Entrega 2 primeiro, ou só Entrega 1, ou incluir Entrega 3 já).
