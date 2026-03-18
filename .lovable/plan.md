

# Diagnóstico e Plano de Correção — Produção

## Causa Raiz

A migration que insere os dados em `system_modules` e `tenant_modules` foi criada e aplicada no ambiente **Test**, mas **nunca foi publicada** para o ambiente **Live**. Por isso:

- **Live**: `system_modules` = 0 registros, `tenant_modules` = 0 registros
- **Test**: `system_modules` = 12 registros, `tenant_modules` = 11 registros

Quando o `get_my_enabled_modules()` retorna um array vazio, o `ModuleGuard` bloqueia todos os módulos (Contact Center, WhatsApp, Telefonia, etc.).

## Estado Atual do Live

| Tabela | Live | Test | Status |
|--------|------|------|--------|
| `system_modules` | 0 | 12 | **VAZIA — causa do problema** |
| `tenant_modules` | 0 | 11 | **VAZIA — causa do problema** |
| `plans` | 3 | 3 | OK |
| `tenants` | 1 | 1 | OK |
| `credores` | 1 | 1 | OK |
| `permission_profiles` | 4 | 4 | OK |
| `call_disposition_types` | 5 | 5 | OK |
| `commission_grades` | 2 | 2 | OK |
| `token_packages` | 5 | 5 | OK |
| `tenant_tokens` | 1 | 1 | OK |

## Solução

**Passo único**: Publicar o projeto. A migration `20260318181648_f57715fc...` já contém os INSERTs necessários para popular `system_modules` (12 módulos) e `tenant_modules` (11 módulos habilitados para Y.BRASIL). Ao publicar, essa migration será executada automaticamente no Live.

Não há necessidade de criar novas migrations ou alterar código. Todas as outras tabelas de referência já estão corretamente populadas no Live.

## Resultado Esperado

Após publicação:
- `get_my_enabled_modules()` retornará os 12 slugs (11 não-core + 1 core)
- Contact Center, WhatsApp, Telefonia e todos os outros módulos ficarão visíveis no sidebar e acessíveis em `rivoconnect.com`

