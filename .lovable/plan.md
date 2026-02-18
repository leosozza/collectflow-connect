

## Ajustes no Perfil do Operador

### 1. Dashboard do Operador - Funcionalidades completas

**Arquivo: `src/pages/DashboardPage.tsx`**

Reformular completamente o dashboard do operador para ter as mesmas funcionalidades visuais do Admin (`AdminDashboardPage`), mas filtrado automaticamente pelo `operator_id` do proprio operador:

- Hero card com "Total Projetado no Mes" (estilo gradient-orange igual ao admin)
- Strip de Vencimentos com navegacao por data (ja existe)
- 3 StatCards: Recebido, Quebra, Pendentes (ja existe)
- Tabela "Meus Clientes" com o nome do cliente como **link clicavel** que navega para `/carteira/:cpf` (pagina de detalhe do devedor)
- Filtros de Ano e Mes (ja existem)
- Adicionar botoes "Analytics" e "Relatorios" no header (igual ao admin)

A query de clientes continuara filtrando apenas pelo `operator_id` do operador logado.

O nome do cliente na tabela sera renderizado como `<Link>` ou `<button>` com estilo de link (text-primary, underline on hover) que navega para `/carteira/${client.cpf}`.

### 2. Analytics completo para Operador

**Arquivo: `src/pages/AnalyticsPage.tsx`**

Remover a restricao `if (profile?.role !== "admin")` que bloqueia acesso. Em vez disso, quando o usuario for operador:
- Filtrar automaticamente `allClients` pelo `operator_id` do operador logado (via `profile.id`)
- Ocultar o filtro de "Operador" (nao faz sentido para o operador ver outros)
- Manter todos os graficos e KPIs funcionando normalmente com dados filtrados
- Ocultar o filtro de operador do multi-select

### 3. Carteira - Operador pode ver e editar todos os clientes

**Arquivo: `src/pages/CarteiraPage.tsx`**

Atualmente o operador so ve clientes vinculados ao seu `operator_id` (linha 90-93). Alterar para:
- Operador ve **todos** os clientes (remover filtro de `operatorId` para operadores)
- Operador pode editar campos: telefone, email, endereco, cidade, UF, CEP, observacoes e dados relacionados a negociacao/acordo
- Manter restricoes: operador NAO pode criar, deletar ou importar clientes (isso continua sendo admin)

Na pratica, remover o bloco `filtersWithOperator` que adiciona `operatorId` para nao-admins. O operador passara a ver toda a carteira.

### 4. Contact Center - Liberar Telefonia para Operador

**Arquivo: `src/components/AppLayout.tsx`**

No array `contactCenterItems` (linha 56-59), a aba "Telefonia" esta condicionada a `isAdmin`. Alterar para mostrar para todos os usuarios:

```
const contactCenterItems = [
  { label: "Telefonia", icon: Phone, path: "/contact-center/telefonia" },
  { label: "WhatsApp", icon: MessageCircle, path: "/contact-center/whatsapp" },
];
```

**Arquivo: `src/pages/ContactCenterPage.tsx`**

Remover a restricao `if (channel === "telefonia" && profile?.role !== "admin")` que bloqueia operadores de acessar a aba de Telefonia.

### 5. Remover aba "Acordos" do menu do Operador

**Arquivo: `src/components/AppLayout.tsx`**

O array `postContactItems` (linha 52-54) mostra "Acordos" apenas para operadores. Remover completamente este array ou deixa-lo vazio:

```
const postContactItems: typeof preContactItems = [];
```

### 6. Nome clicavel no Dashboard

**Arquivo: `src/pages/DashboardPage.tsx`**

Na tabela de "Meus Clientes", alterar a celula do nome do cliente para ser um link navegavel:

```tsx
<TableCell className="text-xs font-medium">
  <button
    onClick={() => navigate(`/carteira/${client.cpf}`)}
    className="text-primary hover:underline cursor-pointer"
  >
    {client.nome_completo}
  </button>
</TableCell>
```

Adicionar `useNavigate` do react-router-dom ao componente.

---

### Detalhes Tecnicos

**Arquivos a modificar:**
- `src/pages/DashboardPage.tsx` - adicionar link no nome, botoes Analytics/Relatorios, hero card gradient
- `src/pages/AnalyticsPage.tsx` - remover restricao de admin, filtrar por operador automaticamente
- `src/pages/CarteiraPage.tsx` - remover filtro de operator_id para operadores (ver todos)
- `src/components/AppLayout.tsx` - liberar Telefonia para todos, remover aba Acordos
- `src/pages/ContactCenterPage.tsx` - remover restricao de admin para telefonia

**Nenhuma migracao SQL necessaria.**
**Nenhuma nova dependencia necessaria.**

