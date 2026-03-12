

# Plano: Corrigir integração Target Data (URL + parsing da resposta)

## Problema identificado

A edge function `targetdata-enrich` falha com **HTTP 404** em todas as requisições. Dois problemas raiz:

1. **URL errada**: O código usa `https://api.targetdata.com.br/v1/search/pf` mas a documentação oficial define a URL base como `https://api.targetdata.com.br/api`, resultando na URL correta: `https://api.targetdata.com.br/api/v1/search/pf`

2. **Parsing da resposta incorreto**: O código espera campos planos (`telefones`, `celular`, `email`) mas a API retorna uma estrutura aninhada:

```text
{
  "header": { "amount_found": 1, ... },
  "results": [
    {
      "cadastral": { "nr_cpf": "...", "nm_completo": "..." },
      "contato": {
        "telefone": [
          { "nr_ddd": "43", "nr_telefone": "988319530", "ds_tipo_telefone": "Movel" }
        ],
        "endereco": [
          { "ds_logradouro": "...", "ds_bairro": "...", "ds_cidade": "...", "sg_uf": "...", "nr_cep": "..." }
        ],
        "email": [
          { "ds_email": "exemplo@email.com" }
        ]
      }
    }
  ]
}
```

## Solução

### Arquivo: `supabase/functions/targetdata-enrich/index.ts`

1. **Corrigir URL**: `/v1/search/pf` → `/api/v1/search/pf`
2. **Corrigir parsing da resposta**: Extrair resultados de `response.results[]`
3. **Corrigir match por CPF**: Comparar via `result.cadastral.nr_cpf`
4. **Corrigir extração de telefones**: Ler de `contato.telefone[]` com campos `nr_ddd` + `nr_telefone` e `ds_tipo_telefone`
5. **Corrigir extração de emails**: Ler de `contato.email[]` com campo `ds_email`
6. **Corrigir extração de endereço**: Ler de `contato.endereco[]` com campos `ds_logradouro`, `ds_bairro`, `ds_cidade`, `sg_uf`, `nr_cep`

### Lógica de priorização de telefones (mantida)

```text
Prioridade 1: Movel (celular) → provável WhatsApp
Prioridade 2: Fixo
Prioridade 3: Outros
```

O campo `ds_tipo_telefone` da API já indica "Movel" ou "Fixo", eliminando a necessidade de inferir pelo número.

### Também atualizar: `src/components/carteira/EnrichmentConfirmDialog.tsx`

A função `extractFromDataReturned` precisa ser atualizada para parsear a nova estrutura `contato.telefone[]` / `contato.email[]` da API, para que a tabela de logs exiba os dados corretamente.

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/targetdata-enrich/index.ts` | Corrigir URL, parsing de resposta, extração de dados |
| `src/components/carteira/EnrichmentConfirmDialog.tsx` | Atualizar `extractFromDataReturned` para nova estrutura |

