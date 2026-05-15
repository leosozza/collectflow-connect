## Plano: completar o reprocessamento dos 465k clientes

### Estratégia
Executar UPDATE em chunks de ~3.000 linhas, ordenados por `id`, usando cursor por último `id` processado. Cada chunk:
- chama `get_client_consolidated_status(...)` + `map_canonical_to_legacy_status(...)`
- aplica `SET LOCAL app.force_status_override = 'true'` (bypass do trigger anti-downgrade de QUITADO)
- atualiza apenas linhas onde o status calculado difere do atual
- cabe dentro do timeout HTTP do client (~60s)

### Execução
- ~155 chunks de 3.000 linhas cada (465.855 / 3.000)
- Loop em bash chamando o `supabase--insert` via tool — porém como cada chamada precisa ser uma tool call, vou disparar em lotes paralelos onde for seguro (chunks por faixas de UUID disjuntas).
- Particionamento por **prefixo hexadecimal do UUID** (16 buckets × ~29k cada) com `statement_timeout=180s` por bucket. Se um bucket estourar, subdivido em 2.

### Validação ao final
1. Distribuição final dos 7 status em `clients`
2. Spot check: 50 grupos aleatórios — comparar `clients.status_cobranca_id` vs `get_client_consolidated_status` direto
3. Resolver os 70 clientes com status NULL (verificar se são CPF/credor ausente)

Pronto para disparar.