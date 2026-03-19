

# Correção Visual — Telefonia (`/contact-center/telefonia`)

## Problemas

1. **Título duplicado**: "Telefonia" aparece no header do AppLayout E dentro do ThreeCPlusPanel
2. **Sem padding na página**: rota de contact-center remove o padding (`isContactCenterRoute ? "" : "p-4 lg:p-6"`), fazendo o conteúdo colar no sidebar
3. **Espaçamento excessivo** entre header, grupos e sub-abas (`space-y-6`)

## Correções

### `ThreeCPlusPanel.tsx`
- **Remover o header duplicado** (título "Telefonia" + descrição) — já existe no AppLayout
- **Reduzir espaçamento** de `space-y-6` para `space-y-4`
- Também remover o header duplicado da view de operador

### `AppLayout.tsx`
- **Adicionar padding** para a rota de telefonia: mudar a condição para que apenas `/contact-center/whatsapp` remova o padding (WhatsApp precisa de full-bleed para o layout de chat)
- Manter o título "Telefonia" no header como está (`text-lg font-bold`)

| Arquivo | Mudança |
|---|---|
| `ThreeCPlusPanel.tsx` | Remover header duplicado (título + descrição); reduzir space-y-6 → space-y-4 |
| `AppLayout.tsx` | Corrigir condição de padding: só WhatsApp fica sem padding |

