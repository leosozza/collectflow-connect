## Contexto da análise

### Como o `debtor_profile` é alimentado hoje
- **Único ponto de escrita**: `DebtorProfileBadge` (`src/components/shared/DebtorProfileBadge.tsx`) — alteração 100% manual pelo operador.
- **Tabulação WhatsApp** (`DispositionSelector.tsx`): grava em `conversation_disposition_assignments`. **Não toca em `clients.debtor_profile`**.
- **Tabulação Discador** (`DispositionPanel.tsx` → `dispositionService.createDisposition`): grava em `call_dispositions`. **Não toca em `clients.debtor_profile`**.

**Conclusão da análise solicitada**: nem o WhatsApp nem o discador estão alimentando o perfil do devedor. Hoje "Aguardando definição de perfil" só sai do estado se o operador clicar manualmente no badge. Isso explica por que muitos clientes ficam eternamente sem perfil.

### Como o envio de mensagem funciona hoje
- `WhatsAppChatLayout.handleSend` envia direto sem qualquer validação de perfil/tabulação.
- `ChatInput` recebe um `disabled`, mas só é desligado por status de conversa — não há gate por perfil/tabulação.

---

## O que será implementado

### 1. Auto-população do `debtor_profile` a partir de tabulações
Mapear cada tabulação para um perfil sugerido e, ao registrar a tabulação (WhatsApp **ou** discador), atualizar `clients.debtor_profile` **somente se ainda estiver vazio** (não sobrescreve perfil já definido manualmente).

Mapa proposto (chaves canônicas das `call_disposition_types` já existentes):

| Tabulação (key) | Perfil sugerido |
|---|---|
| `wa_acordo_formalizado`, `wa_em_dia`, `wa_quitado` | `ocasional` |
| `wa_em_negociacao`, `cpc`, `wa_cpc` | `ocasional` |
| `wa_risco_processo`, `wa_sem_interesse_financeiro` | `resistente` |
| `wa_sem_interesse_produto` | `insatisfeito` |
| `wa_sem_contato`, `no_answer`, `voicemail`, `interrupted` | (não altera) |
| `wrong_contact`, `wa_cpe` | (não altera — contato errado) |

Regra: nunca sobrescreve um perfil já definido. Apenas preenche quando `debtor_profile IS NULL`.

### 2. Bloqueio obrigatório no WhatsApp após 5 mensagens recebidas

Em `ChatPanel.tsx`/`ChatInput.tsx`:

- Contar mensagens do cliente (`direction = 'inbound'`, `is_internal = false`) na conversa atual.
- Se `inboundCount >= 5` E (`debtor_profile` está nulo OU não existe nenhuma `conversation_disposition_assignments` para a conversa):
  - Desabilitar o input de envio (mesma lógica visual de "aceitar conversa").
  - Mostrar banner amarelo acima do input com checklist:
    - ⚠️ "Defina o Perfil do Devedor para continuar" (link rola até o badge)
    - ⚠️ "Selecione ao menos uma Tabulação" (link rola até o seletor)
  - Toast ao tentar enviar via Enter: "Preencha o Perfil e a Tabulação para enviar mensagens".
- Quando ambos forem preenchidos, libera automaticamente.

### 3. Aplicação na tabulação do discador (Atendimento/Telefonia)
- Em `DispositionPanel`, ao registrar tabulação, chamar a mesma helper que atualiza `debtor_profile` (vincular pelo `client_id` da sessão de atendimento).
- Não há fluxo de "envio de mensagem" no discador, então o bloqueio do item 2 fica restrito ao WhatsApp (conforme o pedido).

### 4. Helper centralizado
Criar `src/services/debtorProfileAutoService.ts` com:
- `inferDebtorProfileFromDisposition(key: string): string | null`
- `applyAutoProfile(tenantId, cpf, dispositionKey)` — atualiza `clients.debtor_profile` apenas se nulo, registra `client_events` (`debtor_profile_changed` com `event_source: 'auto_disposition'`) e dispara `recalcScoreForCpf`.

Chamado em:
- `DispositionSelector.handleToggle` (após insert bem-sucedido).
- `dispositionService.createDisposition` (após insert).

---

## Detalhes técnicos

**Arquivos a criar:**
- `src/services/debtorProfileAutoService.ts`
- `src/components/contact-center/whatsapp/WhatsAppGateBanner.tsx` (banner com checklist)

**Arquivos a editar:**
- `src/components/contact-center/whatsapp/DispositionSelector.tsx` — chamar `applyAutoProfile` após assign.
- `src/components/contact-center/whatsapp/ChatPanel.tsx` — calcular `inboundCount`, derivar `mustGate`, passar `disabled` e renderizar banner; props novas `debtorProfile`, `dispositionAssignments` (já recebe).
- `src/components/contact-center/whatsapp/ChatInput.tsx` — exibir mensagem de gate quando `disabled` por motivo `requires_profile_disposition`.
- `src/components/contact-center/whatsapp/WhatsAppChatLayout.tsx` — passar `linkedClient.debtor_profile` para o `ChatPanel` e bloquear `handleSend` defensivamente.
- `src/services/dispositionService.ts` — em `createDisposition`, após insert chamar `applyAutoProfile` (precisa do `cpf`; buscar via `clients.id`).
- `src/components/atendimento/DispositionPanel.tsx` — sem mudança visual; o serviço cuida da automação.

**Pseudocódigo do gate (ChatPanel):**
```ts
const inboundCount = messages.filter(
  m => m.direction === "inbound" && !m.is_internal
).length;

const hasDisposition = dispositionAssignments.some(
  a => a.conversation_id === conversation?.id
);
const hasProfile = !!clientInfo?.debtor_profile;

const mustGate = inboundCount >= 5 && (!hasDisposition || !hasProfile);
```

**Banner**: aparece logo acima do `ChatInput`, com 2 itens (perfil / tabulação) marcados ✓ ou ✗, e botões "Definir perfil" / "Tabular" que abrem a sidebar (`onToggleSidebar`) caso esteja fechada e dão `scrollIntoView` nos respectivos cards.

**Não-objetivos (fora do escopo deste plano)**
- Não vamos forçar tabulação para conversas com menos de 5 mensagens.
- Não vamos exigir perfil em mídia/áudio antes de 5 inbound (mesma regra aplica via `mustGate` — vale para todos os métodos de envio).
- Não mexemos no fluxo de "aceitar conversa" existente.
