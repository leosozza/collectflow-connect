

# Redesign da tela /atendimento conforme o print

## O que muda

### 1. ClientHeader — layout compacto em uma única linha
- Avatar + Nome + Badge "Pendente" + CPF + Credor na esquerda
- Stats financeiros (Em Aberto, Total Pago, Atraso) alinhados à direita na **mesma linha**, sem cards separados
- Remover a seção inferior com cards financeiros (border-t bg-muted/30)
- Remover a linha de telefones e a seção de endereço/custom fields do header
- Manter botões de ação (WhatsApp, Formalizar Acordo) no canto direito

### 2. Layout principal — 3 colunas lado a lado
Atualmente: 1 col (Disposition) + 2 cols (Timeline + Observações empilhados)

Novo layout conforme print:
- **Coluna 1**: Categorização do Chamado (DispositionPanel) — sem alterações no conteúdo
- **Coluna 2**: Histórico de Atendimento (timeline apenas)
- **Coluna 3**: Observações (textarea + notas salvas + botão Salvar Nota)

### 3. ClientTimeline — separar em dois cards
- O componente atual renderiza Timeline + Observações juntos
- Separar para que o `AtendimentoPage` possa posicionar cada um em sua coluna
- Criar props ou exportar dois sub-componentes: um para o histórico, outro para as observações

### Arquivos modificados
- `src/components/atendimento/ClientHeader.tsx` — simplificar para layout de linha única
- `src/components/atendimento/ClientTimeline.tsx` — separar histórico e observações em cards independentes
- `src/pages/AtendimentoPage.tsx` — ajustar grid para 3 colunas

