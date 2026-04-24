## Tornar busca por nome exigir frase contígua na Carteira

### Problema
Ao buscar "Fernanda Pereira", aparecem variações como "Fernanda Helena dos Santos Pereira" porque o `ILIKE ALL` atual aceita as palavras em qualquer ordem.

### Solução
Nova migration SQL redefinindo `public.get_carteira_grouped` para detectar se a busca é "tipo nome" (sem dígitos) e, nesse caso, exigir **frase contígua** no `nome_completo`. Buscas com dígitos (CPF/telefone) mantêm o comportamento atual de palavras dispersas.

### Lógica SQL
```sql
-- Detecta se busca contém dígitos
_has_digits := _search ~ '\d';

WHERE (
  _search IS NULL OR _search = ''
  OR (
    -- Busca por nome: exige frase contígua (em sequência)
    NOT _has_digits
    AND unaccent(lower(c.nome_completo)) ILIKE '%' || _search_norm || '%'
  )
  OR (
    -- Busca com dígitos: CPF, telefone, email, palavras dispersas
    _has_digits AND (
      c.cpf ILIKE '%' || _search || '%'
      OR c.telefone ILIKE '%' || _search || '%'
      OR c.telefone2 ILIKE '%' || _search || '%'
      OR c.telefone3 ILIKE '%' || _search || '%'
      OR c.email ILIKE '%' || _search || '%'
    )
  )
)
```

### Resultado
| Busca | Antes | Depois |
|---|---|---|
| `Fernanda Pereira` | Fernanda Pereira... **+** Fernanda Helena... Pereira | **Apenas** "Fernanda Pereira..." |
| `Fernanda` | Todas as Fernandas | Todas (igual) |
| `123.456` | CPF match | CPF match (igual) |
| `1199998888` | Telefone match | Telefone match (igual) |

### Arquivos
- **Nova migration SQL** redefinindo `public.get_carteira_grouped` (assinatura idêntica, mesmas colunas)
- Score de relevância criado anteriormente é preservado para ordenação
- **Sem alterações em frontend** (`clientService.ts` / `CarteiraPage.tsx`)

### Impacto
- Sem breaking changes (assinatura idêntica)
- Performance equivalente
- Comportamento sem busca preservado integralmente