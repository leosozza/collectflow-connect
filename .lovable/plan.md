

## Plano: Adicionar indicador visual de campos obrigatórios no ClientForm

### Alteração

**Arquivo**: `src/components/clients/ClientForm.tsx`

Adicionar um asterisco vermelho (`*`) ao lado do texto dos Labels dos campos obrigatórios, e uma legenda no topo do formulário.

**Campos obrigatórios** (baseado na validação `clientSchema`):
- Nome Completo
- CPF
- Credor
- Nº da Parcela
- Total de Parcelas
- Data de Vencimento
- Valor de Entrada
- Valor das Demais Parcelas
- Status

**Campos opcionais** (sem asterisco):
- Telefone, Email, ID Externo, Valor Pago, Endereço, Cidade, UF, CEP, Observações

### Implementação

1. Adicionar legenda `<p className="text-xs text-muted-foreground">* Campos obrigatórios</p>` antes do grid
2. Substituir cada `<Label>Campo</Label>` obrigatório por `<Label>Campo <span className="text-destructive">*</span></Label>`

Labels afetados (linhas): 94, 105, 147, 159, 170, 182, 192, 205, 230.

