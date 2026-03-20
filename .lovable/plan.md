

# Plano: Baixar boletos Negociarie na Gestão de Acordos

## Contexto

Sim, ao formalizar o acordo com pagamento BOLETO, os boletos são gerados via API Negociarie e salvos na tabela `negociarie_cobrancas` com `agreement_id`, `link_boleto`, `linha_digitavel`, `pix_copia_cola`, etc.

O problema é que o `AgreementInstallmentsPanel` usado na página `/acordos` **não consulta a `negociarie_cobrancas`** — ele gera parcelas virtuais e oferece "Gerar Boleto" via Asaas (gateway diferente). Já existe um componente correto: `AgreementInstallments` (em `client-detail/`) que **já consulta `negociarie_cobrancas`** por `agreement_id` e exibe botão "Baixar Boleto" quando `link_boleto` existe.

## Solução

Substituir o `AgreementInstallmentsPanel` (que gera boletos novos via Asaas) pelo `AgreementInstallments` (que busca boletos já gerados na Negociarie) na página de Acordos.

## Mudanças

### 1. `src/pages/AcordosPage.tsx`

- Trocar o import de `AgreementInstallmentsPanel` por `AgreementInstallments` (de `@/components/client-detail/AgreementInstallments`)
- Atualizar a chamada na linha 295 para passar as props corretas: `agreementId={editingAgreement.id}`, `agreement={editingAgreement}`, `cpf={editingAgreement.client_cpf}`

### 2. `src/components/client-detail/AgreementInstallments.tsx`

- Fix na query da linha 26: atualmente filtra por `client_id.eq.${agreementId}`, mas deveria filtrar por `agreement_id.eq.${agreementId}` (o campo correto na tabela)
- Isso é o motivo pelo qual os boletos não aparecem mesmo existindo na base

### 3. Remover ou deprecar `AgreementInstallmentsPanel.tsx`

- O componente que gera boletos via Asaas pode ser removido, já que os boletos são gerados via Negociarie na formalização do acordo

## Resumo

| Arquivo | Mudança |
|---|---|
| `src/pages/AcordosPage.tsx` | Trocar `AgreementInstallmentsPanel` por `AgreementInstallments` com props corretas |
| `src/components/client-detail/AgreementInstallments.tsx` | Fix: `client_id.eq.` → `agreement_id.eq.` na query |
| `src/components/acordos/AgreementInstallmentsPanel.tsx` | Remover (não mais necessário) |

