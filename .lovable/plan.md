

# Reorganizar layout do ClientHeader na tela de atendimento

## Layout proposto

```text
┌─────────────────────────────────────────────────────────────────────┐
│ Francisco Helton Moreira da Silva  [Badge Status]    [Formalizar ▸]│
│ CPF: 010.257.973-37 │ Credor: YBRASIL                              │
│ 📞 (85) 99999-1234  📞 (85) 98888-5678  📞 (85) 97777-0000        │
│    (clicável=disca)     (clicável=disca)     (clicável=disca)       │
├─────────────────────────────────────────────────────────────────────┤
│ Em Aberto    │ Pago         │ Parcelas  │ Vencimento │ Valor Parc. │
│ R$ 1.400,00  │ R$ 400,00    │ 1/12      │ 10/01/2025 │ R$ 200,00   │
│ ... mais dados da dívida (quebra, entrada, parcela atual, etc.)    │
├─────────────────────────────────────────────────────────────────────┤
│ [▼ Mais detalhes] → Endereço, email, ID externo, observações       │
└─────────────────────────────────────────────────────────────────────┘
```

## Alterações em `src/components/atendimento/ClientHeader.tsx`

### 1. Linha superior: Nome + Status + Botão Formalizar
- Nome completo do cliente (bold, grande) à esquerda
- Badge de status ao lado do nome
- Botão "Formalizar Acordo" empurrado para o canto direito (`ml-auto`)
- **Remover** o botão "Ligar" standalone

### 2. Linha de identificação: CPF + Credor
- Manter como está (CPF formatado + credor), logo abaixo do nome

### 3. Linha de telefones: clicáveis com ícone verde
- Mostrar `phone`, `phone2`, `phone3` (quando existirem) como spans clicáveis
- Cada telefone com um ícone 📞 verde (`text-emerald-500`) ao lado
- Ao clicar, chama `onCall(phone)` — mesma lógica atual
- Se `callingPhone` estiver true, mostrar "Discando..." no telefone clicado
- Adicionar `phone2` e `phone3` à interface do componente

### 4. Seção de dados da dívida (sempre visível)
- Mover os dados financeiros para uma faixa abaixo dos telefones com `border-t`
- Grid com: Em Aberto, Pago, Parcelas, Vencimento, Valor Parcela, Parcela Atual, Quebra (se > 0)
- Dados que hoje ficam escondidos no collapsible (financeiros) passam a ficar visíveis

### 5. Collapsible: apenas dados secundários
- Manter collapsible apenas para: endereço, email, ID externo, observações
- Trigger com chevron no final da seção de dados da dívida

