# Correções: Financeiro + Breakdown de Parcelas + UX

## 1. Remover duplicidade nas abas de Acordos

**Problema:** as rotas `/financeiro/aguardando-liberacao` e `/financeiro/confirmacao-pagamento` foram criadas, mas as abas continuam aparecendo dentro de `/acordos`, gerando duplicidade.

**Correção:**
- Remover os chips `Aguardando Liberação` e `Confirmação de Pagamento` da barra de filtros de status em `src/pages/AcordosPage.tsx` (`statusFilterConfig`).
- Manter apenas: Pagos, Vigentes, Vencidos, Cancelados.
- Se o usuário entrar em `/acordos?status=pending_approval` ou `?status=payment_confirmation` (link antigo), redirecionar para a rota correspondente em `/financeiro/...`.
- Os wrappers `AguardandoLiberacaoPage` e `ConfirmacaoPagamentoPage` continuam usando a `AcordosPage`, mas passando uma prop `lockedStatus` que:
  - força o filtro internamente,
  - **esconde a barra de chips de status** completamente,
  - ajusta o título da página ("Aguardando Liberação" / "Confirmação de Pagamento").

## 2. Breakdown de juros, multa, honorários e desconto por parcela

**Estado atual:** a tabela `agreements` só armazena `original_total`, `proposed_total`, `discount_percent`, `entrada_value`, `new_installment_value` e `custom_installment_values` (jsonb com valor por parcela). Não existem campos de juros/multa/honorários/desconto separados nem na parcela nem no acordo. A tabela `manual_payments` também não persiste esse breakdown.

**Migration (segura, aditiva — nada é apagado):**

Adicionar à tabela `agreements`:
- `interest_amount numeric default 0` — juros total do acordo
- `penalty_amount numeric default 0` — multa total do acordo
- `fees_amount numeric default 0` — honorários total do acordo
- `discount_amount numeric default 0` — desconto total em R$ (complementa o `discount_percent` existente)
- `installment_breakdown jsonb default '{}'::jsonb` — breakdown por parcela no formato:
  ```json
  { "1": { "principal": 100, "juros": 5, "multa": 2, "honorarios": 3, "desconto": 0 }, "2": {...} }
  ```

Adicionar à tabela `manual_payments`:
- `interest_amount numeric default 0`
- `penalty_amount numeric default 0`
- `fees_amount numeric default 0`
- `discount_amount numeric default 0`

**Frontend:**
- Em `AgreementForm.tsx`, adicionar 4 inputs (Juros, Multa, Honorários, Desconto R$) na seção de valores.
- Ao calcular as parcelas, distribuir proporcionalmente os valores entre as parcelas e gravar em `installment_breakdown`. Se o usuário usar "valores customizados por parcela", permitir editar o breakdown individualmente (modo avançado, opcional num primeiro momento — por padrão distribuição linear).
- Em `ManualPaymentDialog.tsx`, expor 4 campos opcionais para informar quanto do pagamento é juros/multa/honorários/desconto.
- A RPC `get_baixas_realizadas` passa a ler esses campos diretamente (não mais 0 fixo para `manual_payments`), e para `portal_payments` continua tentando extrair de `payment_data` jsonb.

## 3. Filtros mais clean em Baixas Realizadas + filtro multi-mês

**Refatoração de `BaixasRealizadasPage.tsx`:**
- Substituir o card grande de filtros por uma barra horizontal compacta (mesmo padrão de `/acordos`: `flex flex-wrap gap-3 items-center`, sem `Card` envolvendo).
- Substituir os 2 popovers separados (De / Até) por **um único filtro de Mês multi-select** (combobox/popover com checkbox por mês do ano corrente + anos anteriores), seguindo o mesmo visual dos selects do sistema. Default: mês corrente selecionado.
- Manter, mais enxutos: Busca (nome/CPF), Credor, Local, Meio de pagamento. Tudo na mesma linha.
- Ajustar a query: derivar `_date_from`/`_date_to` a partir do menor/maior mês selecionado e filtrar lado-cliente os meses intermediários não selecionados (cobre seleção descontínua tipo "Janeiro + Março").
- Manter o card de resumo (Total / Quantidade de baixas).

