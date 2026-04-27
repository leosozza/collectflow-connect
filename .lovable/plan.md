## Objetivo

Adicionar um botão **"Testar conexão"** ao lado dos badges de status (Tempo real / Conectado) no header do `TelefoniaDashboard`, permitindo que o usuário valide rapidamente:

1. A conexão **REST** (`threecplus-proxy` → `list_agents`)
2. A conexão **Socket.IO** em tempo real (status do `useThreeCPlusSocket`)

## Onde aparece

No header do Dashboard de Telefonia (`/contact-center/telefonia`), na mesma linha do título "Dashboard" e dos badges:

```text
[Dashboard]  [Tempo real conectado 10:59]  [Conectado 10:59]   [↻ Testar conexão]
```

Botão discreto (`variant="outline"`, `size="sm"`) com ícone `Activity`/`Zap`, alinhado à direita junto ao Popover de auto-refresh existente.

## Comportamento

Ao clicar:

1. Mostra estado de loading (`Loader2` girando, botão desabilitado).
2. Executa em paralelo:
   - **REST**: `supabase.functions.invoke("threecplus-proxy", { body: { action: "list_agents" } })` — valida credenciais do tenant.
   - **Socket**: lê o `socketStatus` atual do contexto (`atendimentoCtx.socketStatus`). Se estiver `error`/`disconnected`, dispara `socketReconnect()` e aguarda até ~5s para reconectar.
3. Apresenta o resultado em um **Dialog** com 2 linhas:
   - ✅/❌ **REST 3CPLUS** — mensagem da resposta (ou erro)
   - ✅/⚠️/❌ **Tempo real (Socket.IO)** — status final + timestamp do último evento, se houver
4. Toast resumo (`sonner`): sucesso geral, parcial ou falha.

Sem alterações em backend — reutiliza:
- Edge Function existente `threecplus-proxy` (action `list_agents`)
- Hook existente `useThreeCPlusSocket` via `AtendimentoModalProvider`

## Arquivos

**Novo**
- `src/components/contact-center/threecplus/TestConnectionButton.tsx` — botão + dialog de resultado, recebe via props o `socketStatus`, `socketReconnect`, `socketLastEventAt`.

**Editado**
- `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — montar `<TestConnectionButton />` no header (linha ~1494), passando os campos do `atendimentoCtx`.

## Fora do escopo

- Não modifica o `RealtimeStatusBadge` existente (seu botão "Reconectar socket" no popover continua valendo).
- Não cria novas tabelas, secrets ou edge functions.
- Não altera o polling REST.
