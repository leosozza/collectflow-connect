## Problema
No tenant Y.BRASIL (que já opera em produção) o `/setup` está mostrando etapas críticas como pendentes mesmo estando configuradas. Causas identificadas via inspeção do banco:

| Etapa no Setup | UI mostra | Realidade no banco |
|---|---|---|
| Credores e cadastros | "Em andamento" | 1 credor + 26 tipos/status + 25 dispositions — falta só `scripts_abordagem` (0), que o critério atual exige |
| Gateways de pagamento | "Pendente" | Credenciais reais (cobcloud, asaas, etc.) ficam dentro de `tenants.settings` (JSONB) — o hook procura na tabela `integration_tokens`, que está **vazia em todos os tenants** |
| Importação da carteira | "Pendente / Carteira vazia" | 434.552 registros em `clients` — `select('id', count:'exact', head:true)` está sendo bloqueado/timeout pela RLS em tabelas grandes |
| Automação e workflows | "Pendente (opcional)" | Usuário pediu para **remover** do setup |

## Mudanças (apenas em `src/hooks/useTenantSetupStatus.ts`)

### 1. Remover etapa "Automação"
- Apaga a query `workflow_flows`, a lógica `automacaoOk/Detail` e o objeto do step `automacao` no array final.
- Total de etapas passa de 7 para 6.

### 2. Cadastros — relaxar critério "Concluído"
- Passa a ser **completo** quando: `credores > 0` **E** `(tipos_devedor + tipos_divida + tipos_status) > 0`.
- `scripts_abordagem` e `call_disposition_types` viram **opcionais** (continuam aparecendo no `detail` quando existem, mas não bloqueiam status).
- "Em andamento" só quando há `credores > 0` mas nenhum tipo/status ainda.

### 3. Gateways — detectar credenciais reais
- Em vez de contar `integration_tokens` (tabela morta), inspecionar `tenants.settings` (já lido no Promise.all) verificando se alguma destas chaves existe e é não-vazia:
  - `cobcloud_token_client`, `cobcloud_token_company`, `cobcloud_token_assessoria`
  - `asaas_api_key`
  - `negociarie_api_key`, `negociarie_token`
- Fallback adicional: contar `asaas_customers` ou `negociarie_cobrancas` do tenant — se houver qualquer registro, gateway considerado ativo.
- Mantém override manual via `setup_steps_state.gateways`.
- `detail`: ex. "Cobcloud + Asaas ativos" ou "Nenhum gateway configurado".

### 4. Carteira — detecção robusta em tabelas grandes
- Substituir `safeCount('clients', ...)` por uma probe leve:
  ```
  supabase.from('clients').select('id').eq('tenant_id', tenantId).limit(1)
  ```
  Se retornar ≥1 linha → considera "complete".
- Mantém um segundo probe igual para checar se existe pelo menos um cliente com `status != 'pendente'` (usado no `in_progress`).
- `detail`: "Carteira ativa" / "Aguardando classificação de status" / "Carteira vazia" (sem expor contagem total, que ficava ruim em escala).

## Não muda
- Nenhuma alteração em rotas, permissões (continua admin-only), banner do dashboard, migração, ou demais páginas.
- `docs/TENANT_SETUP_GUIDE.md` será ajustado só para refletir a remoção da etapa de automação e a nova lógica de cadastros/gateways/carteira.

## Resultado esperado para Y.BRASIL após o ajuste
- Empresa: Concluído
- Cadastros: **Concluído**
- Equipe: Concluído
- Canais: Concluído
- Gateways: **Concluído** (cobcloud detectado em settings)
- Carteira: **Concluído** (434k registros)
- → `criticalPending = 0` → banner some, botão "Concluir Setup" fica habilitado.