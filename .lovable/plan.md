

# Corrigir consistência das métricas do Dashboard

## Problema
O card "Pendente" exclui acordos com status `completed`, mas o card "Negociado" os inclui. Isso cria um gap onde Recebido + Pendente < Negociado, confundindo o usuário.

## Solução proposta
Alterar a RPC `get_dashboard_stats` para que o cálculo de **Pendente** inclua também os acordos `completed`, garantindo que a fórmula fique consistente:

**Negociado = Recebido + Pendente (+ Quebra se houver)**

### Alteração

Uma única migration SQL para atualizar a RPC `get_dashboard_stats`:

- Na seção "PENDENTE" (linhas 131-151 da RPC), adicionar `'completed'` ao filtro de status:
  - De: `AND a.status IN ('pending', 'approved', 'overdue')`
  - Para: `AND a.status IN ('pending', 'approved', 'overdue', 'completed')`

Isso fará com que as parcelas dos acordos quitados entrem no cálculo bruto de pendente. Como esses acordos já têm pagamentos registrados (que são subtraídos na linha 153: `_pendente := GREATEST(_pendente - _recebido, 0)`), o valor final de Pendente será automaticamente ajustado — os quitados se anulam (parcela - pagamento ≈ 0) e o número final fica consistente.

### Resultado esperado
- Recebido + Pendente ≈ Negociado (diferenças de centavos por arredondamento)
- Nenhuma alteração de código frontend necessária

