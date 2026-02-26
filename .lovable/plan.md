

## Problema Identificado

O botao "Solicitar Liberacao" existe no codigo, mas so aparece quando `credorRules` esta preenchido. Atualmente, as paginas `AtendimentoPage.tsx` e `TelefoniaAtendimento.tsx` **nao passam** a prop `credorRules` para o `NegotiationPanel`. Sem essa prop, a validacao sempre retorna `isOut: false`, e o botao sempre mostra "Gerar Acordo".

O `AgreementCalculator.tsx` busca as regras do credor internamente via `useEffect`, entao funciona la. Mas o `NegotiationPanel` depende de receber `credorRules` como prop.

## Plano de Correcao

### 1. AtendimentoPage.tsx — buscar e passar credorRules

- Adicionar query para buscar regras do credor (usando `client.credor` e `tenant_id`) da tabela `credores`
- Passar resultado como prop `credorRules` no `<NegotiationPanel />`

### 2. TelefoniaAtendimento.tsx — mesma correcao

- Adicionar query para buscar regras do credor
- Passar `credorRules` ao `<NegotiationPanel />`

### 3. AtendimentoPage.tsx — agreementMutation precisa repassar requiresApproval

- Atualmente `agreementMutation` chama `createAgreement` sem o parametro de aprovacao
- Precisa verificar se `data.requiresApproval` esta presente e repassar para `createAgreement`

### Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/AtendimentoPage.tsx` | Buscar `credorRules` do credor + passar como prop + repassar `requiresApproval` no mutation |
| `src/components/contact-center/threecplus/TelefoniaAtendimento.tsx` | Buscar `credorRules` do credor + passar como prop + repassar `requiresApproval` no mutation |

