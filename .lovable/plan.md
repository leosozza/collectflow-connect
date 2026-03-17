

# Remover campo "Ordem" do formulário de Categorização

## O que muda
- Remover o campo `Input type="number"` de "Ordem" do Dialog de criação/edição em `CallDispositionTypesTab.tsx`
- Remover a coluna "Ordem" da tabela de listagem
- Auto-atribuir `sort_order` automaticamente: ao criar, usar `types.length` como valor (fica no final da lista)
- O campo continua existindo no banco para ordenação, mas o usuário não precisa gerenciá-lo manualmente

## Arquivo
- `src/components/cadastros/CallDispositionTypesTab.tsx`: remover input de ordem do dialog, remover coluna da tabela, manter atribuição automática no `openNew`

