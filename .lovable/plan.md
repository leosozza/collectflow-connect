

# Fix Valor Saldo + Botão WhatsApp no Atendimento

## 1. Fix "Valor Saldo" — mostrar apenas o que falta pagar

Atualmente o campo `valor_saldo` soma **todos** os registros (inclusive pagos). O correto é somar apenas os registros com `status === "pendente"`, pois representa o saldo restante da dívida original.

**Arquivo:** `src/components/atendimento/ClientHeader.tsx`
- Alterar o renderer `valor_saldo` para filtrar apenas `clientRecords` com status pendente
- Mesmo ajuste para `valor_atualizado` (consistência)

## 2. Botão WhatsApp no header do Atendimento

Adicionar um ícone de WhatsApp (emoji verde) na área superior do `ClientHeader`, ao lado do nome/CPF ou nos stats. Ao clicar:
- Se módulo `whatsapp` habilitado → navega para `/contact-center/whatsapp?phone=55XXXX`
- Se módulo não habilitado → abre `wa.me/55XXXX` em nova aba
- Se cliente não tem telefone → toast de erro

**Arquivo:** `src/components/atendimento/ClientHeader.tsx`
- Importar `useModules` e `useNavigate`
- Adicionar `MessageCircle` (lucide) com cor verde ao lado do nome do cliente
- Implementar `openWhatsApp` seguindo o mesmo padrão do `ClientDetailHeader`

**Arquivo:** `src/pages/AtendimentoPage.tsx`
- Nenhuma mudança necessária (client.phone já está disponível)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/atendimento/ClientHeader.tsx` | Fix valor_saldo (filtrar pendentes) + botão WhatsApp |

