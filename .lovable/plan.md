

# Correção: Contact Center não aparece em Produção

## Causa Raiz

As tabelas `system_modules` e `tenant_modules` estão **vazias no ambiente Live**. Como dados nunca sincronizam entre Test e Live ao publicar, os módulos nunca foram inseridos em produção.

Quando o hook `useModules` chama `get_my_enabled_modules()`, recebe um array vazio. O `ModuleGuard` então bloqueia todas as rotas protegidas por módulo (WhatsApp, Telefonia, Automação, Relatórios, etc).

## Solução

Criar uma **migration SQL** que insere os 12 módulos padrão em `system_modules` (usando `ON CONFLICT DO NOTHING` para ser idempotente) e em seguida insere os módulos habilitados para o tenant Y.BRASIL em `tenant_modules`.

### Passo 1 — Migration para seed de `system_modules`

Inserir todos os 12 módulos com `ON CONFLICT (slug) DO NOTHING` para que funcione tanto em Test (já tem dados) quanto em Live (está vazio).

### Passo 2 — Habilitar módulos para o tenant Y.BRASIL

Inserir registros em `tenant_modules` para o tenant `39a450f8-7a40-46e5-8bc7-708da5043ec7` habilitando todos os módulos não-core (contact_center, whatsapp, telefonia, automacao, portal_devedor, relatorios, gamificacao, financeiro, integracoes, api_publica, ia_negociacao).

Usar `ON CONFLICT DO NOTHING` para idempotência.

### Resultado

Após publicar, o `get_my_enabled_modules()` retornará os slugs corretos e o Contact Center (e todos os outros módulos) ficará acessível em `rivoconnect.com`.

