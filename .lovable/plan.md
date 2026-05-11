## Objetivo

Adicionar um botão **"Conferência"** no card da campanha que abre um modal listando, por operador, os acordos/recebimentos que compõem o valor final do ranking — permitindo auditar como cada participante chegou ao número exibido.

---

## 1. Novo serviço de conferência

Em `src/services/campaignService.ts`, criar `fetchCampaignAuditDetails(campaignId)` que reaproveita a mesma lógica de filtros do `computeCampaignScoreFallback` (mesma janela `start_date`/`end_date`, mesmos credores via `campaign_credores`, mesmo `created_by = authUid` por participante), porém retornando **as linhas detalhadas** ao invés do total.

Para cada participante da campanha, retorna:

```
{
  operator_id, operator_name, score, rows: [
    { date, client_name, client_cpf, credor, value, source }
  ], computed_total
}
```

Mapeamento por métrica (espelhando a função existente):

- `maior_valor_recebido` / `negociado_e_recebido`: linhas de `manual_payments` + `portal_payments` + `negociarie_cobrancas` dos `agreement_ids` do operador, com `value = amount_paid|amount|valor_pago` e `source` indicando origem do pagamento. Enriquecer com `client_name`/`client_cpf` via join no `agreements`.
- `maior_qtd_acordos`: linhas de `agreements` (1 por acordo, `value = 1`).
- `maior_valor_promessas`: linhas de `agreements` com `value = proposed_total`.
- `maior_valor_primeira_parcela`: linhas de `agreements` com `value = entrada_value > 0 ? entrada : (custom_installment_values[0] || new_installment_value)` e `source = "entrada"|"1ª parcela"`.

Limite defensivo `range(0, 999)` por consulta (já é o padrão no fallback). Sem alteração no SQL/RPC do backend.

## 2. Novo componente `CampaignAuditDialog.tsx`

Em `src/components/gamificacao/`, criar dialog com:

- Header: nome da campanha, métrica, período, credores.
- Conteúdo: `Accordion` (um item por operador, ordenado pelo score atual) mostrando:
  - Cabeçalho com nome, score persistido e total recalculado em tempo real (badge de aviso se divergirem — útil para sinalizar que falta recálculo).
  - `Table` com colunas: Data, Cliente, CPF, Credor, Origem, Valor.
  - Rodapé com soma das linhas.
- Estado vazio amigável quando o operador não tiver linhas.
- Loading via `useQuery` com `queryKey: ["campaign-audit", campaignId]`.

## 3. Integração no `CampaignCard.tsx`

- Importar `Search` (lucide) e o novo dialog.
- Estado local `auditOpen`.
- Adicionar **um novo botão** `outline size="sm"` rotulado **"Conferência"** dentro do bloco existente de ações no `CardContent`. Mostrar para **todos** os usuários (não restringir a admin) — qualquer participante pode auditar o próprio ranking.
- Posicionar antes do botão "Recalcular ranking" no bloco `isTenantAdmin`, e também como botão único quando não-admin. Estrutura:
  - Sempre renderizar o botão Conferência (fora do `if (isTenantAdmin)`).
  - Manter Recalcular e Arquivar dentro do bloco admin.
- Clicar abre o `CampaignAuditDialog` passando `campaign` inteiro.

## Fora do escopo

- Exportar a conferência para CSV/Excel (pode ser feito numa próxima iteração).
- Criar RPC server-side para a auditoria — a versão client-side já reusa a mesma lógica do fallback de recálculo e é suficiente para conferência por campanha.
- Alterar a forma de cálculo de qualquer métrica.

## Detalhes técnicos

- Reaproveitar `fetchCampaignCredorNames` já exportável (ou exportar como helper).
- O mapeamento `operator_id → authUid` já existe em `recalculateCampaignScoresFallback`; extrair para helper compartilhado `getParticipantAuthUidMap(campaignId, tenantId)`.
- Para enriquecer client/credor nos pagamentos: 1 query em `agreements` por lote de IDs (`select id, client_name, client_cpf, credor`) e join em memória.
- Formatadores: usar `formatBR` (já existe no card) e `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
