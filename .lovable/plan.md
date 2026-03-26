

# Plano: Datepicker via Dialog + Reemissão de boleto com controle de vigência

## Resumo

O prompt faz total sentido e está bem estruturado. Ele resolve 3 problemas reais:
1. O Popover inline dentro da tabela continua instável — substituir por Dialog é a solução definitiva
2. O botão "Gerar Boleto" hoje fica oculto se já existe boleto — precisa permitir reemissão
3. Não existe controle de boleto substituído — precisa marcar cobranças antigas como obsoletas

## Mudanças

### 1. Substituir Popover por Dialog para edição de data (`AgreementInstallments.tsx`)

- Remover o `Popover`/`PopoverContent`/`Calendar` inline na célula de vencimento (linhas 285-308)
- Remover `setTimeout` do `DropdownMenuItem` "Editar Data" (linhas 395-400)
- Criar estados: `dateEditDialogOpen`, `selectedInstallmentForDateEdit`, `selectedDateForEdit`
- No `DropdownMenuItem`, apenas setar o estado e abrir o Dialog
- O Dialog exibe: título, identificação da parcela (Entrada ou Parcela X/Y), data atual, Calendar, botões Cancelar/Salvar
- Calendar fica estável dentro de Dialog — sem conflito de foco com DropdownMenu
- Ao salvar: chamar `updateInstallmentDate`, fechar Dialog, limpar estados, toast, refresh

### 2. Permitir reemissão de boleto (`AgreementInstallments.tsx`)

- Alterar a condição do botão "Gerar Boleto" (linha 353): remover `!hasBoleto` da condicional
- Quando já existe boleto anterior e a parcela não está paga, mostrar o botão como "Reemitir Boleto"
- Exibir aviso discreto no toast ao gerar quando já existe boleto anterior

### 3. Marcar boletos anteriores como substituídos (`negociarieService.ts`)

- Em `generateSingleBoleto`, antes de salvar a nova cobrança:
  - Buscar cobranças anteriores da mesma parcela (`agreement_id` + número da parcela na `descricao` ou campo identificador)
  - Atualizar status das não-pagas para `"substituido"`
- Só marcar como substituído **após** gerar com sucesso o novo boleto
- Se a geração falhar, não alterar cobranças existentes

### 4. Query de cobrancas vigentes (`AgreementInstallments.tsx`)

- Na query de cobrancas (linhas 49-61), filtrar `.neq("status", "substituido")` para que a UI mostre apenas o boleto vigente
- Preservar histórico no banco — apenas ocultar na interface principal

### 5. Migração SQL

- Adicionar coluna `installment_key` à tabela `negociarie_cobrancas` para identificar a parcela sem depender da `descricao`
- Popular com o número/key da parcela ao gerar boleto

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Substituir Popover por Dialog; permitir reemissão; filtrar substituídos |
| `src/services/negociarieService.ts` | Marcar cobranças anteriores como substituídas; salvar `installment_key` |
| Migração SQL | Adicionar `installment_key` em `negociarie_cobrancas` |

## O que NÃO será alterado

- Edição de valor (já funciona)
- Baixa manual
- Geração de recibo
- Layout geral da tabela
- Fluxo Negociarie (criação de cobrança)
- Outras abas do perfil do cliente

