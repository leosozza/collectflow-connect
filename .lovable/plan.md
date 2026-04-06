

# Plano: Adicionar filtro "Sem disparo de WhatsApp" na Carteira

## Resumo

Adicionar um checkbox "Sem disparo de WhatsApp" no mesmo grupo visual dos filtros existentes (Sem acordo, Sem contato, Higienizados). O filtro exclui clientes que já foram incluídos como destinatários em qualquer campanha de WhatsApp, verificando por CPF + credor.

## Análise técnica

A tabela `whatsapp_campaign_recipients` armazena `representative_client_id` (UUID do cliente), não CPF/credor diretamente. Para verificar CPF + credor, o SQL precisa fazer JOIN com `clients` para obter esses campos.

## Alterações

### 1. SQL — Alterar RPC `get_carteira_grouped`

Adicionar novo parâmetro `_sem_whatsapp boolean DEFAULT false` e uma nova CTE `sem_whatsapp_filter` após `sem_acordo_filter`:

```sql
sem_whatsapp_filter AS (
  SELECT s.*
  FROM sem_acordo_filter s
  WHERE NOT _sem_whatsapp OR NOT EXISTS (
    SELECT 1 FROM whatsapp_campaign_recipients r
    JOIN clients cl ON cl.id = r.representative_client_id
    WHERE cl.tenant_id = _tenant_id
      AND replace(replace(cl.cpf, '.', ''), '-', '') = replace(replace(s.cpf, '.', ''), '-', '')
      AND cl.credor = s.credor
  )
)
```

A CTE `counted` passa a referenciar `sem_whatsapp_filter` em vez de `sem_acordo_filter`.

### 2. Frontend — `ClientFilters.tsx`

Adicionar `semWhatsapp: boolean` ao interface `Filters` e um novo checkbox no grupo dos filtros rápidos (linha 4, após "Higienizados"):

```
☐ Sem disparo de WhatsApp
```

### 3. Frontend — `CarteiraPage.tsx`

- Adicionar `urlSemWhatsapp` via `useUrlState`
- Incluir no objeto `filters` e `rpcFilters`
- Incluir no `FILTER_DEFAULTS`
- Incluir no `hasActiveFilters`

### 4. Frontend — `clientService.ts`

Adicionar `semWhatsapp` ao type `CarteiraFilters` e passar `_sem_whatsapp` nos params do RPC.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| Migration SQL (nova) | Recriar `get_carteira_grouped` com parâmetro `_sem_whatsapp` e CTE |
| `src/components/clients/ClientFilters.tsx` | Adicionar campo `semWhatsapp` no interface e checkbox na UI |
| `src/pages/CarteiraPage.tsx` | URL state, filters, rpcFilters, hasActiveFilters, defaults |
| `src/services/clientService.ts` | Adicionar ao type e passar param ao RPC |

