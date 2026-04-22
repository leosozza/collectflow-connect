

## Plano: reprocessar acordos imediatamente ao reduzir `prazo_dias_acordo`

### Comportamento

Ao salvar o cadastro de um credor com **redução** no campo "Prazo para pagamento do acordo" (ex.: 30 → 10), exibir `AlertDialog`:

> Você reduziu o prazo de **30** para **10** dias. Aplicar essa nova regra agora aos acordos vencidos deste credor? Acordos com mais de 10 dias de atraso serão marcados como **Quebra de Acordo** imediatamente.
>
> [Aplicar somente na próxima rotina] [Aplicar agora]

"Aplicar agora" invoca `auto-expire-agreements` restrita ao `credor_id` e mostra toast: *"X acordos expirados, Y clientes movidos para Quebra de Acordo"*.

### Mudanças

**1. `supabase/functions/auto-expire-agreements/index.ts`**
- Aceitar payload opcional `{ credor_id?, tenant_id? }`.
- Detectar modo de chamada:
  - **Cron / system call** (Service Role Key ou sem payload): comportamento atual intacto, processa todos os tenants/credores.
  - **On-demand** (JWT de usuário + payload): valida via `tenant_users` que o usuário é `admin` ou `gestor` do `tenant_id` do credor; restringe `SELECT` de acordos `overdue` a `credor_id = payload.credor_id`.
- Retornar JSON: `{ expired_count, clients_updated, errors: [] }`.
- Em modo on-demand, gravar `audit_logs` com `action = 'auto_expire_agreements_manual'`, `metadata = { credor_id, triggered_by, expired_count }`.
- CORS + validação Zod no payload.

**2. UI de cadastro de credores**
- Após inspeção localizar o componente real (provável `src/components/cadastros/CredorForm.tsx` ou similar dentro de `src/pages/Cadastros`).
- Capturar `prazoOriginal` no `defaultValues`.
- No `onSubmit`: salvar credor normalmente. Se `novoPrazo < prazoOriginal` **e** usuário tem role `admin`/`gestor`, abrir `AlertDialog` antes de fechar o modal.
- Confirmação → `supabase.functions.invoke('auto-expire-agreements', { body: { credor_id, tenant_id } })` → toast com resultado; erro mostra botão "Tentar novamente" sem reverter o salvamento.
- Aumento de prazo (10 → 30) ou role inferior: salva e fecha sem diálogo.

**3. (Opcional) `src/services/cadastrosService.ts`**
- Wrapper `triggerExpireAgreementsForCredor(credorId, tenantId)` para encapsular o invoke + tratamento de erro.

### O que NÃO muda

- Cron diário 03:00 BRT — assinatura sem payload continua idêntica.
- Lógica de cálculo `diffDays >= prazo_dias_acordo`, notificações ao operador, transição do cliente para "Quebra de Acordo" via `auto-status-sync` — reaproveitadas.
- Outros credores não são tocados na execução on-demand.
- RLS, dashboard, carteira, motor de envio — intactos.

### Arquivos alterados

- `supabase/functions/auto-expire-agreements/index.ts`
- Componente do formulário de credor em `src/components/cadastros/` (nome confirmado na implementação)
- (Opcional) `src/services/cadastrosService.ts`

### Validação

1. Editar credor 30 → 10 como admin → diálogo aparece; "Aplicar agora" → toast com contagem; Carteira/Dashboard refletem em segundos.
2. "Aplicar somente na próxima rotina" → modal fecha, nada muda até 03:00 BRT.
3. Editar 10 → 30 → sem diálogo.
4. Operador comum edita prazo → sem diálogo (só salva).
5. Cron diário das 03:00 roda exatamente como hoje.

### Fora de escopo

- Botão global "reaplicar para todos os credores".
- Reabrir acordos já cancelados quando o prazo for aumentado.

