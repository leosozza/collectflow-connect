

## Bloquear tabulação "Em Dia" para clientes com acordo no Rivo

### Regra de negócio

A tabulação "Em Dia" (`em_dia` no canal voz, `wa_em_dia` no canal WhatsApp) deve ficar disponível **somente** para clientes importados que vêm pagando suas parcelas originais (sem acordo formalizado dentro do Rivo). Se existir qualquer registro em `public.agreements` para o `cpf` + `tenant_id` do cliente, a tabulação fica bloqueada.

### Detecção de "tem acordo no Rivo"

Hook reutilizável `useHasRivoAgreement(cpf, tenantId)` em `src/hooks/useHasRivoAgreement.ts`:

```ts
// SELECT id FROM agreements 
// WHERE tenant_id = $tenantId AND cpf = $cpf 
// LIMIT 1
// Retorna boolean (qualquer status conta — pending_approval, pending, approved, completed, broken)
```

Cacheado via React Query com `queryKey: ["has-rivo-agreement", tenantId, cpf]`, `staleTime: 60s`.

### Pontos de bloqueio (4 lugares)

**1. `src/components/contact-center/whatsapp/DispositionSelector.tsx`** (sidebar do chat WhatsApp)
- Receber `clientCpf?: string | null` via prop (passar a partir de `ContactSidebar` usando `linkedClient.cpf`).
- Usar o hook para obter `hasAgreement`.
- Se `d.key === "wa_em_dia" && hasAgreement` → renderizar o badge com `opacity-40 cursor-not-allowed`, `disabled` no botão, e `title="Cliente possui acordo no Rivo — esta tabulação é apenas para clientes em dia com pagamentos originais"`.

**2. `src/components/contact-center/whatsapp/CloseConversationDialog.tsx`** (modal de fechar conversa)
- Buscar o `cpf` do `client_id` da `conversation` (pequena query `.from("clients").select("cpf").eq("id", conversation.client_id)` já no `useEffect` de carregamento, ou aceitar via prop a partir do parent que já tem o cliente vinculado).
- Mesmo bloqueio visual + impedir o `handleToggle` quando a chave é `wa_em_dia` e há acordo.

**3. `src/components/contact-center/whatsapp/ContactSidebar.tsx`** (auto-assign existente)
- Adicionar no `useEffect` de auto-assign (linhas 219–259): antes de inserir, verificar se há acordo em `agreements` para o `linkedClient.cpf` + `tenant_id`. Se houver, **não** auto-atribui `em_dia`. Mantém o auto-assign de `quitado` inalterado.

**4. `src/components/atendimento/DispositionPanel.tsx`** (painel do AtendimentoPage — canal voz)
- Receber nova prop opcional `hasRivoAgreement?: boolean` (passada do `AtendimentoPage` que já tem `agreements` carregado — `agreements.length > 0`).
- No `renderChip` (e no botão de `contatoGroup`): se `d.key === "em_dia" && hasRivoAgreement` → `disabled` + `opacity-40` + `title` explicativo.
- No `handleDisposition`: guard inicial `if (type === "em_dia" && hasRivoAgreement) { toast.error("Esta tabulação é exclusiva para clientes em dia com pagamentos originais (sem acordo no Rivo)"); return; }`.

**5. `src/pages/AtendimentoPage.tsx`**
- Passar `hasRivoAgreement={agreements.length > 0}` ao `<DispositionPanel />` (linha 707).

### Defesa em backend (opcional, fora do escopo desta entrega)

Para garantir mesmo via API direta, poderíamos criar um trigger `BEFORE INSERT` em `conversation_disposition_assignments`/`call_dispositions` que rejeita `em_dia`/`wa_em_dia` quando há acordo. **Não** será incluído agora — o bloqueio fica apenas na UI conforme escopo do pedido. Mencionado para o usuário decidir em iteração futura.

### Validação

1. WhatsApp, cliente vinculado **sem** registro em `agreements`: badge "Em Dia" clicável normalmente.
2. WhatsApp, cliente vinculado **com** acordo (qualquer status) no Rivo: badge "Em Dia" aparece desabilitado/cinza, com tooltip explicativo; clicar não faz nada.
3. Modal "Fechar conversa": mesmo comportamento.
4. Auto-assign: cliente com `status_cobranca` "Em dia" mas com acordo no Rivo → não recebe mais `em_dia` automaticamente. Sem acordo → continua recebendo.
5. AtendimentoPage (voz): chip "Em Dia" desabilitado quando `agreements.length > 0`; toast bloqueia tentativas via teclado.
6. Tabulações já registradas anteriormente continuam visíveis (não removemos histórico).

