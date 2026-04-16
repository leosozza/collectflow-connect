

# Otimizações de Performance e Estabilidade — Análise e Plano

## Análise de cada sugestão

### 1. Virtualização de Tabela no MaxListPage
**Viável e seguro.** A tabela renderiza todas as linhas (até 5000+) dentro de um `ScrollArea` de 500px. Substituir por `@tanstack/react-virtual` mantém o mesmo visual mas renderiza apenas ~20 linhas visíveis. Risco zero de quebrar funcionalidade — checkboxes de seleção e export Excel continuam operando sobre o array `data[]` em memória, não sobre o DOM.

### 2. Carregamento progressivo (Carregar Mais / Paginação)
**Não recomendado.** O loop `while` busca dados de uma API externa (MaxSystem) e o operador precisa do dataset completo para selecionar registros e importar. Quebrar isso em "Carregar Mais" quebraria a seleção global (`toggleAll`) e o export Excel. O progresso já é mostrado com `searchProgress`. A virtualização (item 1) resolve o problema real que é a renderização, não o fetch.

### 3. Try/catch no WhatsApp Sender
**Viável e importante.** Atualmente, se o `fetch` lançar uma exceção de rede (DNS, timeout, conexão recusada), a Edge Function crasha sem retorno controlado. Envolver cada `fetch` em try/catch garante que falhas retornem `{ ok: false, result: { error: "..." } }` ao invés de crashar.

### 4. Consistência visual ("Mostrando 1000 de X")
**Viável.** A mensagem na linha 1114-1118 diz "Mostrando 1000" mas renderiza tudo. Com a virtualização, isso se torna irrelevante — pode ser removido ou ajustado para mostrar o total real. Vamos corrigir para refletir a realidade.

### 5. Otimização de Rerenders (React.memo)
**Baixo impacto, risco moderado.** O `CadastrosPage` já é simples (navegação lateral + conteúdo condicional). O `MaxListPage` tem muitos estados mas o gargalo real é a renderização DOM (resolvida pela virtualização), não rerenders de React. Adicionar `memo` em componentes estáveis como `DatePickerField` é seguro e marginal. Não vale a complexidade de refatorar estados.

---

## Plano de execução (3 alterações)

### Alteração 1 — Virtualização da tabela (`MaxListPage.tsx`)
- Instalar `@tanstack/react-virtual`
- Substituir o `<TableBody>` que mapeia `data.map(...)` por um virtualizer com row height estimada de ~40px
- Manter `<TableHeader>` sticky fora do container virtualizado
- Container virtualizado dentro do `ScrollArea` existente (500px)
- Checkboxes, seleção e export continuam inalterados (operam sobre `data[]`)

### Alteração 2 — Corrigir mensagem de contagem (`MaxListPage.tsx`)
- Remover a mensagem enganosa "Mostrando 1000 de X" (linhas 1114-1118)
- O header do card já mostra `Preview (X registros)` corretamente

### Alteração 3 — Try/catch no WhatsApp Sender (`whatsapp-sender.ts`)
- Envolver cada chamada `fetch` nas 7 funções de envio em try/catch
- No catch, retornar `{ ok: false, result: { error: mensagem }, providerMessageId: null, provider }`
- Log do erro com `console.error` para diagnóstico
- Funções afetadas: `sendWuzapiText`, `sendWuzapiMedia`, `sendEvolutionText`, `sendEvolutionMedia`, `sendGupshupMsg`

### Não incluído no plano
- **Paginação/Carregar Mais**: quebraria seleção global e export. Virtualização resolve o problema real.
- **React.memo em CadastrosPage**: impacto negligenciável, complexidade desnecessária.

## Resultado esperado
- MaxListPage com 5000+ registros roda fluido (apenas ~15 linhas no DOM)
- Mensagem de contagem correta
- Edge Functions de WhatsApp nunca crasham por falha de rede

