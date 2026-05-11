## Objetivo

Tornar o conceito de "parcela" mais claro nos textos da página **Carteira**, sem alterar o nome do módulo no menu, sem mexer em queries, RLS, banco ou integrações. Mudança 100% de UI/copy.

## Diagnóstico

- Não existe item "Clientes" no menu lateral. O módulo é **Carteira** (`/carteira`).
- A tabela `clients` no banco guarda **parcelas** (cada linha = uma parcela/dívida), mas a Carteira exibe agrupado por CPF.
- Os contadores "X clientes" da Carteira já estão semanticamente corretos (cada CPF = 1 cliente).
- O que confunde é o **texto de subtítulo** e alguns **labels de botões/diálogos** que misturam "cliente" com "parcela".

## Escopo das alterações (somente texto)

**Arquivo: `src/pages/CarteiraPage.tsx`**

1. Subtítulo da página (linha ~690):
   - De: `Gerencie as parcelas, pagamentos e clientes`
   - Para: `Gerencie suas carteiras de cobrança — cada linha agrupa as parcelas de um CPF`

2. Botão "Novo Cliente" (linha ~743) e título do diálogo (linha ~1075):
   - De: `Novo Cliente` / `Editar Cliente`
   - Para: `Nova Parcela` / `Editar Parcela`
   - (Faz sentido porque o formulário cria 1 registro na tabela `clients` = 1 parcela)

3. Toast de criação/edição (linhas ~367, ~378, ~370, ~382):
   - "Cliente cadastrado!" → "Parcela cadastrada!"
   - "Cliente atualizado!" → "Parcela atualizada!"
   - "Erro ao cadastrar cliente" → "Erro ao cadastrar parcela"
   - "Erro ao atualizar cliente" → "Erro ao atualizar parcela"

4. **Manter como está** (são contagens de CPFs únicos, conceitualmente corretas):
   - `{totalCount} clientes` nos banners de seleção
   - `cliente(s) selecionado(s)`
   - `Nenhum cliente encontrado`
   - `Utilize os filtros para buscar clientes`
   - "Clientes importados com sucesso!" (importação carrega múltiplos CPFs)

**Arquivo: `src/components/carteira/CarteiraTable.tsx`**

5. Manter `{grouped.length} clientes` e `Nenhum cliente encontrado` (refere-se a CPFs agrupados — correto).

## O que NÃO será alterado

- Banco de dados (`clients`, `client_profiles`) — zero migration.
- Edge functions, RLS, RPCs, serviços (`clientService.ts`, `clientProfileService.ts`).
- Rotas (`/carteira` permanece) e item de menu ("Carteira" permanece).
- API pública `/clients-api` e documentação técnica.
- `ClientsPage.tsx` (já é código morto, não está roteado).
- Comentários internos do código.

## Risco

Zero risco funcional — apenas strings de UI. Nenhuma query, prop ou ID muda.

## Verificação após implementação

- Abrir `/carteira` e conferir: subtítulo novo, botão "Nova Parcela", diálogo "Nova Parcela / Editar Parcela", toasts.
- Conferir que a contagem "X clientes" no rodapé e nos banners de seleção continua igual (proposital).
