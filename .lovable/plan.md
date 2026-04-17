
## Diagnóstico — Hot button não aparece em `/carteira/:cpf`

A funcionalidade Hot foi adicionada no `ClientHeader.tsx` (usado em `/atendimento`), mas a tela que o usuário está vendo (`/carteira/70494299452?credor=...`) renderiza o `ClientDetailHeader.tsx` (em `src/components/client-detail/`), que é um componente **diferente** e não tem o ícone Flame.

### Correção

Replicar a lógica Hot no `ClientDetailHeader.tsx`:

**Arquivo**: `src/components/client-detail/ClientDetailHeader.tsx` (~30 linhas)

1. Importar `Flame` do lucide e `promotePhoneToHot, type PhoneSlot` do serviço já existente.
2. Importar `useQueryClient` e `useTenant` (se ainda não estiverem) + `toast`.
3. Adicionar `handlePromoteHot(slot)` e componente local `HotBadge` (cópia do padrão usado em `ClientHeader.tsx` linhas 64-107).
4. Nas linhas 402-404 (grid de Telefone 1/2/3 dentro do collapsible expandido), trocar o `InfoItem` por um wrapper que renderiza o telefone + ícone `Flame` ao lado:
   - Telefone 1 → chama laranja preenchida (atual Hot).
   - Telefones 2 e 3 → chama cinza clicável (promove ao Hot) — só aparece se o valor existir.
5. Após sucesso, `queryClient.invalidateQueries()` para o card recarregar com a nova ordem.

### Sem alteração
- `clientPhoneService.ts` (já existe e funciona).
- `ClientHeader.tsx` (atendimento — já tem Hot).
- Schema, RLS, edge functions.
- Lógica do botão WhatsApp (continua usando `client.phone` = Hot).

### Observação
A tela do print mostra apenas "Telefone 1" preenchido — só haverá ícones clicáveis quando o cliente tiver pelo menos 2 telefones. No Telefone 1 a chama laranja vai aparecer mesmo solitário, sinalizando que ele é o Hot atual.