## 4. Padronizar exibição de Credor (2 primeiros nomes) em todo o sistema

**Criar helper** em `src/lib/formatters.ts`:
```ts
export const shortCredor = (nome?: string | null, words = 2) =>
  (nome ?? "").trim().split(/\s+/).slice(0, words).join(" ") || "—";
```

**Aplicar em todas as superfícies onde Credor aparece:**
- `BaixasRealizadasPage` (coluna Credor + filtro select mostra abreviado, mas o `value` continua sendo o nome completo).
- `AcordosPage` / `AgreementsList` (lista, filtro de credor).
- Dashboard (cards e listas de vencimentos / acionados hoje).
- Cards de cliente (`ClientHeader`, `ClientTable`, `ClientFilters`).
- Carteira (tabela e kanban).
- Componentes de portal e relatórios que mostram o credor em listagem.

Tooltip nativo (`title={credorCompleto}`) para mostrar o nome completo no hover. Onde houver coluna "Credor" em tabela, manter `truncate max-w-[180px]` + tooltip.

## Detalhes técnicos

### Arquivos editados
- `src/pages/AcordosPage.tsx` — remover chips duplicados; aceitar prop `lockedStatus?: StatusFilter`; esconder barra de chips e ajustar título quando `lockedStatus` está setado; redirect dos query params antigos.
- `src/pages/financeiro/AguardandoLiberacaoPage.tsx` — passar `lockedStatus="pending_approval"`.
- `src/pages/financeiro/ConfirmacaoPagamentoPage.tsx` — passar `lockedStatus="payment_confirmation"`.
- `src/pages/financeiro/BaixasRealizadasPage.tsx` — refator de filtros + multi-mês.
- `src/components/acordos/AgreementForm.tsx` — inputs de juros/multa/honorários/desconto e geração de `installment_breakdown`.
- `src/components/acordos/ManualPaymentDialog.tsx` — campos opcionais de breakdown.
- `src/services/agreementService.ts` — propagar novos campos.
- `src/services/manualPaymentService.ts` — propagar novos campos.
- `src/lib/formatters.ts` — `shortCredor()`.
- Pontos de exibição de credor: `AgreementsList.tsx`, `ClientTable.tsx`, `ClientHeader.tsx`, `CarteiraTable.tsx`, `CarteiraKanban.tsx`, `KPICards.tsx`/cards de dashboard relevantes, `BaixasRealizadasPage.tsx`.

### Migrations (aditivas, sem perda de dados)
1. `ALTER TABLE agreements ADD COLUMN interest_amount/penalty_amount/fees_amount/discount_amount numeric DEFAULT 0, ADD COLUMN installment_breakdown jsonb DEFAULT '{}'::jsonb;`
2. `ALTER TABLE manual_payments ADD COLUMN interest_amount/penalty_amount/fees_amount/discount_amount numeric DEFAULT 0;`
3. `CREATE OR REPLACE FUNCTION public.get_baixas_realizadas(...)` — atualizar para ler os novos campos de `manual_payments` (em vez de retornar 0). Mantém assinatura.

### Validação pós-implementação
1. `/acordos` mostra apenas 4 chips: Pagos, Vigentes, Vencidos, Cancelados.
2. `/financeiro/aguardando-liberacao` e `/financeiro/confirmacao-pagamento` exibem só a lista filtrada, sem chips.
3. Criar acordo com juros/multa/honorários/desconto → parcelas mostram breakdown; baixa manual permite informar a composição → aparece em Baixas Realizadas.
4. Filtro de meses em Baixas aceita múltipla seleção; default = mês atual.
5. Em todas as listagens, Credor aparece com 2 nomes; hover mostra nome completo.

