

# Preencher tipo_divida_id via sincronização MaxList

## Garantia de segurança

A alteração **não afeta registros que já têm tipo_divida_id preenchido**. O campo está na lista `PROTECTED_FIELDS`, e o código de reconciliação (modo update) só atualiza campos protegidos quando o valor existente é NULL. Isso significa:

- Cheques que já receberam tipo_divida_id → **não serão tocados**
- Registros com NULL → **receberão o tipo correto**
- A atualização mensal continua funcionando normalmente

## O que muda

### Arquivo: `supabase/functions/maxlist-import/index.ts`

**Antes** (linhas 113-122): busca apenas "Cheque" em `tipos_divida`.

**Depois**: busca **todos** os `tipos_divida` do tenant e cria um mapa `PaymentType → tipo_divida_id`:

```text
PaymentType → tipo_divida_id
1 (Dinheiro)        → fdda7e09...
2 (Cheque)          → f750a86e... (TESS)
3 (Débito)          → 49ea87a9... (Cartão de Crédito TESS)
4 (Crédito)         → 49ea87a9... (Cartão de Crédito TESS)
5 (Boleto)          → 2cd925fd... (TESS)
6 (Cheque Caução)   → 5654b6a2...
7 (Transf. Bancária)→ 51c16e0b...
10, 11              → NULL (sem equivalente)
```

**Linha 316**: substituir a condicional de cheque por lookup no mapa completo:
```typescript
// Antes
tipo_divida_id: record.tipo_divida_id || ((rawPaymentType === 2 || rawPaymentType === 6) ? chequeTipoDividaId : null)

// Depois
tipo_divida_id: record.tipo_divida_id || paymentTypeToDividaMap.get(String(rawPaymentType)) || null
```

## Lógica de resolução do mapa

1. Buscar todos `tipos_divida` do tenant
2. Criar mapa por nome (case-insensitive): `"boleto" → id`, `"cheque" → id`, etc.
3. Mapear cada PaymentType para o nome correspondente
4. Priorizar tipo_divida com `credor_id` do credor atual; senão, usar genérico

## Nenhuma outra alteração

- Sem mudança no frontend
- Sem migration
- Sem alteração na lógica de PROTECTED_FIELDS ou reconciliação

## Como usar

Após deploy, usar "Atualizar Parcelas" ou "Sincronizar por Período" no MaxList. Os 419k registros com NULL receberão o tipo_divida_id correto progressivamente.

