

# Central Unica de Negociacao Omnichannel — /atendimento

## Status: Fase 1-5 implementadas ✅

### O que foi feito

1. **Tabela `atendimento_sessions`** — Criada com indice unico (1 sessao ativa por tenant+client+credor), RLS por tenant, e realtime habilitado
2. **Coluna `session_id` em `client_events`** — Permite vincular eventos a sessoes especificas
3. **Servico `atendimentoSessionService.ts`** — findOrCreateSession, updateSessionChannel, closeSession, getActiveSession com registro automatico de eventos
4. **DispositionPanel** — Renomeado para "Resultado do Atendimento"
5. **ClientTimeline** — Novos event_types: atendimento_opened, atendimento_closed, channel_switched, observation_added, portal_negotiation_started, portal_agreement_created, ai_whatsapp/voice_negotiation_started
6. **AtendimentoPage** — Aceita sessionId/channel opcionais, badge de canal no breadcrumb, observacoes salvas como eventos estruturados
7. **useAtendimentoModal** — Expandido com sessionId/channel/conversationId, icone dinamico por canal
8. **ChatPanel (WhatsApp)** — Botao "Atendimento" no header que cria sessao e navega para /atendimento
9. **ContactSidebar (WhatsApp)** — Botao "Ir para Atendimento" na secao do cliente vinculado

### Fases pendentes (infraestrutura pronta)

- **Fase 6**: TelefoniaDashboard criar sessao automaticamente ao abrir atendimento via chamada (infraestrutura pronta, requer apenas chamar findOrCreateSession no wrapper)
- **Fase 7**: Portal e IA criarem sessoes headless (infraestrutura pronta no servico)

### Arquitetura

- 1 sessao ativa por tenant + client_id + credor (unique index parcial)
- Qualquer canal reutiliza sessao existente
- Eventos estruturados alimentam score; observacoes texto livre nao
- Timeline unificada via client_events com session_id opcional
