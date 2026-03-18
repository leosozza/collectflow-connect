
Comparação concluída entre Test e Live.

Resumo geral
- Estrutura do banco está quase totalmente alinhada entre os ambientes.
- Funções RPC e políticas RLS também estão alinhadas.
- As maiores diferenças estão nos dados, não no schema.
- Há 1 diferença estrutural relevante: a ordem/posição de algumas colunas na tabela `clients`.

Diferenças encontradas

1. Tabelas existentes
- Test e Live têm o mesmo conjunto de tabelas públicas.
- Não encontrei tabela faltando em um ambiente e existente no outro.

2. Funções do banco
- As funções públicas comparadas têm a mesma assinatura lógica entre Test e Live.
- Isso inclui `get_my_enabled_modules()`, `get_my_permissions()`, `onboard_tenant()` e demais RPCs principais.

3. Policies / RLS
- As policies estão alinhadas entre os dois ambientes.
- Não apareceu divergência relevante de segurança/permissão no nível de policy.

4. Diferença estrutural detectada
- `clients` tem assinatura diferente entre Test e Live.
- As colunas são praticamente as mesmas, mas em ordem diferente nas posições finais:
  - Test: `preferred_channel`, `suggested_queue`, `score_reason`, `score_confidence`, `score_updated_at`, `debtor_category_id`
  - Live: `debtor_category_id`, `enrichment_data`, `preferred_channel`, `score_confidence`, `score_reason`, `score_updated_at`, `suggested_queue`
- Como o app usa selects nomeados, isso normalmente não quebra a UI, mas confirma que os ambientes não estão 100% idênticos no histórico de migrações.

5. Diferenças de dados mais importantes
As divergências principais são estas:

- `system_modules`
  - Test: 12
  - Live: 0

- `tenant_modules`
  - Test: 11
  - Live: 0

- `sa_modules`
  - Test: 16
  - Live: 0

- `atendimento_field_config`
  - Test: 36
  - Live: 0

- `service_catalog`
  - Test: 8
  - Live: 9
  - Live tem um serviço extra: `higienizacao_base`

- `tenant_services`
  - Test: 6
  - Live: 4

- `whatsapp_instances`
  - Test: 3
  - Live: 1

- `operator_instances`
  - Test: 2
  - Live: 1

- `ranking_configs`
  - Test: 2
  - Live: 1

- `chat_messages`
  - Test: 0
  - Live: 26

- `conversations`
  - Test: 0
  - Live: 9

- `crm_*`
  - Test tem dados em `crm_activities`, `crm_companies`, `crm_leads`, `crm_opportunities`, `crm_pipeline_stages`, `crm_lead_score_rules`
  - Live está praticamente vazio nessas tabelas

- `user_activity_logs`
  - Test: 178
  - Live: 303

- `tipos_devedor`
  - Test: 4
  - Live: 5

Tabelas principais iguais em volume
- `clients`: 6819 em ambos
- `tenants`: 1 em ambos
- `tenant_users`: 7 em ambos
- `profiles`: 6 em ambos
- `permission_profiles`: 4 em ambos
- `plans`: 3 em ambos

Conclusão prática
A diferença que explica diretamente o problema do sidebar é esta:

```text
Test
system_modules = 12
tenant_modules = 11

Live
system_modules = 0
tenant_modules = 0
```

Ou seja:
- o ambiente publicado está sem o catálogo de módulos;
- as permissões do usuário existem;
- o tenant existe;
- mas o mecanismo de módulos no Live não tem dados para liberar Contact Center, WhatsApp e Telefonia.

Abordagem recomendada
1. Corrigir primeiro a ausência de dados em Live:
   - `system_modules`
   - `tenant_modules`
   - opcionalmente revisar também `sa_modules`

2. Depois validar novamente:
   - retorno do RPC `get_my_enabled_modules()`
   - visibilidade do grupo Contact Center no sidebar

3. Em seguida prevenir recorrência:
   - garantir seed de dados obrigatórios no provisionamento do ambiente, não apenas no Test

Detalhes técnicos
- Estrutura: alinhada quase por completo
- Funções: alinhadas
- RLS: alinhado
- Problema principal: divergência de dados seed/configuração entre ambientes
- Diferença estrutural secundária: ordem de colunas em `clients`

Se você aprovar, no próximo passo eu monto um plano objetivo só para reconciliar os dados obrigatórios entre Test e Live e listar exatamente quais registros precisam existir em produção.
