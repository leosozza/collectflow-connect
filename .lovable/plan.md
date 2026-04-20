
## Análise: SALDO DEVEDOR vs EM ABERTO

### Investigação necessária
Preciso verificar:
1. Onde esses dois campos são populados (origem dos dados na tabela `clients`)
2. Se há lógica condicional baseada em `saldo_devedor` separadamente de `em_aberto`
3. Se algum relatório/dashboard/RPC consome especificamente `saldo_devedor`
