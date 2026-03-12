

# Plano: Corrigir teste de conexão Target Data + IP

## Problemas identificados

### 1. Teste de conexão trava (nunca finaliza)
A função `targetdata-enrich` tenta processar o CPF de teste como um job real:
- Usa `job_id: "test-connection"` (string, não UUID) para inserir em `enrichment_logs` e atualizar `enrichment_jobs` — causa erro no banco
- O fetch para a API Target Data não tem timeout — se a API demorar, a edge function fica pendurada
- Não há modo de teste que pule as operações de banco

### 2. Erro "IP não autorizado" (code 1099)
A API Target Data exige IP na whitelist. Edge Functions usam IPs dinâmicos. Não há como fixar IP no código. **Duas opções:**
- Solicitar à Target Data desabilitar restrição de IP para sua API key
- A Target Data pode ter uma opção "sem restrição de IP" nas configurações da API key

## Alterações

### 1. `supabase/functions/targetdata-enrich/index.ts`
- Adicionar parâmetro `test_mode: boolean` — quando `true`, faz apenas um fetch de teste à API e retorna o resultado sem operações de banco
- Adicionar timeout de 15s no fetch para a API Target Data (evitar hang)
- Tratar erro 401 com `code_error: 1099` retornando mensagem clara sobre IP

### 2. `src/components/admin/integrations/TargetDataTab.tsx`
- Enviar `test_mode: true` no corpo da requisição de teste
- Tratar a resposta de IP não autorizado com mensagem orientativa

### 3. `supabase/config.toml`
- Adicionar `verify_jwt = false` para `targetdata-enrich` (necessário para o novo sistema signing-keys) e validar JWT no código

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/targetdata-enrich/index.ts` | Adicionar `test_mode`, timeout no fetch, melhor tratamento de erro de IP |
| `src/components/admin/integrations/TargetDataTab.tsx` | Enviar `test_mode: true`, exibir orientação sobre IP |
| `supabase/config.toml` | `verify_jwt = false` para targetdata-enrich |

