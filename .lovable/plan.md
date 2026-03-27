
# Plano: Corrigir fluxo de baixa automática — 3 problemas identificados

## Diagnóstico

Investiguei o banco de dados e os logs. Encontrei **3 problemas**:

### Problema 1: `id_parcela` não foi salvo no registro existente
O boleto do Raul foi gerado **antes** do deploy do código que salva `id_parcela`. Resultado:
```text
negociarie_cobrancas.id_parcela = NULL
callback_data.parcelas[0].id_parcela = "16053085"  ← está no JSON mas não na coluna
```
Quando a Negociarie enviar o callback com `id_parcela: "16053085"`, o handler não vai encontrar nenhum registro porque a coluna está vazia.

### Problema 2: Callback provavelmente nunca chegou
Os logs do `negociarie-callback` estão **vazios** — nenhuma requisição foi recebida. Possíveis causas:
- A Negociarie precisa ter a URL de callback configurada no painel deles
- O `callback_url` no payload do boleto pode não estar sendo usado pela Negociarie para este boleto específico (pago via PIX direto)

### Problema 3: O callback busca `clients` via FK que pode não existir
A query faz `.select("*, clients(operator_id, tenant_id, cpf, id)")` — isso exige FK `client_id` na tabela `negociarie_cobrancas` apontando para `clients`. Se esse FK não existe, a query falha silenciosamente.

## Correções

### 1. Migration: Backfill `id_parcela` de registros existentes
SQL para preencher `id_parcela` a partir do `callback_data` já salvo:
```sql
UPDATE negociarie_cobrancas 
SET id_parcela = callback_data->'parcelas'->0->>'id_parcela'
WHERE id_parcela IS NULL 
  AND callback_data->'parcelas'->0->>'id_parcela' IS NOT NULL;
```

### 2. `supabase/functions/negociarie-callback/index.ts` — Remover dependência de FK `clients`
- Remover o join `clients(operator_id, tenant_id, cpf, id)` da query de busca
- Buscar o `agreement` pela `agreement_id` da cobrança
- A partir do agreement, buscar o client por CPF + tenant_id (como já faz no bloco de pagamento)
- Isso elimina a dependência de FK que pode não existir

### 3. Testar manualmente o callback
Após o deploy, usar `curl` para simular o callback da Negociarie e verificar se o fluxo funciona:
```bash
curl -X POST https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/negociarie-callback \
  -H "Content-Type: application/json" \
  -d '{"client_id":"...","token":"SHA1(...)","parcelas":[{"id_parcela":"16053085","id_status":801,"status":"PAGA","valor":11.00,"valor_pago":11.00,"data_pagamento":"2026-03-27"}]}'
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Backfill `id_parcela` dos registros existentes |
| `supabase/functions/negociarie-callback/index.ts` | Remover join com `clients`; buscar agreement e client separadamente |

## O que NÃO muda
- Geração de boleto (já funciona)
- Proxy (já funciona)
- Nomenclaturas
- `negociarieService.ts` (código novo já salva `id_parcela` corretamente)
