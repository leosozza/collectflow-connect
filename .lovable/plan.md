

# Plano: Corrigir detecção de instâncias + Adicionar seletor oficial/não-oficial na criação

## Problema

A query `fetchEligibleInstances` filtra por `provider_category = 'unofficial'` e `supports_manual_bulk = true`, mas as instâncias existentes (como "ACORDOS VITOR") foram criadas **antes** da migração que adicionou essas colunas. Embora o `DEFAULT` devesse preencher, é preciso garantir com um backfill explícito. Além disso, falta na UI de criação de instância a opção para definir se é oficial ou não-oficial.

---

## 1. Migração: Backfill das instâncias existentes

```sql
UPDATE public.whatsapp_instances
SET provider_category = 'unofficial',
    supports_manual_bulk = true,
    supports_campaign_rotation = true,
    supports_human_queue = true
WHERE provider_category IS NULL
   OR provider_category = '';
```

Garante que todas as instâncias já criadas passem a ser encontradas pela query.

---

## 2. Formulário de criação — Baylers e WuzAPI

**Arquivos**: `BaylersInstanceForm.tsx`, `WuzApiInstanceForm.tsx`

Adicionar um campo **Select** com label "Categoria do provedor":
- **Não-oficial** (default) — `provider_category = 'unofficial'`
- **Oficial Meta** — `provider_category = 'official_meta'`

O valor selecionado é retornado no `onSave` junto com o `name`.

---

## 3. Propagar `provider_category` ao salvar

**Arquivos**: `BaylersInstancesList.tsx`, `WuzApiInstancesList.tsx`

No `handleCreate`, passar o `provider_category` recebido do formulário para `createWhatsAppInstance()`:

```typescript
await createWhatsAppInstance({
  ...
  provider_category: data.providerCategory, // 'unofficial' ou 'official_meta'
});
```

---

## 4. Ajustar tipo do service

**Arquivo**: `src/services/whatsappInstanceService.ts`

Adicionar `provider_category` ao tipo `WhatsAppInstanceInsert` (já existe na tabela, mas precisa estar no tipo local).

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Backfill `provider_category` e flags nas instâncias existentes |
| `BaylersInstanceForm.tsx` | Adicionar select oficial/não-oficial |
| `WuzApiInstanceForm.tsx` | Adicionar select oficial/não-oficial |
| `BaylersInstancesList.tsx` | Passar `providerCategory` ao criar instância |
| `WuzApiInstancesList.tsx` | Passar `providerCategory` ao criar instância |
| `whatsappInstanceService.ts` | Adicionar campos de capacidade ao tipo |

