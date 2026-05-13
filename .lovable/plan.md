## Objetivo

Fazer o **"Sincronizar por Período"** (em `/configuracoes/maxlist`) refletir corretamente parcelas pagas vindas do MaxSystem — exatamente como já acontece no fluxo CPF por CPF. Cliente sem acordo que estava INADIMPLENTE e teve a parcela paga passa para **EM DIA** (ou **QUITADO** se todas pagas). Demais status ficam intocados.

## Diagnóstico (curto)

Hoje o "Sincronizar por Período" envia `status_cobranca_id = "__auto__"` para a edge function `maxlist-import`. Isso faz duas coisas que quebram o fluxo:

1. Em registros novos, grava `status_cobranca_id = NULL`.
2. Em registros existentes, **não consegue sobrescrever** o status antigo (INADIMPLENTE) porque `status_cobranca_id` está marcado como `PROTECTED_FIELD` na edge function, e a única exceção atual é para `status='vencido'` (cheque devolvido).

Resultado: 67.353 parcelas no tenant Y.BRASIL estão com `clients.status = 'pago'` mas `status_cobranca_id = Inadimplente`.

## Mudanças (mínimas, cirúrgicas)

### 1. Frontend — `src/pages/MaxListPage.tsx`

No diálogo "Sincronizar por Período", **trocar `__auto__` pelo id de "Em dia" do tenant**, resolvido no momento do submit (consultando `tipos_status` por `regras.papel_sistema = 'em_dia'`).

A escolha pelo "Em dia" e não "Quitado" é proposital: se o cliente tem outras parcelas vencidas no mesmo grupo, o **`auto-status-sync`** que roda em background depois do import já promove o grupo para o status correto da hierarquia (`Quitado` se todas pagas, `Inadimplente` se ainda há vencidas, `Acordo Vigente` se tem acordo, etc). Em dia é o "ponto neutro" que deixa a hierarquia decidir.

### 2. Edge function — `supabase/functions/maxlist-import/index.ts`

Adicionar **uma única exceção** no bloco `PROTECTED_FIELDS` (linhas 558‑572): permitir overwrite de `status_cobranca_id` **apenas** quando `rec.status === 'pago'` E `oldVal` corresponde ao status `Inadimplente` do tenant.

Em pseudocódigo:

```text
isPagoOverridingInadimplente =
  field === 'status_cobranca_id'
  && rec.status === 'pago'
  && oldVal === inadimplenteIdDoTenant
```

Resolução do `inadimplenteIdDoTenant`: já é feita logo no início da função (mesma forma como `vencidoStatusId` é resolvido na linha ~31). Reusar o padrão.

Isso garante que **somente** a transição "INADIMPLENTE → Em dia (e depois auto-status-sync decide)" é permitida. Acordo Vigente, Acordo Atrasado, Quebra de Acordo, Em Negociação, Quitado e Em dia atual continuam **bloqueados** contra sobrescrita pelo MaxSystem.

### 3. Sem migração de dados

- **Não** mexemos nas 67.353 linhas atuais.
- **Não** rodamos backfill.
- **Não** alteramos nenhuma RPC (`get_dashboard_stats_v2`, `get_baixas_realizadas`, `get_carteira_grouped`, `get_client_consolidated_status`, `auto-status-sync`).
- Vale **só daqui pra frente**: na próxima sincronização por período, os clientes que ainda estiverem INADIMPLENTE e tiverem parcelas pagas no MaxSystem serão atualizados.

## O que não muda (garantido)

| Status | Comportamento |
|---|---|
| Acordo Vigente | Intocado — protegido |
| Acordo Atrasado | Intocado — protegido |
| Quebra de Acordo | Intocado — protegido |
| Em Negociação | Intocado — protegido |
| Quitado | Intocado — protegido |
| Em dia | Intocado (não recebe override) |
| **Inadimplente** | **Único que pode virar Em dia / Quitado quando MaxSystem reporta parcela paga** |

Lógicas que **não** são tocadas:
- Fluxo CPF por CPF (já funciona).
- `auto-status-sync` (continua decidindo a hierarquia no nível CPF+Credor).
- `get_client_consolidated_status` e regras da Carteira.
- Tela Baixas Realizadas.
- Dashboard.
- Tela "Atualizar Parcelas" do MaxList.

## Memory a atualizar

- `mem://integrations/maxsystem/unified-import-logic`: adicionar regra "Sincronização por período pode promover Inadimplente → Em dia/Quitado quando MaxSystem reporta parcela paga; demais status são imutáveis via sync."

## Validação após aplicar

1. Rodar Sincronizar por Período em janela curta (últimos 7 dias) no tenant Y.BRASIL.
2. Pegar 3 CPFs sem acordo que apareceram como `paid` no resultado e conferir na Carteira: devem estar **Em dia** ou **Quitado** (não mais Inadimplente).
3. Pegar 1 CPF que tem **Acordo Vigente** e confirmar que continua Acordo Vigente (não foi tocado).
4. Conferir Baixas Realizadas — números seguem iguais à fonte de verdade (UNION manual+portal+negociarie).

## Ordem de execução

1. Editar `supabase/functions/maxlist-import/index.ts` (resolver `inadimplenteIdDoTenant` + adicionar a exceção).
2. Editar `src/pages/MaxListPage.tsx` (resolver e enviar `emDiaId` no `handleUpdatePagos` em vez de `"__auto__"`).
3. Atualizar memory `unified-import-logic`.
4. Validar com a Maria Eduarda.
