

## Filtro por Agencia (IdAgency) na MaxList

### O que sera feito

Adicionar um filtro por Agencia na pagina MaxList, carregando a lista de agencias da API MaxSystem e permitindo filtrar os resultados por `IdAgency`.

### Mudancas

**1. Edge Function `supabase/functions/maxsystem-proxy/index.ts`**

- Aceitar um novo query param `action` (default: `installments`)
- Quando `action=agencies`, fazer proxy para `https://maxsystem.azurewebsites.net/api/Agencies?%24inlinecount=allpages` e retornar a lista de agencias
- No fluxo normal de installments, aceitar um param `agencyId` e adicionar `IdAgency+eq+{agencyId}` ao filtro OData

**2. Frontend `src/pages/MaxListPage.tsx`**

- Adicionar state `agencia` ao objeto `filters` (valor padrao: `"todas"`)
- Carregar lista de agencias via `useQuery` chamando o proxy com `action=agencies`
- Adicionar um `Select` de "Agencia" na area de filtros (ao lado de CPF/Contrato/Status)
- Na funcao `buildFilter`, quando `filters.agencia` nao for `"todas"`, adicionar `IdAgency+eq+{valor}` ao filtro OData
- Na funcao `handleSearch`, passar o `agencyId` como query param para o proxy

### Detalhes tecnicos

**Edge Function - novo fluxo de agencias:**

```text
const action = url.searchParams.get("action") || "installments";

if (action === "agencies") {
  const agenciesUrl = "https://maxsystem.azurewebsites.net/api/Agencies?%24inlinecount=allpages";
  const resp = await fetch(agenciesUrl);
  const data = await resp.json();
  return new Response(JSON.stringify({ Items: data.Items }), { headers: ... });
}

// Fluxo existente de installments continua igual
// mas o filter agora pode incluir IdAgency
```

**Frontend - filtro OData:**

Na funcao `buildFilter`, adicionar:
```text
if (filters.agencia && filters.agencia !== "todas") {
  parts.push(`IdAgency+eq+${filters.agencia}`);
}
```

**Frontend - Select de agencia:**

Novo `Select` na grid de filtros com opcoes carregadas dinamicamente:
- "Todas as agencias" (valor: `"todas"`)
- Lista de agencias retornadas pela API (valor: `Id`, label: `Name`)

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/maxsystem-proxy/index.ts` | Suporte a `action=agencies` e param `agencyId` |
| `src/pages/MaxListPage.tsx` | Filtro Select de agencia com dados da API |

