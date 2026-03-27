

# Plano: Correções Críticas de Produção — 5 Problemas

## 1. Segunda tela de tabulação duplicada

**Causa raiz**: Na linha 1071, o dashboard mostra a tela de ACW quando `effectiveACW && !modalIsOpen`. Porém, quando o operador fecha a ficha (modal) após tabular, `modalIsOpen` volta a `false` e o `effectiveACW` ainda é `true` porque o `sessionStorage.3cp_qualified_from_disposition` é limpo no mesmo ciclo de transição de status. Há uma race condition entre o polling (10s) que detecta o novo status e a limpeza dos flags.

**Correção** (`TelefoniaDashboard.tsx`):
- Ao detectar que `qualifiedFromDisposition` é `true`, forçar imediatamente um `unpause_agent`/`qualify_call` para sair do TPA e NÃO mostrar a tela de ACW
- Adicionar um guard: se o modal acabou de fechar (via `useRef` que rastreia `modalIsOpen` anterior), suprimir a tela de ACW por 5 segundos para dar tempo ao polling capturar a transição para status 1
- Mover a limpeza de `3cp_qualified_from_disposition` para DEPOIS da confirmação de que o status voltou a 1 (idle)

## 2. Filtro "Aguardando Acionamento" mostrando clientes Em Dia/Quitados

**Causa raiz** (`CarteiraPage.tsx` linhas 300-323): A derivação de status roda ANTES do filtro `statusCobrancaId` (linha 380-383). Porém, a derivação tem condições fracas — só substitui o status se `currentName === "Em dia"` ou `"Aguardando acionamento"`. Clientes com `status_cobranca_id` manualmente definido para outro status (ou `null`) não são derivados corretamente, passando pelo filtro.

**Correção** (`CarteiraPage.tsx`):
- Na derivação, para `st === "pago"` forçar SEMPRE `quitadoId` (sem condição)
- Para clientes com status `pendente` e vencimento passado, forçar `aguardandoId` mesmo quando o `currentName` é outro valor (remover a condição que só substitui se for "Em dia")
- Isso garante que a derivação é determinística e o filtro por `statusCobrancaId` funciona corretamente

## 3. Calculadora abre atrás da ficha do cliente (z-index)

**Causa raiz** (`useAtendimentoModal.tsx` linha 225): O modal do atendimento usa `z-[9999]` e o backdrop usa `z-[9998]`. A calculadora de acordos (`AgreementCalculator`) usa um `Dialog` do Radix que renderiza com `z-50` por padrão — muito abaixo de 9999.

**Correção** (`useAtendimentoModal.tsx`):
- Reduzir o z-index do modal de `z-[9999]` para `z-[40]` e do backdrop de `z-[9998]` para `z-[39]`
- Isso permite que `Dialog`, `Popover` e `AlertDialog` do Radix (que usam portais com `z-50`) apareçam naturalmente acima do modal

## 4. Demora para abrir a ficha quando o cliente atende

**Causa raiz** (`TelefoniaDashboard.tsx` linha 232): O polling é de 10 segundos para operadores. Além disso, `TelefoniaAtendimentoWrapper` faz queries separadas e sequenciais (CPF e telefone) ao invés de paralelas.

**Correção**:
- `TelefoniaDashboard.tsx`: Reduzir o `interval` padrão de operador de `10` para `3` segundos
- `TelefoniaAtendimentoWrapper`: Executar as buscas por `clientDbId`, `CPF` e `telefone` em paralelo usando queries habilitadas simultaneamente (já estão em paralelo via React Query, mas o `enabled` do CPF exclui quando `clientDbId` existe — remover essa restrição para buscar ambos em paralelo)

## 5. Demora para voltar ao "Aguardando Ligação" após tabular/desligar

**Causa raiz**: Após tabular, o sistema espera o próximo ciclo de polling (até 10s, agora 3s) para detectar a transição de status para 1 (idle). Não há atualização otimista.

**Correção** (`TelefoniaDashboard.tsx`):
- Após `qualify_call` ou `unpause_agent` bem-sucedido, chamar `fetchAll()` imediatamente (já faz) MAS também forçar `setIsACW(false)` e resetar o status local do agente para 1 otimisticamente
- Adicionar `await fetchAll()` (com await) após qualquer ação de tabulação/unpause para garantir refresh imediato
- No `handleQualifyCall` e no `finishFn`: após sucesso, forçar refresh imediato via `fetchAll()` + timeout de 1s para segundo refresh (captura eventual delay da API 3CPlus)

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | z-index de 9999→40 e 9998→39 |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Polling 10s→3s, guard anti-duplicação ACW, refresh otimista, busca paralela |
| `src/pages/CarteiraPage.tsx` | Derivação de status determinística (sem condições fracas) |

