
Objetivo

Confirmar se a correção do flicker foi aplicada e definir o ajuste correto para eliminar qualquer flash ao voltar para a aba.

Verificação do código

- Em `src/hooks/useTenant.tsx`, a alteração pedida já está presente no ponto crítico:
  ```ts
  if (!tenant) setLoading(true);
  ```
- Em `src/App.tsx`, o `RootPage` ainda desmonta a UI inteira quando `tenantLoading` fica `true`.
- Em `src/components/ProtectedRoute.tsx`, também existe spinner de tela cheia baseado em `tenantLoading`.
- Não encontrei listener manual de `window focus` no projeto; o re-fetch acontece pelo fluxo de sessão/auth e faz o `useTenant` rodar de novo.

Conclusão

- A correção exata no hook já foi aplicada.
- Se uma ferramenta externa “não encontrou”, o mais provável é que ela tenha lido um snapshot anterior ou não tenha validado o arquivo atual.
- Se ainda existir flicker em algum cenário, o endurecimento correto é separar claramente “primeiro carregamento” de “refresh silencioso”.

Plano

1. Manter a lógica atual em `useTenant.tsx`:
   - `setLoading(true)` só no primeiro carregamento, quando `tenant` ainda é `null`.

2. Blindar o hook para deixar essa intenção explícita:
   - tratar `loading` como bloqueante apenas no load inicial;
   - continuar atualizando `tenant`, `tenantUser` e `plan` normalmente em background.

3. Revisar o consumo em `App.tsx` e `ProtectedRoute.tsx`:
   - spinner de tela cheia apenas no primeiro carregamento real;
   - nenhum spinner durante refresh silencioso de sessão.

4. Validar o fluxo:
   - abrir a aplicação;
   - trocar de aba e voltar;
   - confirmar que não há desmontagem visual, nem “Carregando...” em tela cheia, mas os dados continuam sendo atualizados.

Detalhes técnicos

- Hook confirmado: `src/hooks/useTenant.tsx`
- Pontos que ainda dependem de `tenantLoading`: `src/App.tsx` e `src/components/ProtectedRoute.tsx`
- Resultado esperado: refresh silencioso ao focar a aba, sem flicker e sem perder atualização de estado.
