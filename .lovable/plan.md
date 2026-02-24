

## Plano: Tornar seção de Endereço recolhível na aba Dados

### Mudança

**Arquivo: `src/components/cadastros/CredorForm.tsx`** (linhas 294-305)

Substituir o bloco estático de Endereço por um `Collapsible` (já importado na linha 8) com uma seta que permite expandir/recolher os campos.

- O `CollapsibleTrigger` mostra "Endereço" com ícone `ChevronDown` (já importado) que rotaciona ao abrir
- O `CollapsibleContent` envolve o grid de campos (CEP, Rua, Número, etc.)
- Começa fechado por padrão (`defaultOpen={false}`) para manter o formulário limpo
- Se algum campo de endereço já estiver preenchido (edição), abre automaticamente

### Detalhes técnicos

- Usar state `enderecoOpen` controlado pelo Collapsible
- Inicializar como `true` se editando credor com endereço preenchido, `false` caso contrário
- Nenhuma mudança de banco de dados

