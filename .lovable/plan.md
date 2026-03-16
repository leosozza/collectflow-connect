

# Corrigir contagem de serviços na aba Empresas

## Problema
A função `getActiveServicesCount()` (linha 288-291) e `getExtraInstancesCount()` (linha 293-296) leem de `tenant.settings.enabled_services` — um campo JSON legado na tabela `tenants`. Os dados reais estão na tabela `tenant_services`.

Resultado: mostra "4 ativos" e "1 + 4 extra" quando na verdade são 2 serviços ativos com 2 instâncias WhatsApp.

## Solução

### Modificar `src/pages/SuperAdminPage.tsx`

1. **Carregar `tenant_services`** agrupado por tenant no `loadTenants()` ou em query separada — buscar contagem de serviços ativos e quantidade de instâncias WhatsApp por tenant.

2. **Substituir `getActiveServicesCount()`** para usar dados de `tenant_services` (status = 'active') em vez do JSON legado.

3. **Substituir `getExtraInstancesCount()`** para buscar a `quantity` do serviço "Instância de WhatsApp" na `tenant_services` em vez de `settings.enabled_services.whatsapp_extra_instances`.

4. **Criar estado** `tenantServiceCounts: Record<tenantId, { activeServices: number, whatsappInstances: number }>` populado na carga inicial.

### Query necessária

```sql
SELECT tenant_id, COUNT(*) as active_count
FROM tenant_services WHERE status = 'active'
GROUP BY tenant_id
```

```sql
SELECT tenant_id, quantity
FROM tenant_services ts
JOIN service_catalog sc ON sc.id = ts.service_id
WHERE ts.status = 'active' AND sc.name ILIKE '%whatsapp%'
```

### Arquivos alterados
- `src/pages/SuperAdminPage.tsx` — substituir leitura do JSON legado por dados da tabela `tenant_services`

