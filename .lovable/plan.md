

# Refatoração Visual da Tela /atendimento

Comparando o estado atual dos componentes com o layout de referência do Stitch, as mudanças são puramente visuais e estruturais (CSS/layout). Nenhuma lógica de negócio será alterada.

## Arquivos a modificar

### 1. `src/components/atendimento/ClientHeader.tsx`
- Aumentar o avatar (w-14 h-14), com fundo `bg-slate-200` e ícone de usuário ao invés de iniciais de texto
- Nome em `text-lg font-bold`, badge de status com cores mais vibrantes (PENDENTE em laranja sólido)
- CPF e Credor na linha abaixo, com prefixo "Credor:"
- Stats financeiros separados por divisores verticais (`border-l`) com labels em `text-[11px] uppercase tracking-widest` e valores em `text-base font-bold`
- "Atraso" mostrando "XX Dias" em vez de "XXd"
- Remover ícones dos stats (Wallet, DollarSign, AlertTriangle) -- usar apenas texto como no mockup
- Remover botões de ação (WhatsApp e Formalizar Acordo) do header -- eles ficam na coluna 1

### 2. `src/components/atendimento/DispositionPanel.tsx`
Separar em dois cards distintos:

**Card 1 -- Categorização do Chamado:**
- Titulo com ícone de headset: "CATEGORIZAÇÃO DO CHAMADO"
- Grupo "Resultado do Contato": botões neutros (`bg-white border border-gray-200 text-gray-700`), sem cores fortes; item selecionado com `border-primary bg-primary/5 text-primary`
- Grupo "Erro de Cadastro": item com seta chevron à direita, estilo de select/link
- Remover textarea de observações deste card (já existe na coluna 3)
- Botão "NEGOCIAR AGORA" grande, cor primária escura (ex: `bg-[#1a1f4e]`), ícone de handshake, full-width, `h-14`
- Remover agendamento deste card

**Card 2 -- Agendar Retorno (card separado abaixo):**
- Titulo: "AGENDAR RETORNO"
- Campo datetime com placeholder "dd/mm/aaaa, --:--"
- Ícones de calendário e relógio
- Botão circular de confirmar ao lado do input

### 3. `src/components/atendimento/ClientTimeline.tsx`
**ClientTimeline:**
- Header com ícone de relógio + "Histórico de Atendimento" e link "Ver tudo" em `text-orange-500`
- Timeline vertical com dots circulares vazios (border only, `border-gray-300`) em vez de dots preenchidos coloridos
- Cada item como mini-card com `bg-orange-50/50 border border-orange-100 rounded-lg p-3` para eventos de destaque
- Título em bold, data à direita na mesma linha, operador abaixo em texto menor
- Estado vazio: ícone + "Nenhum registro de atendimento" com texto discreto

**ClientObservations:**
- Header: ícone de edição + "Observações"
- Textarea com placeholder "Adicione uma observação sobre este atendimento..."
- Botão "SALVAR NOTA" em `bg-[#1a1f4e]` (dark navy), alinhado à direita abaixo do textarea
- Notas anteriores: cada nota como card com data/hora à esquerda, nome do operador à direita (em destaque), conteúdo em itálico entre aspas abaixo, com separador vertical colorido (`border-l-4 border-orange-400`)

### 4. `src/pages/AtendimentoPage.tsx`
- Manter a estrutura de 3 colunas `lg:grid-cols-3 gap-6`
- Coluna 1: DispositionPanel (card categorização) + Card "Agendar Retorno" separado
- Coluna 2: ClientTimeline
- Coluna 3: ClientObservations
- Background geral: `bg-gray-50/50` no container
- Espaçamento entre header e corpo: `gap-6`

## Resumo das mudanças

Todos os 4 arquivos serão reescritos visualmente. Nenhuma query, mutation, serviço ou integração será alterada. A separação do "Agendar Retorno" em card próprio será feita extraindo a lógica de callback do `DispositionPanel` para um componente inline no `AtendimentoPage`, ou renderizando-o como seção separada dentro do mesmo componente.

