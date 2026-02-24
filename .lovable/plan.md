

## Filtro Multi-Agencia com Busca Dinamica

### O que sera feito

Substituir o Select simples de agencia por um componente multi-select com busca por texto, permitindo:
- Digitar texto para filtrar agencias (ex: "Pinheiros" filtra todas que contem esse texto)
- Selecionar multiplas agencias simultaneamente
- Gerar filtro OData com OR entre as agencias selecionadas: `(IdAgency+eq+1+or+IdAgency+eq+8)`

### Mudancas

**Arquivo:** `src/pages/MaxListPage.tsx`

1. **State `agencia`**: Mudar de `string` para `string[]` (array de IDs selecionados). Valor padrao: `[]` (todas)

2. **Componente de filtro**: Substituir o `Select` simples por um Popover customizado com:
   - Campo de busca (Input) que filtra a lista de agencias por texto (Name)
   - Lista de checkboxes para selecao multipla
   - Opcao "Todas" que limpa a selecao
   - Label dinamico: "Todas", nome da unica selecionada, ou "X selecionadas"

3. **Funcao `buildFilter`**: Atualizar para gerar filtro com OR quando multiplas agencias selecionadas:
   - 1 agencia: `IdAgency+eq+1`
   - Multiplas: `(IdAgency+eq+1+or+IdAgency+eq+8+or+IdAgency+eq+10)`
   - Nenhuma (todas): nao adiciona filtro

### Detalhes tecnicos

**Novo state:**
```text
// Antes
agencia: "todas"

// Depois  
agencias: [] as string[]   // vazio = todas
```

**Filtro OData multi-agencia:**
```text
// buildFilter - trecho novo
if (filters.agencias.length > 0) {
  const agencyParts = filters.agencias.map(id => `IdAgency+eq+${id}`);
  if (agencyParts.length === 1) {
    parts.push(agencyParts[0]);
  } else {
    parts.push(`(${agencyParts.join('+or+')})`);
  }
}
```

**Componente de selecao**: Usar um Popover com Input de busca + lista de Checkboxes, filtrando `agencies` pelo texto digitado contra `ag.Name.toLowerCase()`.

| Arquivo | Mudanca |
|---|---|
| `src/pages/MaxListPage.tsx` | Multi-select com busca para agencias, filtro OData com OR |

