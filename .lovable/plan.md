

# Plano: Reorganização Telefonia + Desligar Ligação + Unificação Tabulações

## 1. Mover Bloqueio para "Chamadas" e Remover SMS

**Arquivo:** `ThreeCPlusPanel.tsx`

- Mover `{ value: "blocklist", label: "Bloqueio", icon: ShieldBan }` do grupo "Controle" para o grupo "Chamadas"
- Remover `{ value: "sms", label: "SMS", icon: MessageSquareText }` do grupo "Controle"
- Remover import do `SMSPanel` e entrada no `contentMap`

---

## 2. Botão "Desligar Ligação" na tela de Atendimento

**Arquivos:** `threecplus-proxy/index.ts`, `AtendimentoPage.tsx`, `ClientHeader.tsx`

A API 3CPlus possui o endpoint `POST /agent/hangup` (usando o token do agente, igual pause/unpause). 

- **Edge Function**: Adicionar action `hangup_call` que busca o token do agente e chama `POST /agent/hangup`
- **ClientHeader**: Adicionar botão vermelho "Desligar" ao lado do botão de ligar, visível quando há um `agentId` configurado
- **AtendimentoPage**: Criar handler `handleHangup` que invoca `threecplus-proxy` com action `hangup_call`

---

## 3. Unificação Tabulações RIVO ↔ 3CPlus

**Conceito**: As tabulações do RIVO (tabela `call_disposition_types`) passam a ser a fonte única. Quando o tenant tem 3CPlus configurado, o sistema sincroniza automaticamente com a Qualification List da 3CPlus.

**Fluxo**:
1. Operador gerencia tabulações em **Cadastros → Tabulações** (como já faz hoje)
2. Ao criar/editar/excluir uma tabulação, se o tenant tem 3CPlus configurado:
   - O sistema busca/cria uma Qualification List dedicada no 3CPlus (ex: "RIVO - Tabulações")
   - Sincroniza os itens: cria/atualiza/remove qualificações correspondentes na 3CPlus
   - Salva o mapeamento `{ rivo_key → 3cplus_qualification_id }` em `tenant.settings.threecplus_disposition_map`
3. Tenants sem 3CPlus continuam usando normalmente sem mudança alguma

**Arquivos alterados:**

| Arquivo | Mudança |
|---|---|
| `ThreeCPlusPanel.tsx` | Mover blocklist, remover SMS |
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar action `hangup_call` |
| `AtendimentoPage.tsx` | Adicionar handler `handleHangup`, passar para ClientHeader |
| `ClientHeader.tsx` | Adicionar botão "Desligar" |
| `CallDispositionTypesTab.tsx` | Após criar/editar/excluir tabulação, chamar função de sync com 3CPlus |
| `services/dispositionService.ts` | Adicionar `syncDispositionsTo3CPlus()` — busca/cria lista, sincroniza itens, atualiza mapeamento |
| `QualificationsPanel.tsx` | Remover do menu (ou transformar em visualização read-only com aviso "Gerencie em Cadastros → Tabulações") |

**Lógica da sincronização** (`syncDispositionsTo3CPlus`):
1. Verificar se tenant tem `threecplus_domain` e `threecplus_api_token`
2. Buscar listas de qualificação existentes no 3CPlus
3. Encontrar ou criar lista "RIVO Tabulações"
4. Buscar qualificações existentes na lista
5. Comparar com `call_disposition_types` ativas do tenant
6. Criar novas, atualizar existentes, remover as que não existem mais
7. Salvar mapa `{ key: qualification_id }` em `tenants.settings.threecplus_disposition_map`

**Compatibilidade multi-tenant**: A sincronização só ocorre quando o tenant tem credenciais 3CPlus. Sem credenciais = comportamento atual inalterado.

