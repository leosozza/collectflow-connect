

# Centralizar botões WhatsApp + Formalizar Acordo no card

## Problema
O botão WhatsApp está posicionado abaixo do nome do cliente (linha 183-192), enquanto o "Formalizar Acordo" está centralizado mais abaixo (linha 222-233). Ambos precisam estar juntos, centralizados no card.

## Solução

**Arquivo:** `src/components/atendimento/ClientHeader.tsx`

1. **Remover** o botão WhatsApp da seção "Name + meta" (linhas 183-192)
2. **Unificar** ambos os botões em uma única `div` centralizada, logo após os stats financeiros:

```tsx
<div className="flex items-center justify-center gap-3 pb-4">
  <Button onClick={openWhatsApp} className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-10 w-10 p-0">
    <MessageCircle className="w-5 h-5 fill-white" />
  </Button>
  {onNegotiate && (
    <Button onClick={onNegotiate} size="lg" className="gap-2 font-bold text-base px-8">
      <Handshake className="w-5 h-5" /> FORMALIZAR ACORDO
    </Button>
  )}
</div>
```

Sem aumentar altura do card — apenas reorganiza o que já existe.

