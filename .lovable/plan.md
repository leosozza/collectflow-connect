

# Plano: Refatoração — Eliminar Widget Flutuante e Centralizar Atendimento na Ficha

## Resumo

Remover o modal/widget flutuante de telefonia (`useAtendimentoModal`) como mecanismo de atendimento. O operador continuará no `TelefoniaDashboard` e, quando uma chamada chegar, será navegado diretamente para `/atendimento/:clientId` (rota já existente). Toda a gestão 3CPlus (campanhas, pausas, monitoramento, administração) permanece intacta.

## Arquitetura Atual vs. Nova

```text
ATUAL:
  TelefoniaDashboard → detecta chamada → abre widget flutuante (overlay z-40)
                                          ↓
                                   AtendimentoPage (embedded=true dentro do widget)
                                          ↓
                                   tabulação → callback finishDisposition → widget fecha

NOVA:
  TelefoniaDashboard → detecta chamada → navigate("/atendimento/:clientId?agentId=X&callId=Y")
                                          ↓
                                   AtendimentoPage (standalone, rota completa)
                                          ↓
                                   tabulação → navigate(-1) volta ao dashboard
```

## Etapas de Implementação

### Etapa 1: Reescrever `useAtendimentoModal.tsx`

**Eliminar**: Todo o JSX do modal flutuante (backdrop, drag, minimize, timer, pause controls, header).

**Manter**: O contexto `AtendimentoModalContext` e o provider, mas simplificado — agora ele apenas coordena estado leve entre TelefoniaDashboard e AtendimentoPage:
- `agentStatus` — o dashboard seta, a ficha lê para exibir o banner de status
- `setAgentStatus` — chamado pelo dashboard
- `isOpen` — removido (sem modal)
- `openAtendimento` → removido (substituído por `navigate`)
- `openWaiting` → removido
- `updateAtendimento` → removido
- `closeAtendimento` → removido
- `setPauseControls` → removido (controles de pausa ficam no dashboard)
- `setOnFinishDisposition` / `onFinishDisposition` → **mantido** — o dashboard registra a função de cleanup (qualify + unpause), a ficha chama após tabular

O provider vira ~30 linhas (context + state simples), sem render de JSX de overlay.

### Etapa 2: Reescrever `TelefoniaAtendimentoWrapper`

**Atual**: Resolve o cliente e chama `updateAtendimento()` para abrir o widget.

**Novo**: Resolve o cliente e navega via `navigate(`/atendimento/${resolvedId}?agentId=${agentId}&callId=${callId}`)`. Remove a dependência de `useAtendimentoModalSafe`.

### Etapa 3: Simplificar `TelefoniaDashboard.tsx`

**Remover**:
- Chamadas a `openWaiting`, `setPauseControls`, `setOnFinishDisposition`, `closeAtendimento`
- Lógica de rehydrate do widget (`hasRehydrated`)
- Feed de `pauseControls` para o widget flutuante (efeito linhas 806-821)
- Tracking de `modalIsOpen` / `modalClosedAtRef` / `prevModalOpen`
- Guard de 5s `modalJustClosed`

**Manter**:
- Polling, `fetchAll`, campanhas, login/logout
- Pause/unpause no dashboard
- ACW detection e tela de tabulação fallback (para quando o operador não tabulou na ficha)
- `handleQualifyCall` (tabulação direta no dashboard como fallback)
- KPIs, `OperatorCallHistory`, admin view

**Ajustar**:
- Quando `isOnCall`, renderizar `TelefoniaAtendimentoWrapper` que agora navega para a rota
- Após campaign login, NÃO chamar `openWaiting` — ficar no dashboard aguardando
- `handleCampaignLogout` não precisa chamar `closeAtendimento`
- `effectiveACW` não depende mais de `modalIsOpen` — simplificar para `(isACW || isACWFallback || isTPAStatus) && !qualifiedFromDisposition && !isManualPause`

### Etapa 4: Adaptar `AtendimentoPage.tsx`

**Ajustar**:
- Ler `agentId`, `callId`, `sessionId`, `channel` de query params quando não recebidos como props
- Remover referência a `closeAtendimento` — após tabulação, fazer `navigate(-1)` ou `navigate("/contact-center")` para voltar ao dashboard
- Manter o banner de status 3CPlus (usa `agentStatus` do contexto)
- Manter `onFinishDisposition` do contexto — após tabulação, chamar para limpar estado na 3CPlus e depois navegar de volta
- Manter `embedded` prop para uso futuro (WhatsApp chat panel etc.)

### Etapa 5: Limpar sessionStorage

**Remover chaves que existiam só para o widget**:
- Nenhuma chave é exclusiva do widget — todas são de integração 3CPlus (`3cp_last_call_id`, `3cp_qualified_from_disposition`, `3cp_active_pause_name`, `3cp_campaign_id`)
- Manter todas essas, pois são necessárias para sincronização de tabulação e continuidade de pausa

### Etapa 6: Cache no `threecplus-proxy`

**Ajustar**: Adicionar cache em memória para `resolveAgentToken` por `agentId+domain` durante a vida da função (Map simples no escopo do módulo). Isso evita chamadas repetidas a `/users` para cada ação do mesmo agente numa mesma invocação.

### Etapa 7: Atualizar referências em outros arquivos

- `src/App.tsx`: Manter `AtendimentoModalProvider` (agora leve) — ainda necessário para compartilhar `agentStatus` e `onFinishDisposition`
- `src/components/contact-center/whatsapp/ChatPanel.tsx`: Já usa `navigate("/atendimento/...")` — sem mudança
- `src/components/carteira/*`: Já usa `navigate("/atendimento/...")` — sem mudança

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | Reescrever: remover modal/widget JSX, manter contexto leve |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Remover dependências do widget, simplificar ACW, manter tudo mais |
| `src/pages/AtendimentoPage.tsx` | Ler params da URL, `navigate(-1)` após tabulação |
| `src/App.tsx` | Manter provider (agora leve) |
| `supabase/functions/threecplus-proxy/index.ts` | Cache de `resolveAgentToken` |

## O que NÃO muda

- Criação/gestão de campanhas
- Login/logout de campanha
- Pause/unpause
- Monitoramento de agentes (admin view)
- Tabulação na ficha (DispositionPanel)
- Sincronização de tabulação com 3CPlus (qualifyOn3CPlus)
- Score, histórico, observações, acordos, gravações
- Mailing, click-to-call
- Tela de ACW fallback no dashboard (para emergências)
- Admin view do TelefoniaDashboard

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Operador perde contexto ao navegar | Query params preservam `agentId`, `callId`, `channel` na URL |
| Polling para no dashboard quando navega | O dashboard desmonta ao navegar — ao voltar, remonta e retoma polling automaticamente |
| ACW fallback no dashboard não detecta retorno | `3cp_qualified_from_disposition` no sessionStorage persiste entre navegações |

