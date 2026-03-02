

## Plano: Botão "Novo Campo Personalizado" nas listas de mapeamento

Adicionar um botão "Novo Campo Personalizado" no final dos selects de campo destino nos 3 componentes de mapeamento, permitindo criar campos custom inline sem sair do fluxo.

### Abordagem

Criar um componente reutilizável `InlineCustomFieldDialog` que encapsula o mini-formulário de criação de campo (nome, tipo, opções). Esse componente será usado nos 3 locais:

1. **`FieldMappingConfig.tsx`** — No select "Campo do Sistema" de cada linha (linha 321-331), adicionar ao final da lista de `SelectItem` um botão "Novo Campo" que abre o dialog inline. Após criar, o campo é automaticamente selecionado na linha.

2. **`ImportDialog.tsx`** — No select de mapeamento (linha 309-324), mesma lógica: botão no final do select que abre o dialog, cria o campo e seleciona.

3. **`MaxListMappingDialog.tsx`** — No select de campo destino, adicionar o botão após os `allFields`. O `allFields` já inclui custom fields dinâmicos; após criar um novo, atualizar a lista local.

### Componente `InlineCustomFieldDialog`

**Arquivo:** `src/components/cadastros/InlineCustomFieldDialog.tsx`

- Props: `tenantId`, `onCreated(field: CustomField)`, trigger element
- Mini-formulário: Nome do campo, Tipo (text/number/date/select), Opções (se select)
- Chave gerada automaticamente a partir do label
- Usa `createCustomField` do `customFieldsService`
- Invalida query `custom-fields` após criar

### Alterações nos componentes

- **`FieldMappingConfig.tsx`**: Importar custom fields via query, injetar no select junto com `SYSTEM_FIELDS`, adicionar botão "Novo Campo" no final do `SelectContent`
- **`ImportDialog.tsx`**: Mesmo padrão — buscar custom fields, injetar no select, botão no final
- **`MaxListMappingDialog.tsx`**: Já busca custom fields; adicionar botão no final do select que abre o dialog inline

### Arquivos criados
- `src/components/cadastros/InlineCustomFieldDialog.tsx`

### Arquivos editados
- `src/components/cadastros/FieldMappingConfig.tsx`
- `src/components/clients/ImportDialog.tsx`
- `src/components/maxlist/MaxListMappingDialog.tsx`

