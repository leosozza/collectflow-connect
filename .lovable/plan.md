

# Botão "NEGOCIAR AGORA" → abrir "Formalizar Acordo" (AgreementCalculator)

## Situação atual
- O botão "NEGOCIAR AGORA" no `DispositionPanel` abre o `NegotiationPanel` (simulador simples com templates de desconto)
- A tela `/carteira/:cpf` (ClientDetailPage) possui o componente `AgreementCalculator` dentro de um Dialog, que é a experiência completa de "Formalizar Acordo" — com seleção de títulos, cálculo de juros/multa/honorários, simulação de parcelas, etc.

## O que será feito
Substituir o `NegotiationPanel` pelo `AgreementCalculator` dentro de um Dialog na página `/atendimento`, reaproveitando exatamente o mesmo componente sem duplicar lógica.

### Arquivos modificados

**`src/pages/AtendimentoPage.tsx`**
- Remover import do `NegotiationPanel`
- Importar `AgreementCalculator` de `@/components/client-detail/AgreementCalculator`
- Importar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- Substituir o bloco `{showNegotiation && <NegotiationPanel .../>}` por um `<Dialog>` com `AgreementCalculator` dentro, passando:
  - `clients={clientRecords}` (registros do CPF)
  - `cpf={client.cpf}`
  - `clientName={client.nome_completo}`
  - `credor={client.credor}`
  - `onAgreementCreated` → invalida queries + fecha dialog + registra tabulação "negotiated"
  - `hasActiveAgreement` → mesma lógica atual
- O `onNegotiate` continuará setando `showNegotiation(true)`, mas agora abre o Dialog

Nenhuma lógica de negócio, endpoint ou componente novo será criado. O `NegotiationPanel` deixa de ser usado nesta página.

