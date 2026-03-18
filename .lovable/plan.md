

# Plano: Corrigir módulos ausentes em Produção e Test

## Diagnóstico Confirmado

Ambos os ambientes (Test e Live) têm **0 registros** em `system_modules` e `tenant_modules`. A migration `20260318181648` foi criada mas nunca foi aplicada em nenhum dos dois ambientes.

As tabelas e schemas existem corretamente em ambos, incluindo RLS policies adequadas. O problema é exclusivamente **dados ausentes**.

| Tabela | Test | Live |
|--------|------|------|
| `system_modules` | 0 | 0 |
| `tenant_modules` | 0 | 0 |

## Causa

A migration foi salva como arquivo vazio e depois editada, mas o banco não a re-executou.

## Solução

Usar a **ferramenta de inserção de dados** (não migration) para popular diretamente ambos os ambientes:

### Passo 1 — Inserir os 12 módulos em `system_modules`

Inserir via ferramenta de insert nos dois ambientes (Test + Live):

- `crm_core` (core)
- `contact_center`, `whatsapp`, `telefonia`, `automacao`, `portal_devedor`, `relatorios`, `gamificacao`, `financeiro`, `integracoes`, `api_publica`, `ia_negociacao`

### Passo 2 — Habilitar módulos para tenant Y.BRASIL

Inserir em `tenant_modules` para o tenant `39a450f8-7a40-46e5-8bc7-708da5043ec7`, habilitando todos os módulos não-core (11 registros).

### Passo 3 — Verificar

Consultar `get_my_enabled_modules()` no Live para confirmar que retorna os slugs corretos.

## Resultado Esperado

Após a inserção:
- Contact Center, WhatsApp, Telefonia e todos os outros módulos ficam visíveis no sidebar
- `ModuleGuard` libera o acesso às rotas protegidas
- Não é necessário republicar — os dados ficam disponíveis imediatamente

