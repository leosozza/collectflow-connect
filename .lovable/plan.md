

# Plano: Telefones ilimitados com priorização inteligente

## Situação atual

- A tabela `clients` tem apenas 3 campos: `phone`, `phone2`, `phone3`
- A edge function `targetdata-enrich` já salva o retorno completo em `enrichment_data` (JSONB), mas preenche apenas os 3 primeiros telefones sem nenhuma lógica de priorização
- Telefones excedentes são descartados

## Solução proposta

### 1. Nova tabela `client_phones` — armazenamento ilimitado com metadados

```text
client_phones
├── id (uuid, PK)
├── tenant_id (uuid, FK tenants)
├── cpf (text)  — agrupa por pessoa
├── phone_number (text, NOT NULL)
├── phone_type (text) — celular, fixo, comercial
├── priority (int) — ordem de relevância (1 = melhor)
├── is_whatsapp (boolean, default false)
├── source (text) — 'targetdata', 'manual', 'import'
├── raw_metadata (jsonb) — dados originais da API
├── created_at / updated_at
└── UNIQUE(tenant_id, cpf, phone_number)
```

### 2. Lógica de priorização na edge function

Ao receber os telefones da Target Data, ordenar antes de salvar:

```text
Prioridade (menor = melhor):
1. Celular com DDD 9 dígitos (provável WhatsApp)
2. Outros celulares
3. Telefone fixo
```

Regra prática: números com 11 dígitos começando com 9 no 3º dígito (após DDD) são celulares. Os 3 melhores vão para `phone`, `phone2`, `phone3`. Todos vão para `client_phones`.

### 3. UI — Visualização completa no detalhe do cliente

No `ClientDetailHeader`, ao lado dos 3 telefones principais, adicionar um botão "Ver todos (X)" que abre um popover/dialog listando todos os telefones com:
- Número formatado
- Tipo (celular/fixo)
- Badge "WhatsApp" se aplicável
- Botão de ação rápida (ligar, WhatsApp)

### Arquivos modificados

| Arquivo | Alteração |
|---------|-----------|
| **Migration** | Criar tabela `client_phones` com RLS |
| `supabase/functions/targetdata-enrich/index.ts` | Priorizar celulares, salvar todos em `client_phones` |
| `src/components/client-detail/ClientDetailHeader.tsx` | Botão "Ver todos" com lista completa de telefones |

### Detalhes técnicos

- RLS: mesma política de `clients` (tenant isolation)
- A tabela `client_phones` é complementar — os 3 campos existentes continuam funcionando normalmente para compatibilidade
- Na importação manual e MaxList, telefones também serão inseridos em `client_phones` com `source = 'import'`

