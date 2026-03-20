

# Plano: Corrigir falha na geração de boletos Negociarie

## Problema identificado

O `saveCobranca` em `negociarieService.ts` (linha 135-145) envia colunas que **não existem** na tabela `negociarie_cobrancas`:

| Código envia | Tabela espera |
|---|---|
| `external_id` | `id_geral` |
| `vencimento` | `data_vencimento` |
| `cpf` | ❌ não existe (usar `client_id`) |
| `nome` | ❌ não existe |
| `response_data` | `callback_data` (ou ignorar) |

A tabela `negociarie_cobrancas` requer: `id_geral` (string, NOT NULL), `data_vencimento` (string, NOT NULL), `tenant_id`, `valor`.

Isso causa erro no insert do banco. Como o `saveCobranca` está dentro de um `try/catch` interno (linha 146), o erro é engolido silenciosamente. Mas se a API Negociarie também falhar (servidor indisponível, credenciais expiradas), o erro externo (linha 152) propaga para o `toast.error`.

Possíveis cenários da falha:
1. A API Negociarie respondeu com erro (servidor indisponível, dados incompletos do cliente como CEP vazio)
2. O save local sempre falha silenciosamente por schema mismatch

## Correção

### `src/services/negociarieService.ts` — Corrigir `saveCobranca` call (linhas 135-145)

Mapear os campos corretamente para o schema da tabela:

```typescript
await this.saveCobranca({
  tenant_id: agreement.tenant_id,
  agreement_id: agreement.id,
  id_geral: apiResult?.id_geral || apiResult?.id || `manual-${Date.now()}`,
  data_vencimento: inst.dueDate,
  valor: inst.value,
  status: "pendente",
  link_boleto: apiResult?.link_boleto || apiResult?.url_boleto || null,
  linha_digitavel: apiResult?.linha_digitavel || null,
  pix_copia_cola: apiResult?.pix_copia_cola || null,
  callback_data: apiResult || null,
});
```

### `src/services/negociarieService.ts` — Melhorar log de erro da API

Adicionar log detalhado no catch externo para que possamos ver exatamente o que a API Negociarie retornou (endpoint indisponível, campo obrigatório faltando, etc.).

### Observação sobre a API

Se o erro foi na chamada à API Negociarie (não no save local), pode ser que:
- O endereço do cliente está incompleto (CEP vazio causa rejeição)
- O servidor Negociarie estava temporariamente indisponível

A correção do schema é essencial independentemente, pois os boletos gerados com sucesso nunca estavam sendo salvos corretamente no banco.

## Arquivo a editar

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Corrigir mapeamento de campos no `saveCobranca` para o schema real da tabela `negociarie_cobrancas` |

