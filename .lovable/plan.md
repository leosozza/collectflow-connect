## Objetivo

Adicionar um pequeno botão de "Atualizar" ao lado do sininho na topbar. Ele detecta automaticamente quando uma nova versão do sistema foi publicada e começa a piscar para o usuário. Ao clicar, força um hard reload (equivalente a Ctrl+Shift+R), limpando caches e recarregando.

## Como funciona

1. **Detecção de nova versão**
   - A cada 60 segundos (e também ao focar a aba), busca `/index.html` com `cache: no-store`.
   - Extrai as referências aos arquivos `/assets/...` (que têm hash de build do Vite — mudam a cada publicação).
   - Calcula um hash leve (FNV-1a) dessa assinatura e compara com a versão salva em `localStorage`.
   - Se mudou → ativa o estado "update disponível".

2. **Visual** (pequeno e discreto)
   - Ícone `RefreshCw` (lucide), tamanho `h-4 w-4` dentro de um botão `h-8 w-8`.
   - Estado normal: cinza translúcido (`text-muted-foreground/60`), sem destaque.
   - Estado "update disponível": cor `primary`, com `animate-pulse` no botão e um pontinho colorido no canto superior direito também pulsando.
   - Tooltip com texto explicativo.

3. **Hard reload ao clicar**
   - Limpa `caches` (Cache API).
   - Desregistra service workers, se houver.
   - Atualiza o hash baseline no `localStorage` para a nova versão.
   - Adiciona um cache-buster (`?_v=timestamp`) e chama `window.location.replace(...)` — isso força bypass de cache do navegador/CDN, equivalente a Ctrl+Shift+R.

## Arquivos

- **Criar** `src/components/system/UpdateButton.tsx` — componente novo, autossuficiente.
- **Editar** `src/components/AppLayout.tsx` — importar e renderizar `<UpdateButton />` logo antes de `<NotificationBell />` (linha ~310).

Sem mudanças de banco, sem novos pacotes (usa Tooltip do shadcn já existente).

**Posso aplicar?**