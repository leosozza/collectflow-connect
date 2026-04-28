# Plano — Atualização Manual do Roadmap

Arquivo único alvo: `src/pages/RoadmapPage.tsx` (array `roadmapData`).
Sem mudanças de banco, RPC, Edge ou outras telas. Apenas sincronização de status/progresso e inclusão dos módulos novos que já estão em produção.

## 1. Mover de "in_progress / planned" → "done" (já concluídos)

| ID | Status atual | Novo | Justificativa |
|---|---|---|---|
| `serasa` | in_progress 25% | **done 100%** | Negativação Serasa + CENPROT operacionais (memória `features/negativation-and-protest`). |
| `resend-email` | in_progress 50% | **done 100%** | Domínio validado, `send-quitados-report` ativa (memória `integrations/email/resend-infrastructure`). |
| `agente-ia-autonomo` | in_progress 15% | **in_progress 40%** | Sugestões IA + transcrição de áudio + chat-ai-suggest ativos, mas modo autônomo ainda não. Apenas atualizar progresso. |
| `whatsapp-meta` | planned 10% | **done 100%** | Provider oficial Meta/Gupshup já roteado (`provider_category`, bulk routing). |
| `politicas-desconto-dinamico` | planned 5% | **done 100%** | Já implementado via aging por credor + fluxo de aprovação (memória `logic/agreements/billing-validation-flow`). |

## 2. Atualizar progresso (sem mudar status)

- `export-relatorios` (planned 10%) → **planned 40%** — Excel via xlsx já presente em vários módulos; PDF ainda parcial.
- `pix-qrcode-dinamico` (planned 0%) → **planned 20%** — Pix via Asaas/Negociarie já roda; falta apenas Pix nativo direto.
- `webhook-baixa-automatica` (planned 0%) → **done 100%** — `negociarie-callback`, Asaas webhooks e `manual-payment-confirmation` já fazem baixa automática.

## 3. Adicionar novos itens (que já existem mas não estão listados)

Inserir antes do bloco "── NOVOS ITENS ──" (linha ~1203):

1. **Score Operacional V1** — `done 100%` / categoria IA
   - Motor heurístico 4 dimensões + recência + perfis de devedor (memória `logic/operational-score`).
2. **Sistema de Perfis de Devedor (4 categorias)** — `done 100%` / Core
   - Ocasional/Recorrente/Resistente/Insatisfeito (memória `features/debtor-profile-system`).
3. **Timeline Omnichannel Unificada (`client_events` + `session_id`)** — `done 100%` / Core
   - SSoT histórico unificado (memórias `architecture/client-events-timeline` + `logic/history/unified-session-timeline`).
4. **Hub Omnichannel de Atendimento** — `done 100%` / Contact Center
   - Página `/atendimento` unificada multi-canal (memória `features/atendimento/unified-omnichannel-hub-ui`).
5. **Anti-Ban Backend Lock (Disparos em Lote)** — `done 100%` / Contact Center
   - Throttling 8-15s + pausa de lote no servidor (memória `features/communication/bulk-campaign-resilience`).
6. **Gestão de Campanhas WhatsApp** — `done 100%` / Contact Center
   - `origin_type` + estado restritivo Anti-Ban (memória `features/whatsapp/campaign-management-module`).
7. **Catálogo de Serviços & Tokens (Faturamento SaaS)** — `done 100%` / Core
   - Provisionamento por catálogo + consumo atômico (memórias `features/tenant-service-provisioning` + `features/tokens/architecture`).
8. **Onboarding Multi-Tenant com CNPJ + 50 tokens cortesia** — `done 100%` / Core
   - RPC `onboard_tenant` (memória `logic/tenant-provisioning-and-onboarding`).
9. **Gateway Asaas (Mensalidade + Tokens)** — `done 100%` / Integrações
   - Cartão/PIX/Boleto + webhooks (memória `integrations/asaas/payment-gateway-architecture`).
10. **Gamificação V2 (Snapshot RPC + Cron)** — `done 100%` / Core
    - SSoT financeiro consolidado + tick a cada 30 min (memória `features/gamification/logic-and-persistence`).
11. **API Pública REST de Clientes (X-API-Key SHA-256)** — `done 100%` / Integrações
    - Endpoint `/clients-api` (memória `integrations/api/rest-specification`).
12. **Transcrição Automática de Áudios (Gemini)** — `done 100%` / IA
    - Edge `transcribe-audio` (memória `features/whatsapp/audio-transcription`).
13. **Documentos com Resolução em 3 Níveis** — `done 100%` / Core
    - Credor > Tenant > Padrão (memória `features/documentos/architecture-and-logic`).
14. **Reconciliação Granular de Pagamentos (Manual + Portal + Negociarie)** — `done 100%` / Financeiro
    - `get_agreement_financials` (memória `logic/acordos/reconciliacao-pagamentos`).
15. **Dashboard via RPC SQL agregada** — `done 100%` / Core
    - `get_dashboard_stats` + `get_dashboard_vencimentos` (memória `tech/dashboard-aggregation-strategy`).

Cada item segue o mesmo schema (`id`, `title`, `description`, `status`, `progress`, `category`, `lovablePrompt`) com `lovablePrompt` curto descrevendo o que já está implementado e onde (arquivo/serviço/edge), no mesmo padrão dos itens "done" existentes.

## 4. Não mexer

Mantidos como estão (representam realmente o futuro): `mobile`, `gateway` (alternativa nativa), `ia-acordo`, `ocr`, `score-credito`, `erp`, `mediacao`, `analise-sentimento-devedor`, `grupos-whatsapp-mutirao`, `transicao-canal-inteligente`, `split-pagamento`, `dashboard-roi-ia-vs-humano`, `regua-inversa-lead-scoring`.

## Detalhe técnico

- Edição única em `src/pages/RoadmapPage.tsx`, dentro do array `roadmapData` (linhas 23–1240).
- Sem alteração de tipos, helpers, filtros ou UI — apenas dados.
- Você revisará depois e excluirá o que não fizer sentido manter.

## Resultado esperado

- Roadmap reflete o estado real: ~31 itens "done", 1 "in_progress" (`agente-ia-autonomo`), planejados/futuros enxutos.
- Nenhum impacto em backend, RLS, Edge Functions ou outras páginas.
