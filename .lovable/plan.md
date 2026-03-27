

# Plano: Corrigir callback para processar pagamento e baixar parcela

## Escopo restrito
- **NÃO** alterar o fluxo de geração de boleto (já funciona)
- **NÃO** alterar nomenclaturas existentes
- Apenas corrigir o callback de retorno e garantir que o `id_parcela` seja salvo para fazer o match

## Problema

A Negociarie envia o callback assim:
```text
{
  "client_id": "...",
  "token": "SHA1(client_id + client_secret)",
  "parcelas": [
    {
      "id_parcela": "8723",
      "status": "PAGA",
      "id_status": 801,
      "data_pagamento": "2020-01-12",
      "valor": 100.00,
      "valor_pago": 103.00,
      ...
    }
  ]
}
```

Mas o handler atual:
1. Busca `body.id_geral` que **não existe** no callback → retorna 400
2. Não salva `id_parcela` da API ao criar a cobrança → impossível fazer match
3. Busca por `id_geral` em vez de `id_parcela`

## Correções

### 1. `src/services/negociarieService.ts` — Salvar `id_parcela` da resposta

Nas funções `generateSingleBoleto` e `generateAgreementBoletos`, ao chamar `saveCobranca`, adicionar:
```
id_parcela: parcelaResult?.id_parcela || payload.parcelas[0].id_parcela
```

Isso é a **única** mudança neste arquivo — adicionar 1 campo ao objeto de `saveCobranca`. Nenhuma outra alteração.

### 2. `supabase/functions/negociarie-callback/index.ts` — Reescrever para estrutura real

O handler precisa:
- Aceitar `body.parcelas[]` (array) em vez de campos flat
- Validar `body.token` via SHA1(`NEGOCIARIE_CLIENT_ID` + `NEGOCIARIE_CLIENT_SECRET`)
- Para cada parcela no array:
  - Buscar `negociarie_cobrancas` por `id_parcela` (não por `id_geral`)
  - Mapear status: 801→pago, 800→registrado, 808/809→inadimplente, 810/812→baixado
  - Atualizar a cobrança com `status`, `data_pagamento`, `valor_pago`
  - Se pago (801):
    - Buscar `agreement_id` da cobrança
    - Atualizar `clients.valor_pago` (acumular, não substituir)
    - Criar notificação para o operador
    - Registrar `client_event` na timeline

**Manter compatibilidade**: se `body.id_geral` vier (formato antigo), continuar funcionando como fallback.

### 3. Fluxo de baixa automática

```text
Negociarie POST → /negociarie-callback
  ├─ Valida token SHA1
  ├─ Para cada parcela em body.parcelas[]:
  │   ├─ Busca negociarie_cobrancas por id_parcela
  │   ├─ Atualiza status + valor_pago + data_pagamento
  │   ├─ Se 801 (PAGO):
  │   │   ├─ clients.valor_pago += valor_pago
  │   │   ├─ Cria notificação
  │   │   └─ Registra client_event
  │   └─ Salva callback_data
  └─ Retorna { ok: true, processed: N }
```

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/negociarie-callback/index.ts` | Reescrever para ler `parcelas[]`, validar token SHA1, match por `id_parcela` |
| `src/services/negociarieService.ts` | Adicionar `id_parcela` ao `saveCobranca` (1 linha em cada função) |

## O que NÃO muda
- Payload de geração do boleto (já funciona)
- Nomenclaturas e nomes de campos internos
- Proxy (`negociarie-proxy`)
- `CobrancaForm.tsx`
- Nenhum outro componente

