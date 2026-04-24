## Problema

O botão de "Atualizar" hoje compara um hash do `index.html`, esperando que mudanças em `/assets/...` denunciem nova versão. Mas o `index.html` publicado pela Lovable não referencia `/assets/` — só `/src/main.tsx?t=...` (timestamp fixo de build) e poucos meta tags. Resultado:

- O regex de assets nunca casa, então cai no hash do HTML inteiro.
- O HTML praticamente não muda entre versões.
- Pior: a Lovable serve o cookie `__dpl=<deployment-id>` que prende o navegador do usuário ao mesmo deployment (sticky). Mesmo após uma nova publicação, o operador continua recebendo o HTML antigo, e o hash nunca diverge.

Por isso o botão **nunca pisca** em produção, mesmo após mais de 1 minuto da publicação.

## Solução

Trocar a estratégia de detecção para usar o **`x-deployment-id`** que a Lovable envia no header de toda resposta HTML (e fazer a requisição forçando bypass do cookie sticky `__dpl`).

### Como funciona

1. A cada 60s (e quando a aba volta ao foco), fazer um `fetch('/?_=timestamp')` com `cache: 'no-store'` e ler o header `x-deployment-id` da resposta. Esse ID muda a cada nova publicação.
2. Salvar o primeiro ID visto em `localStorage` como baseline (chave nova `rivo-deployment-id-v1`).
3. Quando o ID retornado pelo servidor for diferente do baseline, marcar `hasUpdate = true` → botão pisca + toast persistente "Nova versão disponível".
4. Ao clicar "Atualizar": atualizar o baseline para o novo ID, limpar caches/SW e recarregar com cache-buster (lógica atual de `hardReload` mantida).

### Por que isso funciona em todos os navegadores

- O `x-deployment-id` é controlado pelo servidor de hospedagem, não depende do conteúdo do HTML.
- Forçando `?_=timestamp` + `cache: 'no-store'` evitamos cache do navegador e do edge.
- Como Cloudflare/Lovable já enviam o header em toda resposta (verificado em `https://rivoconnect.com/index.html` agora: `x-deployment-id: a2d337dd-...`), todo navegador (Chrome, Firefox, Safari, Edge, mobile) verá a mudança.

### Fallback de segurança

Se em alguma resposta o header `x-deployment-id` não vier (ex.: ambiente de preview/local), mantemos o hash do HTML como segundo critério, para não regredir.

## Arquivos alterados

- `src/components/system/UpdateButton.tsx` — substituir `fetchCurrentHash` por `fetchCurrentDeploymentId` lendo o header; usar nova chave de storage `rivo-deployment-id-v1`; manter toast e `hardReload` como hoje.

## Resultado esperado

Após a próxima publicação, os operadores em qualquer navegador verão, em até 60s, o ícone de atualizar piscando + toast persistente com botão "Atualizar".
