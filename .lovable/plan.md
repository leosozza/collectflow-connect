## Diagnóstico

O erro `ReferenceError: formatCredorName is not defined` no print vem de um bundle (`index-DQn1137H.js`) gerado **antes** do último deploy que adicionou os imports corretos.

Verifiquei todos os usos de `formatCredorName` no código atual: as 4 ocorrências (em `ClientDetailPage.tsx`, `CarteiraPage.tsx`, `PaymentConfirmationTab.tsx`, `AgreementsList.tsx`) já têm o `import` correto de `@/lib/formatters`. Não há mais usos órfãos.

Conclusão: o código local está OK. O erro do print é cache antigo do navegador/CDN ou um bundle anterior que ainda estava em produção quando o screenshot foi tirado.

## Plano de ação

1. **Forçar uma nova publicação** (rebuild) para garantir que o bundle em produção contém os imports corrigidos.
2. **Adicionar uma proteção defensiva permanente** em `src/lib/formatters.ts`: expor `formatCredorName` também em `window.__rivoFormatters` em dev/preview NÃO — em vez disso, adicionar um teste de smoke importando todas as funções públicas para que o tree-shaker não derrube nada inesperadamente, e validar visualmente.

Na prática, basta o passo 1 (republicar) — o passo 2 não é necessário pois o código já está correto.

## O que pedir ao usuário

Após o novo deploy, pedir para o usuário:
- Fazer **hard refresh** na aba `/acordos` (Ctrl+Shift+R no Windows/Linux, Cmd+Shift+R no Mac)
- Confirmar que o erro sumiu

Se o erro persistir mesmo com bundle novo + hard refresh, aí sim investigaremos um caminho de código não detectado (provavelmente lazy import ou componente carregado dinamicamente) com `console.log` no `formatters.ts` para confirmar que o módulo está carregando.

## Arquivos afetados

Nenhum arquivo precisa ser editado — apenas republicar o projeto para invalidar o bundle antigo em CDN.
