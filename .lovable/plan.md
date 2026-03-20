# Plano: Corrigir funcionalidades da tela do operador em /contact-center/telefonia

## Problemas identificados

### 1. Botões Retomar/Pausa não funcionam

Os botões da **barra superior** (`TelefoniaDashboard.tsx` linhas 754-791) chamam `handleUnpause` e `handlePause` corretamente. Porém, o botão **Retomar** (linha 757) renderiza o ícone `Play` com classe `animate-spin` quando `unpausing` é true — mas `Play` não é um ícone rotacional. O problema real é que os botões do **widget minimizado** (`useAtendimentoModal.tsx` linhas 222-267) chamam `pauseControls.onPause/onUnpause` que apontam para as mesmas funções no Dashboard. **Preciso verificar se o `invoke` retorna erro silencioso.** Analisando o proxy: `pause_agent` chama `POST /agent/pause` com `work_break_interval_id` — isso está correto. `unpause_agent` chama `POST /agent/unpause` — também correto.

O problema provável é que os botões na barra superior da tela principal (não o widget) chamam `handlePause(pi.id)` e `handleUnpause()`, mas quando o agente está com status 3 (paused), ele renderiza o botão "Retomar" que chama `handleUnpause`. **Isto parece correto no código.** Preciso adicionar logs e melhor tratamento de erro para diagnosticar.

**Ação:** Adicionar `console.log` nos handlers de pausa/retomar e mostrar mensagem de erro detalhada do proxy no toast. Atualmente o catch é genérico (`toast.error("Erro ao pausar")`), engolindo o detalhe.

### 2. SIP Off — o que é?

O botão "SIP Off" tenta reconectar o MicroSIP (softphone) via `handleReconnectSip` → `connect_agent`. Se o operador não usa MicroSIP (usa apenas discador automático), esse botão é confuso e inútil. Como o 3CPlus em modo discador não precisa de SIP manual, a verificação `isSipConnected` (linha 604) nunca retorna true porque a API não retorna `sip_connected`/`extension_status`/`sip_status` no `agents_status`.

**Ação:** Remover o indicador SIP da visão do operador. O SIP é gerenciado automaticamente pelo login na campanha.   
  
Mas tomar cuidado pois utiliizamos o microsip sim na operação, se for atrapalhar os avanços de conexão com o SIP. nao precisa remover

### 3. CPC não contabiliza

O card "CPC" (linha 860) mostra `myMetrics?.agreements ?? 0` — ou seja, está mostrando **acordos** no lugar de CPC. CPC deveria contar as disposições do dia que têm `is_cpc = true` no `call_disposition_types`.

**Ação:** Alterar a query de `todayDispositions` para incluir o `disposition_type`, fazer join com `call_disposition_types` para verificar `is_cpc`, e criar uma métrica separada para CPC.

### 4. Card "Feedback" — desnecessário

O card mostra "Nenhuma avaliação ainda" e não tem funcionalidade.

**Ação:** Substituir por card de **Acordos** (quantos acordos fechou hoje), que é uma métrica mais útil.

## Mudanças

### `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

1. **Query `todayDispositions**`: Incluir `disposition_type` no select
2. **Nova query `cpcDispositionTypes**`: Buscar IDs dos `call_disposition_types` onde `is_cpc = true`
3. `**agentMetrics**`: Adicionar campo `cpc` contando apenas disposições cujo tipo é CPC
4. **Card CPC**: Usar `myMetrics?.cpc ?? 0` ao invés de `myMetrics?.agreements`
5. **Card Feedback → Acordos**: Trocar por card de Acordos usando `myMetrics?.agreements ?? 0`
6. **Remover SIP**: Remover bloco do botão SIP Off (linhas 794-813) da barra de status do operador
7. **Melhorar handlers**: Adicionar log detalhado no `handlePause` e `handleUnpause`, e mostrar `result?.detail` no toast de erro quando disponível
8. **handlePause/handleUnpause**: Verificar se o `invoke` retorna erro via `result.status >= 400` (como feito no login) em vez de depender apenas do catch

## Arquivos a editar


| Arquivo                                                           | Mudança                                                                                     |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Fix CPC query, remover SIP, Feedback→Acordos, melhorar error handling nos handlers de pausa |
