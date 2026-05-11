## Diagnóstico

A entrada da Gisele Aparecida Araujo (acordo `87ba2418…`, vencimento 11/05, R$ 250) **está paga** no banco. O webhook da Negociarie registrou corretamente em `negociarie_cobrancas`:

| installment_key | status | valor_pago | data_pagamento |
|---|---|---|---|
| `87ba2418-902a-41f5-925d-fb6910c2783e:entrada` | **pago** | 250 | 2026-05-11 |

E há também um `payment_confirmed` em `client_events` (11/05 11:08, id_status 801).

**O problema está na RPC `get_dashboard_vencimentos`** (usada pelo card "Parcelas Programadas"). Para a linha de **entrada**, ela só considera a parcela paga quando o `installment_key` em `negociarie_cobrancas` é:

```sql
nc.installment_key = a.id::text || ':0'   -- ex: '87ba2418…:0'
OR nc.installment_key = 'entrada'
```

Mas a chave real gravada pelo gateway é `'<agreement_id>:entrada'` (ex: `87ba2418-902a-41f5-925d-fb6910c2783e:entrada`). Nenhum dos dois padrões casa, então o dashboard exibe **ANDAMENTO** mesmo com o pagamento registrado.

As parcelas regulares (1..N) funcionam normalmente porque o padrão `a.id::text || ':' || (i+1)::text` casa com as chaves `…:1`, `…:2`, etc. Só a entrada está quebrada.

Esse bug afeta **todos os clientes** com entrada paga via Negociarie no card "Parcelas Programadas" — não é específico da Gisele.

## Plano

### 1. Corrigir a RPC `get_dashboard_vencimentos` (migração)

Ajustar o ramo da **entrada** para também aceitar o padrão `<agreement_id>:entrada`, mantendo retrocompatibilidade com `:0` e `entrada`:

```sql
WHEN EXISTS (
  SELECT 1 FROM negociarie_cobrancas nc
  WHERE nc.agreement_id = a.id
    AND (
      nc.installment_key = a.id::text || ':entrada'   -- novo, padrão real
      OR nc.installment_key = a.id::text || ':0'      -- legado
      OR nc.installment_key = 'entrada'               -- legado
    )
    AND nc.status = 'pago'
) THEN 'paid'
```

Aplicar a mesma lógica também ao bloco `manual_payments` da entrada por simetria (aceitar `<agreement_id>:entrada` além de `entrada`, `<agreement_id>:0`, `installment_number=0`).

Não mexer no ramo das parcelas regulares (já funcionam).

### 2. Validação pós-deploy

Recarregar o dashboard em `/dashboard` no dia 11/05 — a linha da **Gisele Aparecida Araujo** deve aparecer com status **QUITADO** (verde) e o card de "Recebido" subir de R$ 381,20 para R$ 631,20.

## Observações

- Não é necessário alterar dados (o pagamento já está corretamente armazenado). É só fix de leitura.
- Não impacta as outras parcelas (1/9 a 9/9 da Gisele continuam "ANDAMENTO" — corretas, ainda não venceram).
- O mesmo padrão (`:entrada`) é usado em toda a base; a correção destrava o status de todas as entradas pagas via gateway, não só a desta cliente.
