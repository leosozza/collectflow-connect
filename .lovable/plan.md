

# Redesign da Tela de Atendimento (inspirado no Stitch)

## Visão Geral
Reorganizar o layout da tela `/atendimento` para ficar mais próximo do design de referência Stitch: cabeçalho compacto com avatar e status, painel de categorização à esquerda, histórico + observações à direita, layout mais limpo e profissional.

## Alterações

### 1. `src/components/atendimento/ClientHeader.tsx` — Compactar header
- Redesenhar para layout horizontal compacto: avatar (iniciais) à esquerda, nome + status badge + CPF/credor em linha, cards financeiros (Em Aberto, Total Pago, Atraso em dias) à direita como mini stat-cards
- Calcular "Atraso" em dias a partir de `data_vencimento` mais antiga vencida
- Mover botões WhatsApp e Formalizar Acordo para o header junto ao nome
- Remover o Collapsible de detalhes — mostrar telefones e dados secundários de forma mais inline
- Manter o dialog de edição de telefones e custom fields

### 2. `src/components/atendimento/DispositionPanel.tsx` — Categorização visual
- Renomear card title para "Categorização do Chamado"
- Organizar botões em layout de grid mais compacto: 2 colunas para os botões de resultado (Caixa Postal, Ocupado, Interrompida, Não Atende)
- Separar seção "Erro de Cadastro" com sub-opções como no Stitch (Telefone Incorreto com chevron)
- Botão "NEGOCIAR AGORA" destacado com ícone handshake e cor primary/orange
- "Agendar Retorno" com ícone de relógio como seção separada
- Manter textarea de observações

### 3. `src/components/atendimento/ClientTimeline.tsx` — Histórico + Observações
- Dividir a coluna direita em duas seções com Tabs ou stacked cards:
  - **Histórico de Atendimento**: timeline como está, mas com layout mais limpo com linha vertical de timeline, mostrar operador e label "Sistema" quando automático, adicionar botão "Ver tudo"
  - **Observações**: Seção separada com textarea para salvar notas (persistir na tabela `call_dispositions` ou `clients.observacoes`), lista de notas anteriores com data/hora e autor

### 4. `src/pages/AtendimentoPage.tsx` — Layout refinado
- Manter grid 1/3 (esquerda: disposição) + 2/3 (direita: histórico + observações)
- Adicionar breadcrumb compacto no header: `home / Atendimento em Curso`
- Quando embedded, omitir breadcrumb
- Passar dados de atraso (dias) ao ClientHeader

### 5. Observações inline (novo)
- Adicionar state `observacao` no AtendimentoPage
- Mutation para salvar observação no campo `clients.observacoes` (append com timestamp e nome do operador)
- Exibir lista de observações anteriores parseando o texto ou como entries separadas no timeline
- Alternativamente, criar entries na `call_dispositions` com type "note" para manter histórico estruturado

## Detalhes de UI
- Cards financeiros: fundo sutil, ícone + valor grande + label pequeno
- Botões de disposição: pills/chips coloridos em grid 2 colunas
- Timeline: linha vertical à esquerda conectando os pontos, estilo mais profissional
- Cores: usar orange (#f97316) como primary para destaque do botão Negociar

