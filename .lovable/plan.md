

# Plano: Limpar tenant TESS MODELS para produção

## Resumo

Executar limpeza completa do tenant `39a450f8-7a40-46e5-8bc7-708da5043ec7`, mantendo apenas o usuário **Raul Seixas** (`0e5a460b`) como admin. O super_admin Raul Jose Seixas Junior não será tocado (não pertence ao tenant).

## Ordem de execução (via INSERT tool — operações DELETE/UPDATE)

Todas as operações filtram por `tenant_id = '39a450f8-7a40-46e5-8bc7-708da5043ec7'`.

### 1. WhatsApp — limpar instâncias e conversas
```sql
DELETE FROM chat_messages WHERE conversation_id IN (SELECT id FROM conversations WHERE tenant_id = '39a450f8...');
DELETE FROM conversations WHERE tenant_id = '39a450f8...';
DELETE FROM whatsapp_campaign_recipients WHERE campaign_id IN (SELECT id FROM whatsapp_campaigns WHERE tenant_id = '39a450f8...');
DELETE FROM whatsapp_campaigns WHERE tenant_id = '39a450f8...';
DELETE FROM whatsapp_instances WHERE tenant_id = '39a450f8...';
```

### 2. Clientes e dados associados
```sql
DELETE FROM client_events WHERE tenant_id = '39a450f8...';
DELETE FROM client_dispositions WHERE tenant_id = '39a450f8...';
DELETE FROM client_update_logs WHERE tenant_id = '39a450f8...';
DELETE FROM agreement_signatures WHERE agreement_id IN (SELECT id FROM agreements WHERE tenant_id = '39a450f8...');
DELETE FROM agreements WHERE tenant_id = '39a450f8...';
DELETE FROM message_logs WHERE tenant_id = '39a450f8...';
DELETE FROM call_logs WHERE tenant_id = '39a450f8...';
DELETE FROM clients WHERE tenant_id = '39a450f8...';
```

### 3. Usuários — remover todos exceto Raul Seixas
```sql
-- Remover permissões dos usuários que serão excluídos
DELETE FROM user_permissions WHERE tenant_id = '39a450f8...' AND profile_id IN (
  SELECT id FROM profiles WHERE tenant_id = '39a450f8...' AND user_id != '0e5a460b-a7f3-46da-9da0-2cd15cd16769'
);

-- Remover tenant_users (exceto Raul Seixas e super_admin)
DELETE FROM tenant_users WHERE tenant_id = '39a450f8...' AND user_id != '0e5a460b-a7f3-46da-9da0-2cd15cd16769' AND role != 'super_admin';

-- Limpar tenant_id dos profiles removidos
UPDATE profiles SET tenant_id = NULL WHERE tenant_id = '39a450f8...' AND user_id != '0e5a460b-a7f3-46da-9da0-2cd15cd16769';
```

> **Nota**: Os auth.users não serão deletados (requer admin API), mas ficarão desvinculados do tenant.

### 4. Dados auxiliares (notification, activity logs)
```sql
DELETE FROM notifications WHERE tenant_id = '39a450f8...';
DELETE FROM activity_sessions WHERE tenant_id = '39a450f8...';
```

## O que NÃO muda
- Super admin Raul Jose Seixas Junior — intacto
- Usuário Raul Seixas — mantido como admin do tenant
- Tenant em si (nome, plano, configurações) — mantido
- Credores, tipos de dívida, configurações de cadastro — mantidos (são config, não dados operacionais)

