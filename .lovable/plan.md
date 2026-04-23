

## Sincronizar usuários da 3CPlus (extension SIP automática)

Adicionar botão "Sincronizar usuários 3CPlus" ao lado de "Testar Conexão" na aba Integrações → Telefonia. Ao clicar, o RIVO busca todos os agentes da 3CPlus do tenant e preenche automaticamente a `extension_sip` dos usuários do RIVO cujo e-mail bate com o cadastro na 3CPlus.

### Como funciona

1. Admin clica em **"Sincronizar usuários 3CPlus"** na aba Telefonia.
2. Edge function `threecplus-proxy` (action: `list_agents`) retorna todos os agentes da 3CPlus do tenant.
3. Frontend faz match por **e-mail** (case-insensitive) entre `users` do RIVO e agentes 3CPlus.
4. Para cada match, atualiza `users.extension_sip` com o ramal/extension da 3CPlus.
5. Mostra modal/toast com resumo: `X usuários sincronizados, Y sem correspondência, Z já estavam corretos`.

### Critério de match

- Chave primária: **e-mail exato** (lowercase, trim).
- Fallback opcional: nome completo (apenas se e-mail não bater) — descartado nesta versão para evitar falsos positivos.

### Backend

- Reutiliza `threecplus-proxy` existente (já suporta `list_agents`).
- Não requer nova edge function nem nova migration.
- Update de `users.extension_sip` via supabase client com `.eq('tenant_id', tenantId)` (RLS já protege).

### UI

**Arquivo:** `src/components/admin/integrations/ThreeCPlusTab.tsx`

- Novo botão `"Sincronizar usuários"` ao lado do botão "Testar Conexão" (mesmo grupo flex).
- Ícone `RefreshCw` (lucide-react).
- Estado `syncing` com spinner durante operação.
- Modal de resultado mostrando lista detalhada:
  - ✅ Sincronizados: nome + e-mail + extension atribuída
  - ⚠️ Sem correspondência na 3CPlus: lista de e-mails RIVO sem match
  - ℹ️ Já corretos: contagem

### Tratamento de erros

- Se 3CPlus retornar lista vazia → toast "Nenhum agente encontrado na 3CPlus".
- Se credenciais inválidas → toast com mensagem clara + sugerir aba "Telefonia" para revisar config.
- Se falhar update no RIVO → continua com os outros, reporta falhas no modal final.

### Arquivos alterados

- `src/components/admin/integrations/ThreeCPlusTab.tsx` — adicionar botão, lógica de sync e modal de resultado.

### Não incluído

- Sincronização reversa (criar usuário no RIVO a partir da 3CPlus) — fora do escopo, evita criar usuários sem permissão definida.
- Sincronização automática agendada — pode ser próximo passo se útil.
- Match por nome (apenas e-mail nesta versão).

