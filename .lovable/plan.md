# Plano: Atualizar conhecimento do RIVO Suporte (IA + Guias)

## Problema
O assistente RIVO Suporte (`supabase/functions/support-ai-chat/index.ts`) tem um `SYSTEM_PROMPT` hardcoded que cobre apenas 7 áreas básicas (Dashboard, Carteira, Acordos, Contact Center, Automação, Cadastros, Portal). Vários módulos importantes não estão documentados, então a IA responde "não sei" — por exemplo, sobre o **Score Operacional**.

## Escopo da atualização
Adicionar conhecimento completo, alinhado ao que já existe no projeto (memórias, docs/, código), sobre:

1. **Score Operacional (propensity_score)** — único score oficial; 4 dimensões (Contato 25%, Engajamento 20%, Conversão 35%, Credibilidade 20%); pesos por fonte (operador 45% / sistema 35% / prevenção 20%); peso de recência (7d=100%, 8-30d=70%, >30d=40%); base 50 quando sem histórico; explicado em `score_reason`/`score_confidence`; alimentado pela timeline `client_events`.
2. **Perfil do Devedor** — 4 categorias fixas (Ocasional, Recorrente, Resistente, Insatisfeito).
3. **Atendimento / Omnichannel** — sessão unificada por tenant/cliente/credor, timeline `client_events`, locks de concorrência, takeover.
4. **Acordos** — ciclo de vida (sem regressão de fase), parcelas (`installment_key`), confirmação manual de pagamento, quebra de acordo, reconciliação.
5. **Carteira** — Mar Aberto vs Atribuição, mascaramento de dados sensíveis, busca multi-termo, "Sem disparo", agrupamento por credor, hierarquia de status (QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA > INADIMPLENTE > EM DIA), bulk até 1000.
6. **Gamificação** — regras de pontuação configuráveis (pagamento, valor recebido em faixas, acordo formalizado/quitado/quebrado, conquistas, meta), metas mensais.
7. **Tokens / RIVO Coin** — saldo, consumo atômico, pacotes, histórico.
8. **WhatsApp** — instâncias oficiais vs não-oficiais (Evolution/Gupshup/Wuzapi), campanhas, anti-ban, transcrição de áudio, templates.
9. **Telefonia 3CPlus** — entrar/sair de campanha, gravações, status do agente, isolamento de credenciais.
10. **Automação** — régua + workflow visual (nós, gatilhos, templates).
11. **Documentos** — geração com variáveis e hierarquia de resolução.
12. **Negativação / Protesto** — CENPROT e Serasa, baixa automática.
13. **Integrações** — MaxSystem, Negociarie, Asaas, REST API (`/clients-api` com SHA-256 X-API-Key), Servidor MCP.
14. **Portal do Devedor** — white-label por credor, assinatura de contrato, checkout.
15. **Relatórios e Analytics** — aging, prestação de contas, ranking, métricas de acordo, distribuição.
16. **Configurações** — usuários, equipes, permissões, módulos, serviços, APIs (REST + MCP).
17. **Onboarding / Provisionamento** — CNPJ obrigatório, 50 tokens cortesia.

## Mudanças de código

### 1. `supabase/functions/support-ai-chat/index.ts`
- Reescrever `SYSTEM_PROMPT` expandindo de ~7 seções para ~17 seções cobrindo todos os módulos acima.
- Manter o tom curto/objetivo e a instrução de sugerir "Falar com humano" quando não souber.
- Manter resto da função inalterado (streaming, CORS, tratamento 429/402).

### 2. `src/components/support/SupportGuidesTab.tsx` (opcional, recomendado)
- Adicionar novas categorias ao `guidesData` para os tópicos novos (Score Operacional, Gamificação, Tokens, Documentos, Negativação, Integrações, Relatórios), com 1-2 guias passo-a-passo cada — para que o usuário também encontre na aba "Guias", não só perguntando à IA.

## Detalhes técnicos
- O `SYSTEM_PROMPT` é apenas string; sem mudanças de schema, sem migrações, sem novos secrets.
- Edge function já usa `google/gemini-3-flash-preview` via Lovable AI Gateway — manter.
- Deploy é automático após salvar a função.

## Fora de escopo
- Não criar tabela de KB dinâmica (overkill para o volume atual).
- Não trocar modelo de IA.
- Não mexer em `SupportChatTab.tsx`, `SupportFloatingButton.tsx` ou `SupportScheduleTab.tsx`.

## Validação
- Após o deploy, perguntar ao bot: "O que é o score operacional?", "Como funciona a quebra de acordo?", "Como configurar gamificação?", "O que é Mar Aberto?" — esperar respostas corretas e específicas.
