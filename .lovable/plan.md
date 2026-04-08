

# Indicador de Não Lidas no Padrão WhatsApp

## O que já existe
- Badge verde com contagem de não lidas já renderiza (linha 422-426)
- Horário da última mensagem já aparece (linha 371-373)

## O que mudar

**Arquivo:** `src/components/contact-center/whatsapp/ConversationList.tsx`

### 1. Horário fica verde quando há não lidas
O `<span>` do horário (linha 371) deve usar `text-[#25d366] font-medium` quando `conv.unread_count > 0`, em vez do cinza padrão. Isso replica o padrão do WhatsApp onde o horário muda de cor para indicar mensagem nova.

### 2. Reposicionar badge para alinhar com horário
No WhatsApp, o horário fica no canto superior direito e o badge de contagem fica logo abaixo, alinhado à direita. Atualmente ambos estão na mesma linha inferior. A mudança:
- Mover o badge de não lidas para a **linha do horário** (canto superior direito, abaixo do timestamp), criando um layout em coluna no lado direito
- O badge ficará alinhado à direita na segunda linha, exatamente como no screenshot anexado

### 3. Layout alvo
```text
┌─────────────────────────────────┐
│ [Avatar]  Nome do Contato  09:36│  ← horário verde se não lida
│           Última mensagem   (10)│  ← badge verde à direita
└─────────────────────────────────┘
```

### Mudanças técnicas
- Linha 371: adicionar classe condicional `text-[#25d366] font-medium` quando `unread_count > 0`
- Linhas 383-426: mover o `Badge` de não lidas para dentro do bloco superior (junto ao horário), mantendo SLA e status dot na linha inferior
- Nenhuma mudança de dados ou backend necessária

