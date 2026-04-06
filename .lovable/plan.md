

# Plano: Ajustar inconsistências restantes da Carteira

## Análise do estado atual

Após revisar o código e a função SQL `get_carteira_grouped`, confirmei que:
- **Items 1 e 2 já estão corrigidos** no banco: `GROUP BY f.cpf, f.credor` e `AND a.credor = g.credor` no filtro sem acordo já estão implementados na migração anterior.
- **Items 3 e 4 ainda precisam de correção** no frontend.

## Correções necessárias

### 1. Navegação do detalhe — adicionar credor como query param

**Problema**: A navegação usa `/carteira/{cpf}`, que é ambígua quando o mesmo CPF existe em credores diferentes. O `ClientDetailPage` carrega todos os títulos do CPF sem distinção de credor.

**Solução**: Passar o credor como query parameter na navegação e filtrar os títulos no detalhe.

**Arquivos alterados**:

- `src/pages/CarteiraPage.tsx` (linha 755): Mudar navegação para incluir credor:
  ```tsx
  navigateWithOrigin(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}?credor=${encodeURIComponent(client.credor)}`)
  ```

- `src/components/carteira/CarteiraKanban.tsx` (linha 139): Mesma alteração.

- `src/pages/ClientDetailPage.tsx` (linhas 76-89): Ler `credor` do search params e filtrar a query quando presente:
  ```tsx
  const [searchParams] = useSearchParams();
  const credorFilter = searchParams.get("credor");
  ```
  Na query de clients, adicionar `.eq("credor", credorFilter)` quando `credorFilter` existe.
  Na query de agreements, adicionar `.eq("credor", credorFilter)` quando `credorFilter` existe.

Quando o `credor` não está no URL (navegações externas como Dashboard, Acordos), o comportamento atual é mantido — mostra todos os títulos do CPF.

### 2. Remover ordenação por status_cobranca do frontend

**Problema**: O header "Status Cobrança" tem `toggleSort("status_cobranca")` mas o SQL não implementa esse caso no ORDER BY, resultando em ordenação ignorada silenciosamente.

**Solução**: Remover o botão de ordenação do header "Status Cobrança", mantendo apenas o texto estático.

**Arquivo**: `src/pages/CarteiraPage.tsx` (linhas 733-736)

Substituir:
```tsx
<button className="flex items-center gap-0.5 ..." onClick={() => toggleSort("status_cobranca")}>
  Status Cobrança <SortIcon field="status_cobranca" />
</button>
```
Por:
```tsx
Status Cobrança
```

## Resumo

| Arquivo | Alteração |
|---|---|
| `src/pages/CarteiraPage.tsx` | Navegação com credor + remover sort de status_cobranca |
| `src/components/carteira/CarteiraKanban.tsx` | Navegação com credor |
| `src/pages/ClientDetailPage.tsx` | Filtrar por credor quando presente no URL |

Nenhuma alteração no SQL — as correções de agrupamento e filtro sem acordo já estão aplicadas.

