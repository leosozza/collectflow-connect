

## Voltar Abas para o Topo e Reposicionar Botao de Respostas Rapidas

### 1. Navegacao: Voltar abas para formato horizontal no topo

**Arquivo: `src/pages/ContactCenterPage.tsx`**

Substituir a barra lateral vertical por abas horizontais no topo da pagina, no estilo de cards/pills:
- Layout volta a ser `flex-col` (vertical) em vez de `flex` (horizontal)
- Barra de abas no topo com botoes estilizados como pills/cards horizontais com icone + label
- Operador ve apenas "Conversas"; admin ve todas as 4 abas
- Conteudo ocupa o restante da altura abaixo

### 2. Botao de Respostas Rapidas: mover para ao lado do microfone

**Arquivo: `src/components/contact-center/whatsapp/ChatInput.tsx`**

O botao de respostas rapidas (Zap/raio) atualmente esta posicionado entre o botao de anexo e o AudioRecorder. O usuario quer que fique **ao lado do microfone**, ou seja, apos o AudioRecorder.

Mudanca:
- Mover o bloco do Popover de quick replies (linhas 140-175) para **depois** do `<AudioRecorder>` (linha 177)
- Ordem final dos icones: Emoji, Anexo, Microfone, **Raio (Respostas Rapidas)**, Nota Interna

### Detalhes Tecnicos

**`src/pages/ContactCenterPage.tsx`:**
- Remover layout `flex` horizontal com sidebar de 52px
- Adicionar barra horizontal no topo com `flex gap-2 px-4 py-2 border-b`
- Botoes como pills: icone + texto, com destaque na aba ativa
- Conteudo em `flex-1 overflow-hidden` abaixo

**`src/components/contact-center/whatsapp/ChatInput.tsx`:**
- Reordenar: mover o bloco Quick Replies Popover para depois do AudioRecorder
