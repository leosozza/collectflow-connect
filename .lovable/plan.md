

# Plano: Formalização de Acordo com Dados Incompletos (Boleto Pendente)

## Estado Atual

O fluxo já existe parcialmente no `AgreementCalculator.tsx`:
- Ao gravar acordo BOLETO, valida campos obrigatórios via `checkRequiredFields()`
- Se faltam campos, abre dialog com "Pular (sem boleto)" e "Salvar e Gerar Boletos"
- Ao pular, o acordo é criado mas não há flag `boleto_pendente` nem botão para gerar depois

**O que falta:**
1. Coluna `boleto_pendente` na tabela `agreements` para marcar acordos sem boleto
2. Ao clicar "Pular", gravar `boleto_pendente = true` no acordo
3. Exibir badge "Boleto pendente" no painel de parcelas (`AgreementInstallments`)
4. Botão "Gerar Boletos" no `AgreementInstallments` quando `boleto_pendente = true`
5. Ao gerar boletos depois, revalidar dados e reabrir modal se necessário
6. Logs de auditoria para cada etapa

## Alterações

### 1. Migration: adicionar coluna `boleto_pendente`

```sql
ALTER TABLE public.agreements ADD COLUMN boleto_pendente boolean NOT NULL DEFAULT false;
```

### 2. `src/components/client-detail/AgreementCalculator.tsx`

- No "Pular (sem boleto)": após fechar dialog, atualizar acordo com `boleto_pendente = true`
- Registrar evento de auditoria `acordo_criado_sem_boleto` via `logAction` com campos faltantes nos details

### 3. `src/components/client-detail/AgreementInstallments.tsx`

- Detectar `agreement.boleto_pendente === true` e nenhuma cobrança existente
- Exibir banner "Boleto pendente — dados incompletos na criação"
- Adicionar botão "Gerar Boletos"
- Ao clicar:
  - Validar dados do cliente via `clientProfileService.getClientProfile`
  - Se completos: gerar boletos para todas as parcelas via `negociarieService.generateAgreementBoletos`, atualizar `boleto_pendente = false`
  - Se incompletos: abrir dialog de preenchimento (mesmo padrão do Calculator), salvar dados, gerar boletos, atualizar flag
- Registrar auditoria `boleto_gerado_posteriormente` + `dados_cliente_atualizados`

### 4. `src/services/agreementService.ts`

- Adicionar `boleto_pendente` ao tipo `Agreement`

### 5. Exibição na lista de acordos

- `AgreementsList.tsx`: exibir badge "Boleto pendente" ao lado do status quando `boleto_pendente === true`

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Adicionar coluna `boleto_pendente` |
| `src/services/agreementService.ts` | Adicionar campo ao tipo |
| `src/components/client-detail/AgreementCalculator.tsx` | Marcar `boleto_pendente=true` ao pular |
| `src/components/client-detail/AgreementInstallments.tsx` | Banner + botão "Gerar Boletos" + dialog de dados faltantes |
| `src/components/acordos/AgreementsList.tsx` | Badge "Boleto pendente" |

Nenhuma alteração visual desnecessária. Fluxo existente preservado.

