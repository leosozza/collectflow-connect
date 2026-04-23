

## Plano: ícone verde de telefone ao lado do WhatsApp no header do cliente

### Contexto

Na screenshot, no canto superior direito da ficha do devedor (`ClientHeader.tsx`), aparece hoje:

`[WhatsApp verde]` `[ícone azul de fone — DESLIGAR, só quando em chamada]` `[Formalizar Acordo]`

O usuário pediu para adicionar o **ícone verde de telefone** (mesmo `CallButton` que já está ao lado dos números na grid de campos) **ao lado do botão WhatsApp**, dando acesso 1-clique para discar para o **telefone principal (Hot)** do cliente direto do header — sem precisar expandir "Mais informações do devedor".

### Mudança

**Arquivo único: `src/components/atendimento/ClientHeader.tsx`**

Na seção de Action buttons (linha 346), adicionar o `<CallButton>` **imediatamente antes** do `<Button>` do WhatsApp (linha 360):

```tsx
<CallButton 
  phone={client.phone} 
  clientId={client?.id} 
  size="icon" 
  className="bg-green-500/10 hover:bg-green-500/20 rounded-full h-9 w-9"
/>
```

- Usa `client.phone` (o telefone Hot/principal — mesmo número exibido em "TELEFONE: (18) 98183-2902" da screenshot).
- Mantém o mesmo visual do WhatsApp (círculo verde h-9/w-9, fundo `green-500/10`) para coerência.
- Reutiliza 100% da lógica do `CallButton` já existente: status do agente, pendingCall, redirect para `/contact-center/telefonia`, toast de erro, disabled em `on_call`/`acw`.

### O que NÃO muda

- `CallButton` continua aparecendo também ao lado de cada número na grid (Telefone 1/2/3) — comportamento atual preservado.
- Botão WhatsApp, DESLIGAR e Formalizar Acordo permanecem inalterados.
- Nenhuma mudança no `callService.ts`, `useAtendimentoModal.tsx` ou em outros componentes.
- Cliente sem `phone` cadastrado: o próprio `CallButton` já trata (fica disabled com tooltip "Sem telefone cadastrado").

### Validação

1. Abrir `/atendimento/:clientId` → ver o ícone verde de telefone à esquerda do WhatsApp, mesmo tamanho/estilo.
2. Hover → tooltip "Ligar para (XX) XXXXX-XXXX" com o telefone principal formatado.
3. Cliente sem telefone → ícone aparece mas disabled com tooltip apropriado.
4. Operador em chamada (`on_call`) → ícone disabled com tooltip "Finalize a chamada atual antes de discar".
5. Clique → mesmo fluxo do `CallButton` da grid (disca direto se conectado, ou redireciona para conexão se offline).

### Esforço

1 arquivo, ~6 linhas adicionadas. Sem regressão prevista — feature aditiva.

