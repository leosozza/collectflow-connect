

# Integrar Gravações de Chamadas 3CPlus na Timeline do Cliente

## Resumo
Criar uma tabela `call_logs` para armazenar registros de chamadas (telefone, duração, status, link de gravação, operador). Ao finalizar o atendimento (tabulação), o sistema busca automaticamente os dados da chamada na API 3CPlus e salva no banco. A timeline do cliente passa a exibir esses registros com player de áudio inline.

## Mudanças

### 1. Nova tabela `call_logs` (migration)
```sql
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) NOT NULL,
  client_id uuid REFERENCES clients(id),
  client_cpf text,
  phone text,
  agent_name text,
  call_id_external text, -- ID da chamada no 3CPlus
  status text,           -- answered, no_answer, busy, etc.
  duration_seconds int DEFAULT 0,
  recording_url text,
  campaign_name text,
  called_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
-- RLS: tenant users podem ver/inserir logs do próprio tenant
```

### 2. Salvar chamada ao tabular (`dispositionService.ts`)
Após a tabulação com sucesso (que já chama `qualifyOn3CPlus`), buscar os dados da chamada via `threecplus-proxy` action `calls_report` (filtrando pelo `call_id`) e salvar na `call_logs` com o `client_id` vinculado.

### 3. Exibir na timeline (`ClientTimeline.tsx`)
- Adicionar prop `callLogs` ao componente
- Novo tipo `"call"` no `TimelineItem`
- Renderizar com ícone de telefone, duração, status e botão de play inline para a gravação

### 4. Buscar call_logs na `AtendimentoPage.tsx`
- Query adicional: `SELECT * FROM call_logs WHERE client_cpf = ? ORDER BY called_at DESC`
- Passar como prop para `ClientTimeline`

## Arquivos afetados
- **Migration SQL**: nova tabela `call_logs` + RLS
- `src/services/dispositionService.ts`: salvar log após tabulação
- `src/components/atendimento/ClientTimeline.tsx`: renderizar chamadas com player
- `src/pages/AtendimentoPage.tsx`: buscar e passar `callLogs`

