## Plano: melhorar detecção e visibilidade de novas versões

Aplicar as opções 1 e 3 no componente `src/components/system/UpdateButton.tsx`.

### 1. Forçar re-baseline para usuários existentes
O problema atual: usuários que já abriram o app antes desta mudança têm um `localStorage["rivo-app-version-hash"]` antigo. Como a lógica atual só detecta update se houver mudança em relação ao baseline armazenado, e como hoje o baseline já bate com o que está no servidor, eles nunca verão piscar até o PRÓXIMO deploy.

Solução: trocar a chave de storage de `rivo-app-version-hash` para `rivo-app-version-hash-v2`. Isso reseta o baseline de todos os navegadores na próxima visita, deixando o sistema pronto para detectar a próxima publicação corretamente. (A primeira visita após a mudança grava o hash atual; a partir daí qualquer novo deploy aciona o "piscar".)

### 2. Toast "Nova versão disponível"
Disparar um toast (sonner) na primeira vez que `hasUpdate` virar `true` em cada sessão:
- Mensagem: "Nova versão disponível"
- Descrição: "Clique para atualizar agora"
- Action button "Atualizar" no toast que chama o mesmo `handleClick` (limpa caches + hard reload)
- Duração longa (ex.: `Infinity` até o usuário fechar) para não passar despercebido
- Usar uma `useRef` para garantir que o toast só apareça uma vez por sessão (não a cada poll de 60s)

### Arquivos alterados
- `src/components/system/UpdateButton.tsx` — trocar `STORAGE_KEY`, adicionar `import { toast } from "sonner"`, disparar toast no `useEffect` quando `hasUpdate` passar de `false` → `true`.

Nenhuma outra parte do app é afetada. Sem mudanças de banco, edge functions ou rotas.