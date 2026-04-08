

# Reestruturar Layout da Lista de Conversas (Referência WhatsApp)

## Problema
O layout atual tem `overflow-hidden` no container flex externo (linha 392) que corta os indicadores. Além disso, a estrutura das linhas difere da referência fornecida.

## Referência (app fornecido)
```text
┌──────────────────────────────────────────┐
│ [Avatar]  Título           (3)  09:36    │  ← Row 1: nome + badge não lido + hora
│           Campanha / Status badges       │  ← Row 2: badges opcionais
│           ✓ Última mensagem preview...   │  ← Row 3: preview (bold se não lido)
│           👤 Nome operador               │  ← Row 4: operador
└──────────────────────────────────────────┘
```

## Mudanças

**Arquivo:** `src/components/contact-center/whatsapp/ConversationList.tsx`

### 1. Remover `overflow-hidden` do container flex (linha 392)
O `overflow-hidden` no `<div className="flex items-center gap-3 w-full min-w-0 overflow-hidden">` é a causa principal dos indicadores cortados. Remover, mantendo `min-w-0`.

### 2. Reestruturar Row 1 conforme referência
Mover o badge de não lidas (atualmente na Row 2, linhas 460-464) para a Row 1, entre o nome e o horário:
```
Nome truncado ... (badge não lidas) Horário
```

### 3. Row 2: Message preview + SLA/status
Manter a preview da mensagem com truncate. O preview ficará **bold** (`font-semibold text-foreground`) quando `unread_count > 0`. Adicionar prefixo `✓` para mensagens outbound como na referência.

### 4. Manter Row 3 (dispositions) inalterada

### Resultado
Layout idêntico à referência, com todos os indicadores visíveis e texto truncado corretamente.

