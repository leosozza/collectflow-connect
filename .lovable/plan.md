

# Plano: Melhorar página de Acordos — Boletos, Edição de Parcelas e Segunda Via

## Problemas identificados

1. **Sem botão para gerar boleto** — O `AgreementInstallments` mostra boletos existentes (download/PIX) mas não tem botão para **gerar** boleto via Negociarie quando não existe um
2. **Sem opção de editar data da parcela** — As parcelas são virtuais (calculadas a partir de `first_due_date` + `addMonths`), não há como alterar data individual
3. **Erro na geração automática** — O `negociarieService.generateAgreementBoletos` já existe mas não é chamado de nenhum lugar na UI

## Correções

### 1. `src/components/client-detail/AgreementInstallments.tsx` — Adicionar ações por parcela

Transformar de componente de visualização para componente interativo:

- **Botão "Gerar Boleto"** em cada parcela sem boleto vinculado — chama `negociarieService.novaCobranca` para aquela parcela específica e salva em `negociarie_cobrancas`
- **Botão "2ª Via"** quando já existe boleto — abre link do boleto existente (já funciona como "Boleto")
- **Botão "Editar Data"** — permite alterar a data de vencimento de uma parcela individual. Como as parcelas são virtuais, salvar datas customizadas em `negociarie_cobrancas` ou criar um campo `custom_installment_dates` (JSONB) no agreement
- **Copiar Linha Digitável** — botão adicional quando existe `linha_digitavel`
- Status mais claro com ícones

### 2. Persistência de datas customizadas

Adicionar coluna `custom_installment_dates` (JSONB) na tabela `agreements` via migration. Formato: `{ "1": "2026-04-15", "3": "2026-06-20" }` — mapeia número da parcela para data customizada. O `AgreementInstallments` lê esse campo e usa a data customizada em vez da calculada.

### 3. `src/components/client-detail/AgreementInstallments.tsx` — Redesign completo

**Props adicionais**: `onRefresh` callback, `tenantId`

**Novas funcionalidades por parcela**:
- Gerar boleto individual (chama Negociarie)
- Editar data de vencimento (dialog inline com datepicker)
- Download 2ª via do boleto
- Copiar linha digitável / PIX
- Registrar pagamento manual (baixa)

**Layout melhorado**:
- Coluna de ações com dropdown menu em vez de botões soltos
- Indicador visual mais claro (ícones de check, clock, alert)
- Progress bar mostrando % de parcelas pagas

### 4. `src/services/negociarieService.ts` — Método para gerar boleto individual

Extrair lógica de `generateAgreementBoletos` em método `generateSingleBoleto` reutilizável.

## Migration SQL

```sql
ALTER TABLE agreements ADD COLUMN IF NOT EXISTS custom_installment_dates jsonb DEFAULT '{}';
```

## Arquivos a criar/editar

| Arquivo | Mudança |
|---|---|
| `src/components/client-detail/AgreementInstallments.tsx` | Redesign com botões: gerar boleto, 2ª via, editar data, baixa manual |
| `src/services/negociarieService.ts` | Novo método `generateSingleBoleto` |
| `src/pages/AcordosPage.tsx` | Passar `tenantId` e `onRefresh` ao `AgreementInstallments` |
| `src/services/agreementService.ts` | Novo método `updateInstallmentDate` para salvar datas customizadas |
| Migration | Adicionar coluna `custom_installment_dates` em `agreements` |

