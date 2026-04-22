

## Aviso no sininho ao desconectar número de WhatsApp

### Onde a desconexão é detectada hoje
A Edge Function `whatsapp-webhook` recebe o evento `connection.update` da Evolution e atualiza `whatsapp_instances.status = 'disconnected'` (linha 38). Hoje **só atualiza o status**, sem notificar ninguém.

### Correção proposta

**1. Adicionar bloco de notificação no `whatsapp-webhook/index.ts`**

Quando `state === 'close'` (e o status anterior era diferente de `disconnected`, para evitar spam), disparar notificações via RPC `create_notification` para:

- **Operadores vinculados à instância** — buscar em `operator_instances` (JOIN com `profiles` para obter `user_id`) onde `instance_id = inst.id`.
- **Admins do tenant** — buscar em `profiles` onde `tenant_id = inst.tenant_id AND role = 'admin'`.

Deduplicar por `user_id` (um admin que também é operador da instância recebe só 1 notificação).

Payload da notificação:
```ts
{
  _tenant_id: inst.tenant_id,
  _user_id: <user_id>,
  _title: "WhatsApp desconectado",
  _message: `A instância "${inst.name}" foi desconectada. Reconecte pelo painel para retomar os disparos.`,
  _type: "warning",
  _reference_type: "whatsapp_instance",
  _reference_id: inst.id,
}
```

**2. Anti-spam (lookup do status anterior)**

Antes de inserir, ler `status` atual da instância. Se já estava `disconnected`, pular notificações. Garante que só dispara na **transição** connected → disconnected.

**3. Cobertura para Gupshup (oficial)**

Em `gupshup-webhook/index.ts`, quando o evento de status da conta indicar desconexão/expiração de sessão, replicar o mesmo bloco. (Vou inspecionar os tipos de evento que o Gupshup envia e tratar `account-event` / equivalente — se não houver evento explícito, deixo como TODO documentado e foco em Evolution/Wuzapi, que cobrem 100% das instâncias não-oficiais.)

**4. Feedback visual no sininho**

Já existe: `NotificationBell` + `NotificationList` renderizam o badge vermelho automaticamente via realtime na tabela `notifications` (`type='warning'` usa o ícone/cor de alerta). Nenhuma mudança no front.

**5. Realtime já habilitado**

A migration `20260211155027` já fez `ALTER PUBLICATION supabase_realtime ADD TABLE notifications`. O hook `useNotifications` recebe o INSERT na hora.

### Validação pós-deploy

1. Forçar uma desconexão (botão Desconectar em uma instância de teste) → confirmar que o webhook dispara e a notificação aparece para operador vinculado + admin do tenant.
2. Conferir que disparar novamente não cria duplicata enquanto status já está `disconnected`.
3. Confirmar via SQL: `SELECT * FROM notifications WHERE reference_type='whatsapp_instance' ORDER BY created_at DESC LIMIT 5`.

### Arquivos alterados

- **`supabase/functions/whatsapp-webhook/index.ts`** — adicionar bloco de notificação dentro de `if (event === "connection.update")` quando state vira `close`.
- **`supabase/functions/gupshup-webhook/index.ts`** — replicar para evento equivalente (após inspeção do payload).

### Fora de escopo

- UI do sininho (já funcional).
- E-mail/push externo (apenas in-app por ora).
- Reconexão automática.

### Próximo passo

Confirme **"Aplicar"** e eu implemento o bloco de notificação + faço o teste de transição real numa instância.

