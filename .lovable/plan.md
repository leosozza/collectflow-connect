

# Correção da busca na Carteira — CPF, telefone, e-mail e nome com acentos

## Problemas encontrados na RPC `get_carteira_grouped`

| Campo | Problema |
|-------|----------|
| **CPF** | Só remove pontos (`replace(_search, '.', '')`), não remove traços. CPF com formato `123.456.789-00` não encontra. |
| **Telefone** | Compara `_search` direto contra `phone/phone2/phone3` sem normalizar. Se o usuário digita `(11) 99999-1234`, o ILIKE falha contra `11999991234`. |
| **E-mail** | Funciona tecnicamente (ILIKE), mas a busca multi-word quebra: se o e-mail é tratado como palavra separada, o filtro `nome_completo ILIKE ALL(words)` pode consumir antes. |
| **Nome** | Case-insensitive (ILIKE ok), mas **não é accent-insensitive**. "Stefani" não encontra "Stéfani". |

## Solução

### 1. Habilitar extensão `unaccent` (migration)
```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

### 2. Atualizar a RPC `get_carteira_grouped` — bloco de busca

**CPF**: Remover todos os não-dígitos de `_search` e de `c.cpf` para comparação:
```sql
regexp_replace(c.cpf, '\D', '', 'g') ILIKE '%' || regexp_replace(_search, '\D', '', 'g') || '%'
```

**Telefone**: Normalizar removendo não-dígitos do input e dos campos:
```sql
regexp_replace(c.phone, '\D', '', 'g') ILIKE '%' || regexp_replace(_search, '\D', '', 'g') || '%'
-- Mesma lógica para phone2 e phone3
```

**Nome**: Usar `unaccent()` em ambos os lados para busca sem acento:
```sql
unaccent(c.nome_completo) ILIKE ALL (SELECT '%' || unaccent(unnest(_search_words)) || '%')
```

**E-mail**: Manter ILIKE mas garantir que funciona com a busca raw (sem split por palavras):
```sql
c.email ILIKE '%' || _search || '%'
```

### Arquivo
- Migration SQL: `CREATE EXTENSION unaccent` + `CREATE OR REPLACE FUNCTION get_carteira_grouped` com busca corrigida

### Resultado
- CPF: busca funciona com `123.456.789-00`, `12345678900`, ou qualquer formato
- Telefone: busca funciona com `(11) 99999-1234`, `11999991234`, etc.
- E-mail: busca funciona normalmente
- Nome: busca funciona sem acentos e case-insensitive ("stefani" encontra "Stéfani")

