## Objetivo

No disparo em massa de WhatsApp (botão "WhatsApp em massa" da Carteira), o login operador deve enxergar **apenas as instâncias atribuídas a ele** via `operator_instances`. Admins continuam vendo todas as instâncias elegíveis (comportamento atual).

## Análise

Hoje, `WhatsAppBulkDialog.tsx` chama `fetchEligibleInstances(tenantId)` em `whatsappCampaignService.ts`, que retorna todas as instâncias do tenant filtradas apenas por status operacional e capacidade de bulk — sem considerar o vínculo do operador.

O padrão correto já existe em `StartWhatsAppConversationDialog.tsx` e `WhatsAppChatLayout.tsx`:
- Admin → vê todas
- Operador → busca em `operator_instances` por `profile_id` + `tenant_id` e filtra `instance_id` permitidos
- Instância virtual `gupshup-official` (não está em `whatsapp_instances`) deve permanecer visível para todos (ou apenas admin — ver Pergunta abaixo).

## Mudanças

### 1. `src/services/whatsappCampaignService.ts`
Adicionar parâmetros opcionais à `fetchEligibleInstances`:

```ts
fetchEligibleInstances(tenantId, opts?: { profileId?: string; isAdmin?: boolean })
```

- Se `isAdmin === true` ou `profileId` ausente: comportamento atual.
- Se operador: após carregar `whatsapp_instances`, consultar:
  ```ts
  supabase.from("operator_instances")
    .select("instance_id")
    .eq("profile_id", profileId)
    .eq("tenant_id", tenantId)
  ```
  e manter apenas as instâncias cujo `id` está no conjunto retornado.
- A instância virtual `gupshup-official` é injetada apenas para admin (operador não vê Gupshup oficial no disparo, pois não há vínculo individual).

### 2. `src/components/carteira/WhatsAppBulkDialog.tsx`
- Importar `usePermissions` e `useAuth` (já importado).
- Obter `profile.id` e `isAdmin` (ex.: `role === 'admin' || role === 'gestor'`).
- Passar para a query:
  ```ts
  queryKey: ["eligible-instances", tenant?.id, profile?.id, isAdmin]
  queryFn: () => fetchEligibleInstances(tenant!.id, { profileId: profile?.id, isAdmin })
  ```
- Tratar caso `instances.length === 0` para operador exibindo mensagem clara: *"Você não possui instâncias de WhatsApp atribuídas. Solicite a um administrador."*

### 3. `src/components/cadastros/CredorReguaTab.tsx`
Esse componente também usa `fetchEligibleInstances`. Como Régua/Credor é configuração administrativa, manter chamada sem filtro (admin vê tudo). Sem mudanças funcionais — apenas garantir que a assinatura nova é retrocompatível.

## Pergunta de confirmação

A instância virtual **Gupshup Oficial** deve aparecer para operadores no disparo em massa? Hoje não há tabela de vínculo por operador para ela. Recomendo **ocultar para operadores** (apenas admin dispara via Gupshup oficial). Caso prefira o contrário, ajustamos.

## Arquivos editados

- `src/services/whatsappCampaignService.ts` — assinatura e filtragem por `operator_instances`.
- `src/components/carteira/WhatsAppBulkDialog.tsx` — passar `profileId`/`isAdmin` e mensagem de vazio.

Sem migrações de banco. Sem mudanças de RLS.
