

# Integração CENPROT - Protesto de Títulos

## Resumo

Nova aba "Protesto" na pagina de Integracoes para gerenciar envio de titulos a protesto via CENPROT, com configuracao de convenio, envio individual e em lote, acompanhamento de status, cancelamento automatico ao pagar acordo, e log completo de operacoes.

## O que sera construido

### 1. Tabela `protest_titles` no banco de dados

Armazena cada titulo enviado a protesto com rastreamento de status.

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador unico |
| tenant_id | uuid (NOT NULL) | Isolamento multi-tenant |
| client_id | uuid (nullable, FK clients) | Referencia ao cliente |
| cpf | text (NOT NULL) | CPF do devedor |
| nome_devedor | text (NOT NULL) | Nome do devedor |
| valor | numeric (NOT NULL) | Valor do titulo |
| data_vencimento | date (NOT NULL) | Data de vencimento do titulo |
| numero_titulo | text | Numero identificador do titulo |
| credor | text (NOT NULL) | Nome do credor |
| especie | text | Especie do titulo (DM, NP, DS, etc) |
| status | text | pending, sent, protested, cancelled, paid, rejected |
| cenprot_protocol | text | Protocolo devolvido pelo cartorio |
| cartorio | text | Cartorio responsavel |
| sent_at | timestamptz | Quando foi enviado |
| protested_at | timestamptz | Quando foi protestado |
| cancelled_at | timestamptz | Quando foi cancelado |
| rejection_reason | text | Motivo de rejeicao |
| created_at | timestamptz | Criacao do registro |
| updated_at | timestamptz | Ultima atualizacao |
| created_by | uuid | Quem criou |

RLS: Admins gerenciam tudo do tenant, operadores visualizam.

### 2. Tabela `protest_logs`

Log de todas as operacoes realizadas (envio, cancelamento, atualizacao de status).

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid (PK) | Identificador |
| tenant_id | uuid | Tenant |
| protest_title_id | uuid (FK) | Titulo relacionado |
| action | text | send, cancel, status_update, reject, batch_send |
| status | text | success, error |
| message | text | Descricao da operacao |
| details | jsonb | Detalhes extras |
| created_by | uuid | Usuario que executou |
| created_at | timestamptz | Quando ocorreu |

### 3. Configuracao do CENPROT no tenant

Armazenada no campo `settings` da tabela `tenants` (mesmo padrao do 3CPlus):

```
settings.cenprot_convenio: string  (numero do convenio)
settings.cenprot_apresentante: string (nome do apresentante)
settings.cenprot_cnpj: string (CNPJ do apresentante)
settings.cenprot_uf: string (UF do apresentante)
settings.cenprot_cidade: string (cidade)
settings.cenprot_especie_padrao: string (especie padrao dos titulos)
settings.cenprot_enabled: boolean
```

### 4. Componentes Frontend

**`src/components/integracao/ProtestoTab.tsx`** - Componente principal da aba com:
- Card de configuracao do convenio CENPROT (campos acima)
- Botao salvar configuracao

**`src/components/integracao/protesto/ProtestoConfigCard.tsx`** - Card com formulario de configuracao do convenio

**`src/components/integracao/protesto/ProtestoTitleForm.tsx`** - Formulario para envio individual de titulo a protesto (selecao de cliente ou preenchimento manual de CPF/nome/valor/vencimento)

**`src/components/integracao/protesto/ProtestoBatchDialog.tsx`** - Dialog para envio em lote: selecao de filtros (credor, status, faixa de valor, dias de atraso) e preview dos titulos que serao enviados

**`src/components/integracao/protesto/ProtestoTitlesList.tsx`** - Tabela com todos os titulos enviados, com filtros por status, badges coloridos, e acoes (cancelar, ver detalhes)

**`src/components/integracao/protesto/ProtestoLogsCard.tsx`** - Card com log de operacoes (mesmo padrao do NegociarieTab)

### 5. Service `src/services/protestoService.ts`

Funcoes CRUD para `protest_titles` e `protest_logs`:
- `fetchProtestTitles(tenantId, filters)` - Lista titulos com filtros
- `createProtestTitle(data)` - Cria titulo individual
- `batchCreateProtestTitles(titles)` - Envio em lote
- `cancelProtestTitle(id)` - Cancela titulo (muda status para "cancelled")
- `updateProtestStatus(id, status)` - Atualiza status
- `fetchProtestLogs(tenantId)` - Lista logs
- `logProtestAction(params)` - Registra log

### 6. Cancelamento automatico ao pagar acordo

No `agreementService.ts`, ao aprovar um acordo, verificar se existem titulos protestados para o CPF do cliente e automaticamente alterar o status para "cancelled" com log.

### 7. Integracao na pagina

- Adicionar aba "Protesto" com icone `Scale` no `IntegracaoPage.tsx`
- Import e render do `ProtestoTab`

## Detalhes tecnicos

### Migracao SQL

```sql
CREATE TABLE protest_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  client_id uuid REFERENCES clients(id),
  cpf text NOT NULL,
  nome_devedor text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data_vencimento date NOT NULL,
  numero_titulo text,
  credor text NOT NULL,
  especie text DEFAULT 'DM',
  status text NOT NULL DEFAULT 'pending',
  cenprot_protocol text,
  cartorio text,
  sent_at timestamptz,
  protested_at timestamptz,
  cancelled_at timestamptz,
  rejection_reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protest_titles ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Tenant admins can manage protest titles"
  ON protest_titles FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view protest titles"
  ON protest_titles FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER update_protest_titles_updated_at
  BEFORE UPDATE ON protest_titles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Logs table
CREATE TABLE protest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  protest_title_id uuid REFERENCES protest_titles(id),
  action text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  message text,
  details jsonb DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE protest_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins can manage protest logs"
  ON protest_logs FOR ALL
  USING (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()))
  WITH CHECK (is_tenant_admin(auth.uid(), tenant_id) OR is_super_admin(auth.uid()));

CREATE POLICY "Tenant users can view protest logs"
  ON protest_logs FOR SELECT
  USING (tenant_id = get_my_tenant_id() OR is_super_admin(auth.uid()));
```

### Fluxo de cancelamento automatico

No servico de acordos, apos aprovar um acordo com status "approved":
1. Buscar `protest_titles` com `cpf = acordo.client_cpf` e `status IN ('pending','sent','protested')`
2. Atualizar para `status = 'cancelled'` e `cancelled_at = now()`
3. Inserir log em `protest_logs` com action "auto_cancel"

### Arquivos modificados/criados

| Arquivo | Acao |
|---|---|
| Migracao SQL | Criar tabelas protest_titles e protest_logs |
| `src/services/protestoService.ts` | Criar - CRUD + logs |
| `src/components/integracao/ProtestoTab.tsx` | Criar - Aba principal |
| `src/components/integracao/protesto/ProtestoConfigCard.tsx` | Criar - Config convenio |
| `src/components/integracao/protesto/ProtestoTitleForm.tsx` | Criar - Envio individual |
| `src/components/integracao/protesto/ProtestoBatchDialog.tsx` | Criar - Envio em lote |
| `src/components/integracao/protesto/ProtestoTitlesList.tsx` | Criar - Lista de titulos |
| `src/components/integracao/protesto/ProtestoLogsCard.tsx` | Criar - Log de operacoes |
| `src/pages/IntegracaoPage.tsx` | Editar - Adicionar aba Protesto |
| `src/services/agreementService.ts` | Editar - Cancelamento automatico |

