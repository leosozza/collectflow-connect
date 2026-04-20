
## Plano — Reorganizar bloco de telefones em "Todos os Telefones"

### Estado atual
Hoje há 4 colunas no header: Telefone 1, Telefone 2, Telefone 3, "Ver todos (N)". Cada número vem de `clients.phone/phone2/phone3` (texto puro).

### Novo layout
Bloco único à esquerda chamado **"Todos os Telefones"** com lista vertical:

```
🔥  (11) 96551-9515    Principal       [✏️] [🚫]
○   (81) 98489-1623    Mãe             [✏️] [🚫]
○   —                  —                [+ adicionar]
```

- **Col 1**: Hot (chama laranja preenchida no nº 1; cinza clicável nos outros para promover).
- **Col 2**: Número formatado. Inativo → riscado + opacidade 50%.
- **Col 3**: Observação editável inline (Pai, Mãe, Trabalho, etc.).
- **Col 4**: ✏️ Editar número (popover com input) | 🚫 Inativar/Reativar.

### Persistência

Schema atual só tem texto (`phone/phone2/phone3`). Para suportar **observação** e **inativação** sem quebrar integrações existentes, criar tabela complementar:

```sql
create table public.client_phone_metadata (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  cpf text not null,
  credor text not null,
  slot text not null check (slot in ('phone','phone2','phone3')),
  observacao text,
  is_inactive boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (tenant_id, cpf, credor, slot)
);
-- RLS via get_my_tenant_id()
```

O número em si continua em `clients.*` (preserva régua, campanhas, WhatsApp button). Tabela nova só guarda metadados por slot.

### Comportamento

1. **Editar número** → popover com input → atualiza `clients.{slot}` em todos registros do CPF+credor + `client_profiles` + log `client_events` (`phone_updated`).
2. **Observação** → input inline com debounce → grava em `client_phone_metadata`.
3. **Inativar** → toggle `is_inactive=true`. Linha riscada visualmente, ícone Hot some (não pode ser promovido).
4. **Hot** → se Telefone 1 for inativado, próximo ativo vira Hot automaticamente.

### Arquivos

1. **Migração SQL** — nova tabela `client_phone_metadata` + RLS.
2. **`src/services/clientPhoneService.ts`** (~50 linhas adicionais): `updatePhoneNumber`, `updatePhoneObservation`, `togglePhoneInactive`, `fetchPhoneMetadata`.
3. **`src/components/client-detail/ClientDetailHeader.tsx`** (~80 linhas): substituir as 4 colunas atuais por **um bloco único** "Todos os Telefones" com lista vertical + controles inline. Remover botão "Ver todos (N)".
4. **`src/components/atendimento/ClientHeader.tsx`** (~80 linhas, opcional dependendo de Q1): replicar mesmo bloco.

### Perguntas a confirmar antes de codificar

**Q1. Escopo:** aplicar só na Carteira (tela atual) ou também no Atendimento?

**Q2. Inativar bloqueia uso?** Quando o número é marcado inativo, ele deve ser ignorado em régua de cobrança, campanhas WhatsApp e botão WhatsApp? Ou é só efeito visual no header?

**Q3. Layout vazio:** sempre mostrar 3 linhas (com "+ adicionar" nas vazias) ou só linhas preenchidas + um botão "+ adicionar telefone" no final?

### Fora do escopo
- Adicionar 4º+ telefone (schema fixo em 3 slots).
- Histórico de números antigos.
- Validação E.164 reforçada (mantém a normalização atual).
