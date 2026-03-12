

# Plano: Webhook Target Data

## Objetivo
Criar uma edge function `targetdata-webhook` que serve como endpoint público para receber callbacks da Target Data com resultados de enriquecimento (telefones, e-mails, endereços) e atualizar automaticamente os clientes no banco.

## Edge Function: `supabase/functions/targetdata-webhook/index.ts`

**Endpoint público (sem autenticação JWT)** — a Target Data chamará este URL diretamente.

### Fluxo:
1. Recebe o payload JSON da Target Data (POST)
2. Valida a presença de dados (CPF + dados retornados)
3. Para cada registro recebido:
   - Extrai telefones, e-mails, endereço do payload
   - Busca o cliente pelo CPF em todas as tenants (ou por tenant_id se fornecido no payload)
   - Atualiza os campos `phone`, `phone2`, `phone3`, `email`, `endereco`, `bairro`, `cidade`, `uf`, `cep`, `enrichment_data`
   - Registra log na tabela `enrichment_logs` (se existir job_id)
4. Atualiza o `enrichment_jobs` se houver job_id vinculado
5. Retorna `{ ok: true }` para confirmar recebimento

### Segurança:
- Validação opcional por token/secret no header para evitar chamadas não autorizadas
- Aceita payloads com estrutura flexível (mesmos mapeamentos já usados na `targetdata-enrich`)

## Config: `supabase/config.toml`
- Adicionar `[functions.targetdata-webhook]` com `verify_jwt = false`

## Nenhuma alteração de banco necessária
- Reutiliza as tabelas `clients`, `enrichment_jobs` e `enrichment_logs` já existentes

## Arquivos criados/modificados:
- **Criar**: `supabase/functions/targetdata-webhook/index.ts`
- **Modificar**: `supabase/config.toml` (adicionar config da function)

