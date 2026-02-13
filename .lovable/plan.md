

# Adicionar Abas de Historico e Conversa WhatsApp

## O que sera feito

Transformar a area do historico (coluna direita do atendimento) em um componente com abas (Tabs). A primeira aba mostra o historico atual (timeline de tabulacoes, acordos e mensagens). A segunda aba mostra uma interface de conversa WhatsApp estilo chat, preparada para integracao futura.

### Layout proposto

```text
+--------------------------------------------------+
|  [ Historico ]  [ Conversa WhatsApp ]             |
+--------------------------------------------------+
|                                                    |
|  (conteudo da aba selecionada)                     |
|                                                    |
|  Aba Historico: timeline atual (sem mudancas)      |
|                                                    |
|  Aba Conversa: interface estilo chat               |
|  +----------------------------------------------+ |
|  |  Mensagens do cliente (esquerda, cinza)       | |
|  |  Mensagens enviadas (direita, verde)          | |
|  |  ...                                          | |
|  +----------------------------------------------+ |
|  |  [ Digite sua mensagem...     ] [ Enviar ]    | |
|  +----------------------------------------------+ |
|                                                    |
+--------------------------------------------------+
```

## Comportamento

- Aba "Historico" exibe a timeline existente sem alteracoes
- Aba "Conversa" exibe as mensagens do `message_logs` formatadas como bolhas de chat (estilo WhatsApp)
- Campo de digitacao no final da aba Conversa fica desabilitado com placeholder "Integracao em breve" (sera habilitado na fase de integracao)
- As mensagens existentes no `message_logs` ja aparecem na conversa, organizadas cronologicamente

---

## Detalhes Tecnicos

### Arquivo novo: `src/components/atendimento/WhatsAppChat.tsx`

- Componente que recebe as mensagens (`message_logs`) como prop
- Renderiza cada mensagem como bolha de chat:
  - Mensagens enviadas: alinhadas a direita, fundo verde
  - Mensagens recebidas (futuro): alinhadas a esquerda, fundo cinza
- Campo de input + botao "Enviar" no rodape, desabilitado por enquanto
- ScrollArea para rolagem das mensagens
- Mensagem vazia: "Nenhuma conversa registrada"

### Arquivo modificado: `src/components/atendimento/ClientTimeline.tsx`

- Envolver o conteudo atual com o componente `Tabs` do Radix
- Duas abas: "Historico" (conteudo atual) e "Conversa" (WhatsAppChat)
- Receber `messages` como prop e passar para o WhatsAppChat
- Renomear o componente ou manter o nome e adicionar as tabs internamente

### Arquivo: `src/pages/AtendimentoPage.tsx`

- Sem alteracoes significativas, pois `ClientTimeline` ja recebe `messages` como prop

| Arquivo | Acao |
|---------|------|
| `src/components/atendimento/WhatsAppChat.tsx` | Criar - interface de chat com bolhas |
| `src/components/atendimento/ClientTimeline.tsx` | Modificar - adicionar Tabs com aba Historico e Conversa |
