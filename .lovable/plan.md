

## Plano: ícone de telefone ao lado do número do cliente para discagem direta via 3CPlus

### Comportamento desejado

- Ao lado de **cada número de telefone** exibido na ficha do cliente (Hot/phone, phone2, phone3), aparece um **ícone verde de telefone** (`Phone` do lucide-react).
- Clique no ícone:
  1. **Se operador está conectado na 3CPlus** (status `idle`/`available`/`paused`): dispara `click2call` direto para aquele número específico via `threecplus-proxy`. Toast: *"Discando para (XX) XXXXX-XXXX…"*. A 3CPlus toca no ramal SIP do operador, ele atende, sistema conecta com o cliente.
  2. **Se operador NÃO está conectado** (sem `agent_id`, ou status `offline`/`logged_out`): abre **modal de conexão da 3CPlus** (mesmo modal que já existe em `TelefoniaDashboard`/`ThreeCPlusPanel` com seleção de campanha + ramal SIP). Após o operador conectar, o sistema **automaticamente disca o número pendente** que originou a ação.
  3. **Se operador está em `on_call` ou `acw`**: ícone fica desabilitado com tooltip *"Finalize a chamada atual antes de discar"*.

### Onde adicionar o ícone

O número de telefone do cliente aparece em vários lugares — vamos cobrir os 2 mais críticos no escopo desta entrega:

1. **`ClientHeader.tsx`** (header da ficha em `/atendimento/:clientId` e `/carteira/:id`): hoje exibe `phone` formatado. Adicionar `<button>` com ícone Phone à direita do número.
2. **`ClientPhonesPanel.tsx`** (painel lateral de telefones com Hot/Phone2/Phone3, observações e ações): adicionar ícone Phone ao lado de cada slot que tenha número e não esteja inativo.

### Lógica central (novo serviço)

Criar **`src/services/callService.ts`** com:

```ts
dialClientPhone({ tenantId, phone, clientId? }): Promise<void>
```

Fluxo interno:

1. Lê `profile.threecplus_agent_id` do operador atual.
2. Lê status atual via hook compartilhado `useThreeCPlusStatus` (já existe).
3. **Se conectado** (`idle`/`available`/`paused`): invoca `threecplus-proxy` com action `click2call`, payload `{ agent_id, phone, client_id }`. Mesmo payload que `AtendimentoPage.handleCall` já usa hoje (linha 457), apenas extraído para função reutilizável.
4. **Se desconectado**: salva intenção em estado global (Zustand store novo `pendingCallStore` com `{ phone, clientId, tenantId, createdAt }`) e abre o modal de conexão chamando `openThreeCPlusConnectionModal()` (action do `AtendimentoModalProvider` que já existe).
5. **Listener no `AtendimentoModalProvider`**: quando o status do agente muda de `offline` → `idle`, verifica se há `pendingCall` no store; se sim e tiver <2 minutos de idade, dispara `click2call` automaticamente e limpa o pending. Toast: *"Conectado! Discando para o número pendente…"*.

### Componente reutilizável

Criar **`src/components/shared/CallButton.tsx`**:

```tsx
<CallButton phone={phone} clientId={clientId} size="sm" variant="ghost" />
```

- Renderiza `<Button>` com `<Phone className="h-4 w-4 text-green-600" />`.
- Tooltip dinâmico: *"Ligar para (XX) XXXXX-XXXX"* (com número formatado) ou estado de erro.
- Estado disabled quando `!phone` ou `agentBusy` (`on_call`/`acw`).
- onClick → chama `callService.dialClientPhone(...)`.

Esse componente fica reutilizável para qualquer lugar futuro (lista da Carteira, popovers, etc.).

### Modal de conexão automático

Já existe em `AtendimentoModalProvider`:
- `openThreeCPlusConnectionModal()` → abre seleção de campanha + ramal SIP (mesma UI usada hoje em `/contact-center/telefonia` quando operador clica "Conectar").
- Após conexão bem-sucedida, o `useThreeCPlusStatus` realtime atualiza o status para `idle`.

Vamos apenas:
- Garantir que essa action do provider esteja exposta globalmente (criar se não existir como API pública do contexto).
- Adicionar listener `useEffect` no provider que observa `status === 'idle'` E `pendingCall` no store → dispara discagem.

### Pré-condições e tratamento de erros

- **Operador sem `threecplus_agent_id`**: toast claro *"Seu usuário não está vinculado a um ramal 3CPlus. Solicite ao administrador em Cadastros → Usuários."*.
- **Tenant sem credenciais 3CPlus** (`threecplus_domain`/`threecplus_api_token` ausentes): toast *"3CPlus não configurada para este tenant."*.
- **Erro do `threecplus-proxy`** (ex.: ramal SIP não registrado): toast com mensagem específica retornada pelo proxy (já normalizada hoje).
- **Pending call expira em 2 min**: se operador demorar muito para conectar, descarta o pending silenciosamente para não discar inesperadamente depois.

### O que NÃO muda

- Fluxo receptivo (cliente cai pro operador via fila) permanece 100% inalterado.
- Modo manual no `DialPad` continua funcionando.
- `AtendimentoPage.handleCall` passa a usar `callService.dialClientPhone()` internamente (refactor sem mudança de comportamento).
- Lógica de telefones (`clientPhoneService`, slots Hot/2/3, promoção) intacta.

### Arquivos a alterar / criar

1. **`src/services/callService.ts`** *(novo)* — função `dialClientPhone` + leitura de `agent_id`/status + roteamento conectado/desconectado.
2. **`src/stores/pendingCallStore.ts`** *(novo)* — Zustand store simples `{ pendingCall, setPendingCall, clearPendingCall }`.
3. **`src/components/shared/CallButton.tsx`** *(novo)* — botão com ícone Phone reutilizável.
4. **`src/components/atendimento/ClientHeader.tsx`** — adicionar `<CallButton>` ao lado do telefone exibido.
5. **`src/components/client-detail/ClientPhonesPanel.tsx`** — adicionar `<CallButton>` em cada slot ativo (Hot/Phone2/Phone3).
6. **`src/components/contact-center/AtendimentoModalProvider.tsx`** (ou hook equivalente) — expor `openThreeCPlusConnectionModal()` globalmente; adicionar `useEffect` que observa status idle + pendingCall → dispara discagem auto.
7. **`src/pages/AtendimentoPage.tsx`** — refatorar `handleCall` (linha 457) para usar `callService.dialClientPhone()` (sem mudança funcional).

### Validação

1. **Operador conectado, idle, ficha do cliente** → clica ícone ao lado do Hot phone → toast "Discando…"; ramal SIP toca em ~2s; ao atender, conecta com cliente.
2. **Operador desconectado da 3CPlus, ficha do cliente** → clica ícone → modal de conexão abre; operador escolhe campanha + ramal e conecta; em ~3s sistema disca automático para o número que originou; toast "Conectado! Discando…".
3. **Operador em chamada ativa** (`on_call`) → ícone aparece desabilitado com tooltip explicativo.
4. **Cliente com 3 telefones** → cada um tem seu próprio ícone Phone; clicar no Phone2 disca especificamente o Phone2.
5. **Operador sem `agent_id`** → toast claro pedindo configuração; modal não abre.
6. **Operador conecta mas demora >2min** → pending expira; nenhuma discagem inesperada acontece.
7. **Erro de proxy** (ramal não registrado) → toast com erro específico da 3CPlus.
8. **Refactor de `AtendimentoPage.handleCall`** → comportamento atual de "Ligar" no `ClientHeader` dentro de `/atendimento` segue idêntico.

