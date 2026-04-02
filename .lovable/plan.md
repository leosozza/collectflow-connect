

# Plano: Fonte Canônica de Dados Cadastrais do Cliente

## Análise do Problema

O sistema atual armazena dados cadastrais (email, phone, endereco, cep, cidade, uf, bairro) **repetidos em cada linha/parcela** da tabela `clients`. A consolidação acontece em runtime em pelo menos 3 lugares diferentes:

1. **`negociarieService.fetchClientAddress`** — consolida "primeiro não-vazio" por CPF
2. **`AgreementCalculator.checkRequiredFields`** — mesma lógica duplicada
3. **`ClientDetailHeader`** — usa `client.email`, `client.phone` do registro individual

Quando o MaxList importa, os campos de endereço (`endereco`, `bairro`, `cep`, `cidade`, `uf`) **nem sequer são mapeados** no `buildRecordFromMapping` — ficam vazios. Resultado: formalização falha por "dados faltantes" mesmo quando os dados existem em outro registro ou foram preenchidos manualmente.

## Solução

Criar tabela `client_profiles` (1 registro por CPF por tenant) como fonte canônica, com serviço centralizado e migração automática.

---

### 1. Criar tabela `client_profiles` (Migration)

```sql
CREATE TABLE public.client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cpf text NOT NULL,
  nome_completo text NOT NULL DEFAULT '',
  email text,
  phone text,
  phone2 text,
  phone3 text,
  cep text,
  endereco text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  source text DEFAULT 'system',
  source_metadata jsonb DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE (tenant_id, cpf)
);

ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

-- RLS policies usando get_my_tenant_id()
CREATE POLICY "tenant_isolation_select" ON public.client_profiles
  FOR SELECT TO authenticated
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_isolation_insert" ON public.client_profiles
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "tenant_isolation_update" ON public.client_profiles
  FOR UPDATE TO authenticated
  USING (tenant_id = get_my_tenant_id());

-- Trigger updated_at
CREATE TRIGGER update_client_profiles_updated_at
  BEFORE UPDATE ON public.client_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Backfill: consolidar dados existentes da tabela clients
INSERT INTO public.client_profiles (tenant_id, cpf, nome_completo, email, phone, phone2, phone3, cep, endereco, bairro, cidade, uf, source)
SELECT DISTINCT ON (c.tenant_id, clean_cpf)
  c.tenant_id,
  clean_cpf,
  c.nome_completo,
  c.email,
  c.phone,
  c.phone2,
  c.phone3,
  c.cep,
  c.endereco,
  c.bairro,
  c.cidade,
  c.uf,
  'backfill'
FROM (
  SELECT *,
    REPLACE(REPLACE(cpf, '.', ''), '-', '') AS clean_cpf,
    ROW_NUMBER() OVER (
      PARTITION BY tenant_id, REPLACE(REPLACE(cpf, '.', ''), '-', '')
      ORDER BY
        CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END,
        CASE WHEN cep IS NOT NULL AND cep != '' THEN 0 ELSE 1 END,
        updated_at DESC
    ) AS rn
  FROM public.clients
  WHERE tenant_id IS NOT NULL
) c
WHERE c.rn = 1
ON CONFLICT (tenant_id, cpf) DO NOTHING;
```

### 2. Criar `src/services/clientProfileService.ts`

Serviço centralizado com função principal `getClientProfile(tenantId, cpf)`:

- Busca em `client_profiles` primeiro
- Fallback: consolida de `clients` e faz upsert automático em `client_profiles`
- Retorna objeto padronizado com todos os campos cadastrais
- Função `upsertClientProfile(tenantId, cpf, data, source)` para atualizações
- Lógica de merge: só sobrescreve campo se o novo valor for não-vazio (nunca apaga dados existentes)

### 3. Refatorar `negociarieService.ts`

- Substituir `fetchClientAddress` interno por chamada a `clientProfileService.getClientProfile`
- Remover consolidação duplicada
- `buildBoletoPayload` recebe dados já consolidados do profile

### 4. Refatorar `AgreementCalculator.tsx`

- `checkRequiredFields` usa `clientProfileService.getClientProfile` em vez de iterar `clients[]`
- `handleSaveMissingFields` faz upsert em `client_profiles` + update nos `clients` (para retrocompatibilidade)
- Validação com erro específico por campo

### 5. Ajustar MaxList Import (`MaxListPage.tsx`)

- No `buildRecordFromMapping`, mapear campos de endereço mesmo quando vêm como `custom:*` (endereco, cep, cidade, uf, bairro)
- Após upsert em `clients`, fazer upsert em `client_profiles` consolidando os dados do CPF
- Source = `'maxlist'`

### 6. Ajustar `ClientDetailHeader.tsx`

- `handleSaveEdit` (edição manual de dados) faz upsert em `client_profiles` além de atualizar `clients`
- Source = `'manual'`

### 7. Ajustar importação via planilha (`clientService.ts`)

- Após importação, consolidar dados em `client_profiles`
- Source = `'import'`

## Fluxo Resultante

```text
Importação (MaxList/Planilha/Manual)
  ↓
clients (parcelas) + client_profiles (upsert cadastral)
  ↓
Formalização de Acordo
  ↓
clientProfileService.getClientProfile(tenant_id, cpf)
  ↓
Dados completos → Negociarie boleto
```

## Arquivos Afetados

| Arquivo | Mudança |
|---|---|
| **Migration SQL** | Criar `client_profiles`, RLS, backfill |
| `src/services/clientProfileService.ts` | **Novo** — serviço canônico |
| `src/services/negociarieService.ts` | Usar `clientProfileService` em vez de consolidação local |
| `src/components/client-detail/AgreementCalculator.tsx` | Usar `clientProfileService` para validação |
| `src/components/client-detail/ClientDetailHeader.tsx` | Upsert em `client_profiles` ao editar |
| `src/pages/MaxListPage.tsx` | Upsert em `client_profiles` após importação |
| `src/services/clientService.ts` | Upsert em `client_profiles` após importação planilha |

## Garantias

- Isolamento total por `tenant_id` (RLS + filtro explícito)
- Merge não-destrutivo (nunca apaga campo preenchido)
- Retrocompatível: `clients` continua sendo atualizado para não quebrar queries existentes
- Backfill automático na migration para dados já existentes
- Apenas YBRASIL é impactado pela correção de MaxList; outros tenants continuam funcionando

