
Objetivo

Corrigir a Prestação de Contas para refletir a atuação real na carteira, sem mexer na lógica de status já consolidada.

Diagnóstico

- `credorClients` hoje cruza `clients` com `agreements` por comparação direta de CPF. Se um lado vier formatado e o outro não, a lista fica vazia.
- O Aging dentro de `PrestacaoContas.tsx` só considera `status === "pendente"` para aberto e `status === "pago"` para recebido. Isso ignora parcelas em `em_acordo`, pagamentos parciais e baixas que já atualizaram `valor_pago` mas não mudaram o status para `pago`.
- O resumo atual mostra valores de acordos, mas não evidencia os clientes negociados, recebidos e quebrados.
- O bloco “Ranking de Operadores” ainda está presente.

Implementação

1. `src/components/relatorios/PrestacaoContas.tsx`
- Normalizar CPF dos dois lados com `normalizeCPF` ao cruzar `agreements` e `clients`.
- Criar uma base única de clientes negociados por `CPF normalizado + credor`.
- Usar contagem de CPFs únicos para novos indicadores:
  - Clientes negociados
  - Clientes com recebimento
  - Clientes quebrados

2. Aging real dentro da Prestação de Contas
- Manter como métrica de carteira, mas apenas para clientes com acordo no Rivo do credor selecionado.
- Calcular por faixa usando saldo real da parcela:
  - aberto = `max(valor_parcela - valor_pago, 0)` para parcelas vencidas com saldo > 0
  - recebido = soma de `valor_pago` por faixa de vencimento, mesmo se a parcela ainda estiver `em_acordo`
- Não depender apenas de `status === "pendente"` / `status === "pago"`.
- Manter buckets: 0-30, 31-90, 91-180, 181-365, 366+.

3. Parcelas Detalhadas
- Passar a usar a mesma base normalizada de clientes negociados.
- Garantir exibição de clientes negociados, com recebimento e quebrados.
- Ordenar para destacar atividade real (recebimentos e pendências vencidas).
- Manter o accordion fechado por padrão.

4. Resumo da Prestação de Contas
- Manter os indicadores financeiros atuais.
- Acrescentar/ajustar o resumo para mostrar claramente os clientes:
  - negociados
  - recebidos
  - quebrados
- Assim o credor visualiza atuação na carteira além dos valores.

5. Limpeza visual
- Remover totalmente o bloco “Ranking de Operadores”.
- Atualizar a exportação Excel para remover referências ao ranking e incluir os novos indicadores de clientes.

6. Ajuste de integração
- `src/pages/RelatoriosPage.tsx`: remover a prop `operators` de `PrestacaoContas` se ela deixar de ser necessária.

Compatibilidade e limite da correção

- Não alterar status de `agreements`, `clients`, `status_cobranca_id`, automações, baixa manual ou callback.
- Como `clients` hoje não possui vínculo direto com `agreement_id`, a correção segura continuará usando o recorte por `CPF normalizado + credor` dos clientes com acordo, sem refatoração destrutiva do modelo.

Validação

- Conferir um credor com pagamentos já recebidos para validar:
  - Aging com valor em “Recebido”
  - Parcelas detalhadas com clientes negociados/pagos visíveis
  - contadores de clientes negociados, recebidos e quebrados coerentes
  - remoção completa do Ranking de Operadores
