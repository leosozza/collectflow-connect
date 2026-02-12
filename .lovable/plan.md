# Notificações em Tempo Real para Operadores

## Resumo

Implementar dois tipos de notificações para operadores:

1. **Popup de parabenização** (modal central) quando um novo acordo for registrado para o operador
2. **Notificação de pagamento** (toast discreto) quando um cliente efetua pagamento

A caixinha de notificações (sino) já existe no canto superior direito do header -- vamos mantê-la e aprimorá-la com esses novos comportamentos visuais.

---

## O que será feito

### 1. Popup de Parabenização por Novo Acordo

Quando o sistema Realtime detectar uma nova notificação do tipo `success` com `reference_type = "agreement"`, exibir um **Dialog modal centralizado** com:

- Icone de celebração (confetti/troféu)
- Mensagem "Parabéns! Novo acordo realizado!"
- Nome do cliente e detalhes do acordo
- Botão para fechar

### 2. Toast de Pagamento Recebido

Quando chegar uma notificação do tipo `success` com `reference_type = "payment"`, exibir um **toast discreto** no canto superior direito usando o Sonner (já instalado), com o nome do cliente e valor pago.

### 3. Lógica de Detecção

Modificar o hook `useNotifications.ts` para:

- Detectar notificações **novas** (INSERT) via Realtime (já configurado)
- Comparar com as notificações anteriores para identificar as recém-chegadas
- Disparar o popup ou toast conforme o tipo da notificação

---

## Detalhes Técnicos

### Arquivo: `src/hooks/useNotifications.ts`

- Alterar o listener de Realtime para capturar o `payload` do evento INSERT
- Quando `event === "INSERT"`, verificar o `payload.new`:
  - Se `reference_type === "agreement"` e `type === "success"`: disparar callback de popup
  - Se `reference_type === "payment"` e `type === "success"`: disparar toast via Sonner
- Expor um estado `celebrationNotification` para o componente de popup consumir

### Arquivo (novo): `src/components/notifications/AgreementCelebration.tsx`

- Dialog modal centralizado com animação (framer-motion, já instalado)
- Icone de troféu/celebração
- Exibe título e mensagem da notificação
- Botão "Fechar" que marca como lida

### Arquivo: `src/components/AppLayout.tsx`

- Importar e renderizar `AgreementCelebration` no layout principal
- Passar estado do hook `useNotifications` para controlar abertura do popup

### Arquivo: `src/hooks/useNotifications.ts`

- Adicionar estado para controlar popup de celebração
- Adicionar disparo de toast (Sonner) para notificações de pagamento

### Arquivos de notificação existentes

- `NotificationBell.tsx` e `NotificationList.tsx` permanecem como estão (já discretos no canto superior direito)

---

## Resumo dos Arquivos


| Arquivo                                                 | Ação                                                      |
| ------------------------------------------------------- | --------------------------------------------------------- |
| `src/hooks/useNotifications.ts`                         | Modificar - detectar novos INSERTs e disparar popup/toast |
| `src/components/notifications/AgreementCelebration.tsx` | **Novo** - Modal de parabenização                         |
| `src/components/AppLayout.tsx`                          | Modificar - renderizar AgreementCelebration               |
