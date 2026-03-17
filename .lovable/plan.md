

# Ajustes no layout da tela de Atendimento

## Mudanças

### 1. Botão WhatsApp — usar mesmo estilo do perfil na Carteira
O botão WhatsApp no `ClientHeader` será um botão maior e mais evidente (verde, com fundo arredondado e ícone preenchido), similar ao usado em `ClientDetailHeader`.

### 2. Botão "Formalizar Acordo" — mover para o card superior
Adicionar um botão `FORMALIZAR ACORDO` (com ícone Handshake) ao lado do botão WhatsApp no `ClientHeader`, na linha do nome do devedor. O `onNegotiate` callback será passado como prop.

### 3. "Mais informações" — expandir dentro do mesmo card visualmente
Atualmente o `CollapsibleContent` renderiza com `border-t` criando um visual de card separado. Remover o `border-t` do conteúdo expandido e ajustar para que flua naturalmente dentro do mesmo card, sem separação visual.

### 4. Reordenar cards no DispositionPanel
Inverter a ordem: "Agendar Retorno" primeiro, "Categorização da Chamada" depois. O botão "FORMALIZAR ACORDO" será removido do DispositionPanel (já estará no header).

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/atendimento/ClientHeader.tsx` | Botão WhatsApp maior + botão Formalizar Acordo + fix visual collapsible |
| `src/components/atendimento/DispositionPanel.tsx` | Remover botão Formalizar Acordo, inverter ordem dos cards |
| `src/pages/AtendimentoPage.tsx` | Passar `onNegotiate` como prop ao ClientHeader |

