

# Transformar "Ir para Atendimento" em "Abrir Perfil do Cliente"

## Alteração

### Arquivo: `src/components/contact-center/whatsapp/ContactSidebar.tsx`

Na linha 320-328, trocar:
- **Texto**: "Ir para Atendimento" → "Abrir Perfil do Cliente"
- **Ícone**: `Headphones` → `User` (ou `UserCircle`)
- **Navegação**: `navigate(`/atendimento/${linkedClient.id}?channel=whatsapp`)` → `navigate(`/carteira/${linkedClient.cpf.replace(/\D/g, "")}`)` — abre o perfil completo do cliente

O botão "Atendimento" no header do chat já cumpre a função de abrir a tela de atendimento, então esse botão passa a dar acesso rápido ao perfil/carteira do cliente.

