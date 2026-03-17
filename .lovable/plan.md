

# Expandir dados do devedor no Atendimento + Config de campos visíveis por Admin

## Resumo

Duas entregas:
1. **Chevron expansível** no `ClientHeader` do `/atendimento` — idêntico ao comportamento de "Mais informações do devedor" do `/carteira` (screenshot de referência)
2. **Nova aba em Cadastros** onde o Admin configura quais campos o operador vê na expansão

---

## 1. Chevron expansível no ClientHeader

**Arquivo:** `src/components/atendimento/ClientHeader.tsx`

- Adicionar `Collapsible` com `CollapsibleTrigger` ("Mais informações do devedor" + `ChevronDown`)
- Na `CollapsibleContent`, grid com os campos do devedor usando o mesmo padrão `InfoItem` do `ClientDetailHeader`
- Campos: telefones, email, endereço, bairro, cidade, UF, CEP, cod. devedor, cod. contrato, valores (saldo, atualizado), perfil devedor, tipo dívida, status cobrança, observações
- O `client` já vem com `select("*")` no AtendimentoPage — todos os campos estão disponíveis
- Ampliar a interface `ClientHeaderProps` para aceitar `client: any` (ou campos expandidos) e receber `clientRecords` para cálculos agregados
- Buscar config de campos visíveis via query na tabela `atendimento_field_config`; se não houver config, mostrar todos

## 2. Tabela de configuração de campos visíveis

**Migration SQL:**
```sql
CREATE TABLE public.atendimento_field_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  visible BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  UNIQUE(tenant_id, field_key)
);
ALTER TABLE public.atendimento_field_config ENABLE ROW LEVEL SECURITY;
-- RLS: tenant members can read, admins can update
```

Campos seed (inseridos na primeira vez que o admin abre a config): phone, phone2, phone3, email, endereco, bairro, cidade, uf, cep, external_id, cod_contrato, valor_saldo, valor_atualizado, tipo_devedor, tipo_divida, status_cobranca, observacoes.

## 3. Aba "Campos do Atendimento" em Cadastros

**Arquivo novo:** `src/components/cadastros/AtendimentoFieldsConfig.tsx`
- Lista de campos com switch on/off (visível/oculto)
- Ao carregar, se não existir config para o tenant, faz seed automático com todos visíveis
- Salva via upsert na tabela

**Arquivo:** `src/pages/CadastrosPage.tsx`
- Adicionar item `{ key: "campos_atendimento", label: "Campos do Atendimento", icon: Headset }` no grupo "Acesso"
- Renderizar `<AtendimentoFieldsConfig />` quando ativo

## 4. Service

**Arquivo novo:** `src/services/atendimentoFieldsService.ts`
- `fetchFieldConfig(tenantId)` — retorna campos com visibilidade
- `seedDefaultFields(tenantId)` — insere campos padrão se não existem
- `toggleFieldVisibility(id, visible)` — altera visibilidade

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabela `atendimento_field_config` + RLS |
| `src/components/atendimento/ClientHeader.tsx` | Collapsible com campos expandidos, filtrados pela config |
| `src/pages/AtendimentoPage.tsx` | Passar `clientRecords` ao ClientHeader |
| `src/pages/CadastrosPage.tsx` | Nova aba "Campos do Atendimento" |
| Novo: `src/components/cadastros/AtendimentoFieldsConfig.tsx` | UI de config |
| Novo: `src/services/atendimentoFieldsService.ts` | Service CRUD |

