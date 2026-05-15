
## SSOT de Status — 7 estados imutáveis decididos pelo banco

### Regra final dos 7 estados

| # | Categoria | Status | Regra (calculada por CPF+Credor) |
|---|---|---|---|
| 1 | Dívida Original | **Quitado** | Sem acordo na história + todas parcelas de `clients` pagas |
| 2 | Dívida Original | **Em Dia** | Sem acordo na história + parcelas a vencer, nenhuma vencida |
| 3 | Dívida Original | **Inadimplente** | **Sem acordo na história** + ≥1 parcela vencida em aberto |
| 4 | Acordo Rivo | **Acordo Vigente** | `agreements.status='approved'` + nenhuma parcela do acordo vencida |
| 5 | Acordo Rivo | **Acordo em Atraso** | Parcela do acordo vencida ≤ `prazo_dias_acordo` (credor; fallback 10) |
| 6 | Acordo Rivo | **Acordo Cancelado** | Atraso > prazo **OU** `agreements.status='cancelled'` (TERMINAL — não regride) |
| 7 | Acordo Rivo | **Acordo Quitado** | `agreements.status='completed'` (todas parcelas do acordo pagas) |

**Regra de ouro**: a partir do momento em que existe qualquer acordo na história do CPF+Credor, o status sempre vem da família "Acordo Rivo". Inadimplente fica reservado a dívidas originais que nunca tiveram acordo.

### Hierarquia (quando há múltiplos acordos no mesmo CPF+Credor)
```
Acordo Vigente > Acordo em Atraso > Acordo Cancelado > Acordo Quitado
```
Se o cliente tem 1 acordo cancelado e abre 1 novo acordo vigente, vence Acordo Vigente. Se o último acordo foi cancelado e não há novo, fica Acordo Cancelado (terminal até abrir um novo).

---

## Migration única (eu reescrevo as 2 funções dentro dela)

```text
PASSO 1 — Reescrever map_canonical_to_legacy_status
  Retorna os 7 nomes em PT-BR:
    quitado          → 'Quitado'
    em_dia           → 'Em Dia'
    inadimplente     → 'Inadimplente'
    acordo_vigente   → 'Acordo Vigente'
    acordo_atrasado  → 'Acordo em Atraso'
    acordo_cancelado → 'Acordo Cancelado'
    acordo_quitado   → 'Acordo Quitado'

PASSO 2 — Reescrever get_client_consolidated_status
  Assinatura: (_tenant_id uuid, _cpf text, _credor text,
               _atraso_quebra_dias int DEFAULT NULL)
  Quando _atraso_quebra_dias é NULL:
    SELECT prazo_dias_acordo FROM credores
      WHERE tenant_id=_tenant_id AND (razao_social=_credor OR nome_fantasia=_credor)
    fallback 10.
  Lógica:
    A) Existe agreements para o CPF+Credor? Sim → status vem da família Acordo:
       - has 'approved' sem atraso       → acordo_vigente
       - has parcela vencida ≤ prazo     → acordo_atrasado
       - has parcela vencida > prazo
         OR status='cancelled' (último)  → acordo_cancelado  (TERMINAL)
       - all installments paid
         OR status='completed'           → acordo_quitado
       (hierarquia acima resolve empates)
    B) Nunca houve agreements:
       - todas parcelas de clients pagas → quitado
       - alguma vencida em aberto        → inadimplente
       - só a vencer                     → em_dia

PASSO 3 — Garantir UNIQUE (tenant_id, nome) em tipos_status

PASSO 4 — DELETE de tipos_status:
  'Risco de Processo', 'Em negociação', 'Em Negociação'

PASSO 5 — UPDATE rename de legados:
  'Quebra de Acordo' → 'Acordo Cancelado'
  'Acordo Atrasado'  → 'Acordo em Atraso'
  'Em dia'           → 'Em Dia'

PASSO 6 — UPSERT por tenant dos 7 oficiais
  (com cor + papel_sistema correto em regras JSONB)

PASSO 7 — DELETE de duplicatas residuais (a.id < b.id por tenant+nome)

PASSO 8 — Vincular clients.status_cobranca_id
  BEGIN;
    SET LOCAL app.force_status_override = 'true';   -- bypass do trigger
    UPDATE clients c
      SET status_cobranca_id = ts.id
      FROM tipos_status ts
      WHERE ts.tenant_id = c.tenant_id
        AND ts.nome = map_canonical_to_legacy_status(
              get_client_consolidated_status(c.tenant_id, c.cpf, c.credor, NULL))
        AND ts.nome IS NOT NULL;
  COMMIT;

PASSO 9 — Validação
  SELECT tenant_id, ts.nome, count(*)
  FROM clients c JOIN tipos_status ts ON ts.id = c.status_cobranca_id
  GROUP BY 1,2 ORDER BY 1,2;
```

## Em paralelo (mesma leva)

- Conferir `src/components/cadastros/TipoStatusList.tsx`. Se ainda tiver `quebra_acordo` ou `em_negociacao` em `PAPEIS_SISTEMA`, removo. Garantir que os 7 papéis listados sejam: `quitado`, `em_dia`, `inadimplente`, `acordo_vigente`, `acordo_atrasado`, `acordo_cancelado`, `acordo_quitado`.

## Os 4 efeitos prometidos — confirmados

1. **Limpeza de filtros** ✅ — "Risco de Processo" e "Em Negociação" somem do menu de Status na Carteira (passo 4).
2. **Transição p/ Tabulação** ✅ — sem `em_negociacao` na tabela e sem o cron escrevendo esse papel, clientes voltam ao status financeiro real. "Em Negociação" continua existindo apenas como tabulação/histórico.
3. **Quitado real** ✅ — passo 2 garante `quitado` para CPF sem acordo cuja dívida original está toda paga. Passo 8 grava no banco.
4. **Quebra zero** ✅ — toda tela lê de `clients.status_cobranca_id` (alimentado pela função canônica) ou chama o helper diretamente. Fonte única.

## Memória que vou atualizar pós-aplicação

`mem://logic/status-standardization-cpf-centric` — substituir hierarquia antiga pelos 7 estados imutáveis e marcar `acordo_cancelado` como terminal (não regride para `inadimplente`).

## Próximo passo

Aprova → eu saio do plano, disparo a migration e atualizo a UI na mesma leva.
