## Objetivo

Remover a duplicidade na aba **Acordos**: hoje os chips "Aguardando Liberação" e "Confirmação de Pagamento" aparecem tanto dentro de `/acordos` quanto como rotas próprias no sidebar (`/financeiro/aguardando-liberacao` e `/financeiro/confirmacao-pagamento`). As rotas dedicadas já existem e funcionam — basta remover os chips da `AcordosPage` para que essas duas visões sejam acessíveis **somente** pelo Financeiro no sidebar.

## Escopo (mínimo, focado)

### 1. `src/pages/AcordosPage.tsx`

- Remover os dois chips de status do `statusFilterConfig`:
  - `pending_approval` ("Aguardando Liberação")
  - `payment_confirmation` ("Confirmação de Pagamento")
- Resultado dos chips visíveis: **Pagos | Vigentes | Vencidos | Cancelados** (4 chips, sem mudar layout/estilo).
- **Manter** toda a lógica interna intacta (`StatusFilter` type, switch case `pending_approval`/`payment_confirmation`, render condicional `statusFilter === "payment_confirmation"`, etc.) — assim as rotas dedicadas continuam reaproveitando essa lógica via `?status=...`.
- Manter o filtro chip-bar visível normalmente em `/acordos`. Nas rotas `/financeiro/aguardando-liberacao` e `/financeiro/confirmacao-pagamento`, o status já vem forçado por query param (definido pelos wrappers) — como o chip não existe mais na barra, ele simplesmente não aparece selecionado. Isso é o comportamento desejado.
- Se o usuário acessar `/acordos?status=vigentes` (default), nada muda.
- Se cair em `/acordos` com status default e antes fosse `pending_approval`/`payment_confirmation` por bookmark antigo: a página continua funcionando porque o type e a lógica permanecem; apenas não há chip para alternar de volta — o que é correto, pois agora isso é responsabilidade do menu Financeiro.

### 2. Nada mais muda

- `AguardandoLiberacaoPage.tsx` e `ConfirmacaoPagamentoPage.tsx` permanecem como estão (forçam `?status=...` e renderizam `AcordosPage`).
- Sidebar, rotas em `App.tsx`, RPCs, permissões: **sem alteração**.
- Demais correções pedidas anteriormente (breakdown de juros/multa/honorários, filtros clean em Baixas Realizadas, filtro multi-mês, helper `shortCredor`) **não fazem parte deste plano** — serão tratadas em uma rodada separada conforme você indicar prioridade.

## Detalhes técnicos

Edição única em `src/pages/AcordosPage.tsx` linhas 36–43: filtrar `statusFilterConfig` para conter só `approved`, `vigentes`, `overdue`, `cancelled`. O `.filter(({ key }) => key !== "payment_confirmation" || isAdmin)` no render (linha 328) deixa de ter efeito prático e pode ser removido para manter o código limpo.

## Validação

1. Acessar `/acordos` → ver apenas 4 chips (Pagos, Vigentes, Vencidos, Cancelados).
2. Acessar `/financeiro/aguardando-liberacao` → continua exibindo a lista de acordos pending_approval, sem chips de Aguardando/Confirmação visíveis na barra.
3. Acessar `/financeiro/confirmacao-pagamento` → continua exibindo o painel de confirmação de pagamento.
4. Filtros de credor, busca, mês/ano: sem alteração.