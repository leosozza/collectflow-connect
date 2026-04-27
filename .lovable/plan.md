# Ajuste: "Acionados Hoje" deve ignorar CPFs com Acordo Vigente

## Contexto

Hoje a RPC `get_acionados_hoje` conta como "acionado" todo CPF cuja ficha (`/carteira/:cpf` ou `/atendimento/:cpf`) foi aberta no dia, descontando apenas quem **fechou acordo no mesmo dia**.

**Problema:** se o operador abre a ficha de um devedor que **já possui acordo vigente** (acordo fechado em outro dia, ainda em andamento), ele entra como "acionado" — mas isso é apenas consulta, não acionamento produtivo.

## Regra nova

Um CPF **NÃO** deve contar em "Acionados Hoje" quando:
1. Já fechou acordo hoje (regra atual — mantida), **OU**
2. Possui qualquer acordo **vigente** vinculado àquele CPF/Tenant.

### Definição de "acordo vigente"

Status considerados vigentes: **`approved`** (Em andamento) e **`overdue`** (Atrasado).

Status NÃO vigentes (continuam contando como acionamento válido):
- `completed` (quitado) → faz sentido reabordar para nova venda/upsell
- `cancelled` (cancelado) → operador precisa renegociar
- `pending` / `pending_approval` → ainda não é acordo formalizado, vale como acionamento

## Mudança técnica

Atualizar a RPC `public.get_acionados_hoje` adicionando uma terceira CTE `active_agreements_cpfs` e incluindo um `NOT EXISTS` adicional na contagem final:

```sql
active_agreements_cpfs AS (
  SELECT DISTINCT regexp_replace(a.client_cpf, '\D', '', 'g') AS cpf
  FROM public.agreements a
  WHERE a.tenant_id = v_tenant_id
    AND a.status IN ('approved', 'overdue')
)
...
SELECT COUNT(*) INTO v_count
FROM visited_cpfs v
WHERE v.cpf <> ''
  AND length(v.cpf) >= 11
  AND NOT EXISTS (SELECT 1 FROM agreed_today a WHERE a.cpf = v.cpf)
  AND NOT EXISTS (SELECT 1 FROM active_agreements_cpfs aa WHERE aa.cpf = v.cpf);
```

Observação: a checagem de acordos vigentes **não** é filtrada por operador (`_user_id`), pois um acordo vigente é um fato global do CPF — independe de quem abriu a tela.

## Entregável

- Migração SQL substituindo a função `get_acionados_hoje` (CREATE OR REPLACE).
- Nenhuma alteração no frontend — `DashboardPage.tsx` continua chamando a mesma RPC.
- O KPI passa a refletir apenas **acionamentos realmente produtivos** do dia.

## Confirmação pedida

Confirma que `approved` + `overdue` é o conjunto correto de "acordo vigente" a ser excluído? Se quiser também excluir `pending` (acordos aguardando confirmação de pagamento da entrada), me avise antes de aplicar.
