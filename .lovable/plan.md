

## Diagnóstico: "tela não está abrindo"

Verifiquei e **não há erros de runtime nem de console** registrados. O servidor Vite está rodando normal. O usuário está em `/auth` (tela de login).

Como o sintoma "tela não abre" é vago, pode ser:

1. **Tela de login não renderiza** (branco/loading infinito) — improvável, pois console está limpo.
2. **Após login, alguma tela específica não abre** (ex.: ficha do cliente onde adicionei o `CallButton`).
3. **Modal de conexão da 3CPlus não abre** ao clicar no novo ícone.
4. **Página de telefonia trava** após o redirect do `pendingCall`.
5. **Cache do browser** com versão antiga + erro de import quebrando algum componente.

### Possíveis causas técnicas (do código novo)

- O `CallButton` usa `useAtendimentoModalSafe` — o hook está implementado e tem fallback seguro fora do Provider, então não deve quebrar.
- O `PhoneList.tsx` importa `CallButton` — se o componente jogar exception no render, derruba a ficha do cliente inteira.
- O dispatcher em `useAtendimentoModal.tsx` (linhas 80-105) roda em todo mount do app autenticado — se `getPendingCall()` retornar lixo no sessionStorage, pode disparar discagem inesperada (mas não derrubaria tela).

### Plano de ação (após você responder)

**Passo 1**: você me diz **qual tela exatamente não abre** (a de login? alguma ficha de cliente? Telefonia?) e o que aparece (branco? loading infinito? erro? trava ao clicar no ícone?).

**Passo 2**: com essa info, executo:
- Browser automation para reproduzir (após você fazer login no preview).
- Inspeção dos componentes específicos da tela travada.
- Verificação de `sessionStorage` em busca de `pendingCall` órfão que possa estar disparando algo.

**Passo 3**: se for o `CallButton`/`PhoneList` quebrando, faço **rollback cirúrgico** dos imports nos arquivos integrados (`ClientHeader.tsx`, `PhoneList.tsx`) — mantenho `callService.ts`, `CallButton.tsx` e o dispatcher do `useAtendimentoModal.tsx` no codebase, mas removo os usos para destravar a tela. Depois investigamos a causa raiz com calma.

**Passo 4**: se for outra coisa (cache, sessão Supabase, etc.), oriento limpeza específica.

### Pergunta direta

Para eu agir certeiro, me responda:

1. **Qual tela** não abre? (`/auth`, `/carteira/:id`, `/atendimento/:id`, `/contact-center/telefonia`, ou outra?)
2. **O que aparece** quando tenta abrir? (tela branca / loading infinito / erro visível / trava ao clicar em algo específico?)
3. **Quando começou**? (logo após o último deploy do `CallButton`, ou já estava acontecendo antes?)

Com essa resposta, em 1 turno eu identifico e proponho o fix exato (ou o rollback cirúrgico se for regressão da feature nova).

