

# Corrigir instância Gupshup não aparecendo na lista

## Problema

A tabela `whatsapp_instances` tem colunas `instance_url` e `api_key` como `NOT NULL` sem valor default. O insert no `GupshupConfigDialog` (linha 101-108) não fornece esses campos, causando falha silenciosa — a instância nunca é criada.

## Correção

### 1. `src/components/integracao/GupshupConfigDialog.tsx`

Adicionar `instance_url` e `api_key` no insert (linhas 101-108):

```typescript
await (supabase.from("whatsapp_instances") as any).insert({
  tenant_id: tenant.id,
  instance_name: instanceName,
  phone_number: sourceNumber.replace(/\D/g, ""),
  status: "connected",
  provider: "gupshup",
  provider_category: "official",
  name: appName.trim(),
  instance_url: "https://api.gupshup.io",
  api_key: apiKey.trim(),
});
```

Também adicionar tratamento de erro no insert/update para capturar falhas em vez de ignorá-las silenciosamente.

### 2. Verificar se já existe instância com dados corretos

Após o fix, a instância "Maxfama2" será criada ao próximo "Salvar e ativar" e aparecerá no card da esquerda.

## Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `src/components/integracao/GupshupConfigDialog.tsx` | Adicionar `instance_url`, `api_key`, `provider_category` no insert; tratar erros do insert/update |

