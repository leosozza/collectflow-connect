

# Integrar botão WhatsApp ao CRM interno

## O que muda

No `ClientDetailHeader`, o botão WhatsApp (ícone verde) atualmente abre `wa.me` externo. A alteração fará com que, **se o módulo `whatsapp` estiver ativo no tenant**, o clique navegue para `/contact-center/whatsapp` (CRM interno). Caso contrário, mantém o comportamento atual (wa.me externo).

A mesma lógica será aplicada aos botões de WhatsApp no popover de "Todos os Telefones".

## Alterações

### `src/components/client-detail/ClientDetailHeader.tsx`
1. Importar `useModules` de `@/hooks/useModules`
2. Dentro do componente, chamar `const { isModuleEnabled } = useModules()`
3. Alterar a função `openWhatsApp` (linha 148-156):
   - Se `isModuleEnabled("whatsapp")` → `navigate("/contact-center/whatsapp")` (futuramente pode passar query param com telefone para abrir conversa específica)
   - Senão → manter comportamento atual (`window.open(wa.me/...)`)
4. Alterar o botão WhatsApp no popover de telefones (linha 339-344): mesma lógica condicional

Nenhum outro arquivo precisa ser alterado.

