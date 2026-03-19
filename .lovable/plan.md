

# Plano: Rotas path-based para Cadastros

## Problema atual
A página `/cadastros` usa query param (`?tab=credores`) para controlar a aba ativa. O usuário quer URLs como `/cadastros/tabulacao_chamada`.

## Mudanças

### 1. `App.tsx` — Alterar rota
Substituir a rota única `/cadastros` por `/cadastros/:tab?` para aceitar o parâmetro de path opcional (default = "credores").

### 2. `CadastrosPage.tsx` — Usar `useParams` + `useNavigate`
- Trocar `useUrlState("tab", "credores")` por `useParams()` para ler o tab ativo do path
- Trocar `setActive(key)` por `navigate(/cadastros/${key})` 
- Renomear key `categorizacao_chamada` → `tabulacao_chamada` para consistência com o novo nome
- Manter todo o restante da lógica inalterado

### 3. `AppLayout.tsx` / Links de navegação
Verificar se links para `/cadastros` continuam funcionando (sim, pois o param é opcional com default).

## Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `src/App.tsx` | Rota `/cadastros` → `/cadastros/:tab?` |
| `src/pages/CadastrosPage.tsx` | `useParams` + `navigate` em vez de `useUrlState`; renomear key |

