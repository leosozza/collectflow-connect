## Problema

Hoje, ao criar uma API key escopada a um credor (`api_keys.credor_id` preenchido):

- `GET /credores` na `clients-api` retorna **todos** os credores ativos do tenant, ignorando o escopo da chave.
- O `SELECT` traz apenas um subconjunto pequeno de campos (`razao_social, nome_fantasia, cnpj, status, parcelas_min, parcelas_max, desconto_maximo, juros_mes, multa`).
- Logo, integrações que usam uma chave restrita a 1 credor não recebem dados completos (endereço, contato, dados bancários, templates, configurações de portal, regras de desconto, SLA, etc.).

## Objetivo

Quando a chave for restrita a um credor, `GET /credores` (e `GET /credores/{id}`) devem retornar **todas as informações daquele credor**, exceto campos sensíveis de segurança.

## Mudanças

### 1. `supabase/functions/clients-api/index.ts` — endpoint `GET /credores`

Substituir o handler atual por uma lógica que:

- **Quando a chave é escopada (`credorId` presente)**: retornar somente o credor da chave, com todos os campos públicos preenchidos.
- **Quando a chave é global**: manter o comportamento de listar todos os credores `ativos` do tenant, mas também retornando o conjunto completo de campos públicos (consistência).

Campos retornados (todas as colunas de `credores`, exceto sensíveis):

Incluir: `id, razao_social, nome_fantasia, cnpj, inscricao_estadual, contato_responsavel, email, telefone, cep, endereco, numero, complemento, bairro, cidade, uf, banco, agencia, conta, tipo_conta, pix_chave, gateway_ativo, gateway_ambiente, gateway_status, parcelas_min, parcelas_max, entrada_minima_valor, entrada_minima_tipo, desconto_maximo, juros_mes, multa, honorarios_grade, aging_discount_tiers, prazo_dias_acordo, indice_correcao_monetaria, sla_hours, carteira_mode, signature_enabled, signature_type, portal_hero_title, portal_hero_subtitle, portal_logo_url, portal_primary_color, portal_enabled, document_logo_url, template_acordo, template_recibo, template_quitacao, template_descricao_divida, template_notificacao_extrajudicial, status, created_at, updated_at`.

Excluir (segredos): `gateway_token`, `tenant_id`.

### 2. Adicionar `GET /credores/{id}`

Endpoint novo que retorna o detalhamento completo de um credor:

- Se a chave for escopada e `{id}` ≠ `credor_id` da chave → **403** com mensagem clara.
- Caso contrário → retorna o credor completo (mesmos campos da lista).

### 3. Documentação

Atualizar `docs/API_REFERENCE.md` (seção "Cadastros") para:

- Listar os campos completos retornados por `GET /credores`.
- Documentar `GET /credores/{id}`.
- Reforçar que chaves restritas a 1 credor automaticamente recebem somente aquele credor.

## Não muda

- Esquema do banco (nenhuma migração).
- Autenticação por `X-API-Key` (mesmo SHA-256).
- Demais endpoints (`/clients`, `/agreements`, `/payments`, etc.).
- Campo `gateway_token` continua oculto na API pública.

## Riscos

- Baixo. Mudança apenas amplia o payload retornado e adiciona um endpoint. Consumidores existentes que já liam `data[].razao_social` continuam funcionando.
