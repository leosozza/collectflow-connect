

## Atualizar Status dos Clientes "Em Dia"

### Diagnóstico
- **895 clientes** estão com status "Aguardando acionamento" (`35679541-8088-40b1-8aa9-c75a7dd055e7`)
- **49 clientes únicos** (CPF+credor) estão efetivamente **em dia**: todas as suas parcelas pendentes têm vencimento futuro
- O status "Em dia" já existe: `6119c591-20f3-403b-b79b-cfeb4c692262`

### Ação
Executar uma migração SQL que atualiza os registros dos clientes em dia:

```sql
UPDATE clients
SET status_cobranca_id = '6119c591-20f3-403b-b79b-cfeb4c692262'
WHERE status_cobranca_id = '35679541-8088-40b1-8aa9-c75a7dd055e7'
  AND status = 'pendente'
  AND data_vencimento >= CURRENT_DATE
  AND NOT EXISTS (
    SELECT 1 FROM clients c2
    WHERE c2.cpf = clients.cpf
      AND c2.credor = clients.credor
      AND c2.tenant_id = clients.tenant_id
      AND c2.status = 'pendente'
      AND c2.data_vencimento < CURRENT_DATE
  );
```

### Critério "Em Dia"
- Status atual = `pendente`
- Todas as parcelas pendentes do mesmo CPF+credor têm vencimento >= hoje
- Nenhuma parcela vencida em aberto

### Resultado esperado
~49 clientes atualizados de "Aguardando acionamento" para "Em dia"

