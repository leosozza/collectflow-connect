

# Corrigir Layout e Observações no "Mais Informações do Devedor"

## Problemas Identificados

1. **Layout desalinhado**: O grid expandido usa `grid-cols-2 md:grid-cols-3 lg:grid-cols-4` com `gap-x-6 gap-y-3`, mas os itens têm tamanhos inconsistentes — o campo "Observações" ocupa espaço desproporcional e quebra o alinhamento visual.

2. **Campo Observações mostrando dados errados**: O campo `observacoes` em `ClientHeader` puxa `client.observacoes`, que é o campo onde o sistema concatena notas de operadores (formato `data | operador texto`). Esse campo **não** deveria aparecer no card de informações cadastrais do devedor — ele já é exibido na seção de "Observações" da timeline (`ClientObservations`). No card expandido, apenas dados originais/cadastrais devem aparecer.

## Mudanças

### 1. `src/components/atendimento/ClientHeader.tsx`

- **Remover** o campo `observacoes` do `FIELD_RENDERERS` — esse dado não é informação cadastral original, é histórico de notas de operadores e já é exibido na timeline.
- **Ajustar o grid** da `CollapsibleContent` para um layout mais uniforme e alinhado com o card principal:
  - Usar `grid-cols-4` fixo em telas `lg+` com gap consistente
  - Adicionar `border-t border-border` no topo da área expandida para continuidade visual com o card
  - Remover o `pt-3` e usar padding uniforme `py-4 px-6`
- **Melhorar o `InfoItem`**: garantir que todos os itens tenham altura mínima consistente para alinhamento em grid

