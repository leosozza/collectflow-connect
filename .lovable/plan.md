

## Reorganizar o Painel de Configuracoes

### Objetivo

Transformar a lista plana de itens na sub-navegacao lateral em grupos visuais claros com separadores, busca rapida, badges informativos e animacao suave no item ativo.

---

### Estrutura de Grupos

A navegacao lateral sera organizada em 3 categorias:

```text
Configuracoes
------------------------------
[Campo de busca rapida]

CADASTROS
  Credores          [3]
  Equipes           [2]
  Perfil do Devedor
  Tipo de Divida
  Tipo de Status

PESSOAS
  Usuarios          [5]

SISTEMA
  Integracao
  Config. Empresa   (se tenant_admin)
  Super Admin       (se super_admin)
  Roadmap           (se tenant_admin)
```

---

### Mudancas Detalhadas

#### 1. Agrupar secoes por categoria

As secoes serao organizadas em um array de grupos:

| Grupo | Itens |
|---|---|
| Cadastros | Credores, Equipes, Perfil do Devedor, Tipo de Divida, Tipo de Status |
| Pessoas | Usuarios |
| Sistema | Integracao, Config. Empresa*, Super Admin*, Roadmap* |

(*) Itens condicionais baseados em permissao.

#### 2. Separadores visuais entre grupos

Cada grupo tera um label em texto pequeno e uppercase (estilo "overline") seguido dos itens. Um `Separator` do shadcn sera usado entre grupos.

#### 3. Animacao suave no item ativo

Substituir a mudanca abrupta de cor por uma transicao com `transition-all duration-200` e um indicador lateral (borda esquerda colorida de 3px) no item ativo, alem do background.

#### 4. Badges com contadores

Adicionar queries para contar:
- **Credores**: total de credores ativos
- **Equipes**: total de equipes
- **Usuarios**: total de usuarios do tenant

Os badges serao exibidos como `Badge variant="secondary"` ao lado do label, usando dados ja carregados pelos hooks existentes (`useQuery` com `fetchCredores`, `fetchEquipes`). Uma nova query simples contara profiles do tenant.

#### 5. Busca rapida

Um campo `Input` com icone de lupa no topo da navegacao que filtra os itens visiveis pelo label. Itens que nao correspondem ao filtro ficam ocultos, mas os grupos vazios tambem sao ocultados.

---

### Arquivo Modificado

| Arquivo | Acao |
|---|---|
| `src/pages/CadastrosPage.tsx` | Refatorar para usar grupos, separadores, busca, badges e animacao |

Nenhum arquivo novo sera criado. As queries de contagem usarao os services existentes (`cadastrosService`). Para contar usuarios, sera feita uma query direta ao `profiles` filtrado por `tenant_id`.

---

### Visual do Item Ativo (antes/depois)

**Antes**: Background solido primary, texto branco, sem transicao.

**Depois**: Background `primary/10`, texto `primary`, borda esquerda de 3px na cor primary, `transition-all duration-200` para entrada suave. Hover com `bg-muted` e `text-foreground`.

