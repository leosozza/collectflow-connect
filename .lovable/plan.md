
# Resposta: Impacto nos demais clientes/tenants

## Análise de impacto

**Não vai atrapalhar nenhum cliente de nenhuma tenant.** Na verdade, vai **corrigir para todos**, porque:

1. O formato flat atual (`documento`, `nome`, `valor`, `vencimento` na raiz) **não funciona para ninguém** — é por isso que retorna erro 400 para qualquer cliente, não só o Raul
2. Todos os clientes (manuais ou via API) passam pelo mesmo fluxo: `buildNegociariePayload()` → `negociarie-proxy` → Negociarie
3. Os dados de cada cliente vêm do próprio registro no banco (via `fetchClientAddress`), então cada boleto usa os dados corretos do respectivo devedor

## Correção necessária

O payload precisa mudar de formato flat para o formato aninhado que a API exige:

```text
ANTES (flat - não funciona para ninguém):
{ documento, nome, cep, endereco, valor, vencimento }

DEPOIS (aninhado - formato correto da API):
{ cliente: { documento, nome, cep, endereco, ... }, id_geral, parcelas: [...] }
```

## Arquivos a alterar

| Arquivo | Mudança |
|---|---|
| `src/services/negociarieService.ts` | Refatorar `buildNegociariePayload` para retornar `{ cliente, id_geral, parcelas }` |
| `supabase/functions/negociarie-proxy/index.ts` | No case `nova-cobranca`: normalizar dentro de `cliente` (não flat) e repassar |

## Detalhes técnicos

### `buildNegociariePayload` — novo formato:
```typescript
{
  cliente: {
    documento: "38568385893",        // só dígitos
    nome: "Raul Jose Seixas Junior",
    cep: "06186-130",                // com hífen
    endereco: "Rua Luiz Henrique de Oliveira",
    numero: "",
    complemento: "",
    cidade: "Osasco",
    uf: "SP",
    telefones: ["11945542245"],      // array
    email: "raulsjunior@hotmail.com"
  },
  id_geral: "ACORDO-535df9af",
  parcelas: [
    { id_parcela: "entrada", data_vencimento: "2026-03-27", valor: 10.00 }
  ]
}
```

### Proxy — simplificação:
- Normalizar campos dentro de `data.cliente` (não na raiz)
- Repassar payload estruturado diretamente para `/cobranca/nova`

### Validação:
- `validateAddressFields` será ajustada para validar dentro de `cliente`
- Mesmas regras: CEP com hífen, CPF só dígitos, UF 2 letras maiúsculas
