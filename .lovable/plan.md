

# Reformular Widget Flutuante: Pausa + Auto-expansão

## O que muda

### 1) Widget minimizado — nova barra de controles
**Arquivo:** `src/hooks/useAtendimentoModal.tsx`

A barra minimizada atual mostra: `[grip] [icon] nome [timer] [expand] [close]`

Nova barra: `[grip] [timer] [Pausa ▼] [expand] [close]`

- **Timer**: cronômetro visível sempre
- **Pausa**: botão que abre Popover com lista de intervalos vinculados à campanha (mesma lógica já existente no `TelefoniaDashboard`)
- **Expandir**: abre o painel completo
- **Fechar**: fecha o widget

Para isso, o contexto do widget precisa receber dados adicionais:
- `pauseIntervals: any[]` — lista de pausas disponíveis
- `onPause: (intervalId: number) => void` — callback para pausar
- `onUnpause: () => void` — callback para retomar
- `isPaused: boolean` — estado atual do agente

O `TelefoniaDashboard` já possui toda essa lógica (`handlePause`, `handleUnpause`, `pauseIntervals`, `isPaused`). Vou expor esses dados via contexto do widget para que a barra flutuante os consuma.

### 2) Auto-expansão quando ligação cai
**Arquivo:** `src/hooks/useAtendimentoModal.tsx`

Quando `updateAtendimento()` é chamado (ou seja, cliente identificado + chamada ativa), o widget deve:
- Sair do modo minimizado automaticamente (`setIsMinimized(false)`)
- Centralizar na tela

Isso já acontece parcialmente no `updateAtendimento`, mas preciso garantir que force a expansão mesmo se `hasCustomPosition` estiver true.

### 3) Passar dados de pausa para o widget
**Arquivo:** `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

Após rehydration/login, além de `openWaiting(agentId)`, vou chamar um novo método `setWidgetPauseControls(...)` que alimenta o contexto com as pausas e callbacks.

## Detalhes técnicos

### Contexto expandido (`useAtendimentoModal.tsx`)

```typescript
interface AtendimentoModalContextType {
  // ... existentes
  setPauseControls: (controls: PauseControls) => void;
}

interface PauseControls {
  intervals: any[];
  isPaused: boolean;
  onPause: (intervalId: number) => void;
  onUnpause: () => void;
}
```

### Widget minimizado — novo layout

```text
┌───────────────────────────────────────────────┐
│ [≡] 02:34  [☕ Pausa ▼]  [⬜ Expandir] [✕]  │
└───────────────────────────────────────────────┘
```

Quando `isPaused === true`, o botão Pausa vira "Retomar" (ícone Play).

O Popover de pausas usa o mesmo markup já existente no TelefoniaDashboard (linhas 733-758).

### Auto-expansão no `updateAtendimento`

Forçar `setIsMinimized(false)` e `centerPosition()` sempre que `clientId` é definido (ligação identificada).

## Arquivos a editar
1. `src/hooks/useAtendimentoModal.tsx` — novo contexto de pausa, layout da barra, auto-expand
2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` — alimentar controles de pausa no widget

## Nota sobre o componente floating-nav
O componente `floating-nav.tsx` compartilhado na mensagem serve apenas como inspiração visual. Ele usa `framer-motion` e um padrão de nav diferente. Vou aproveitar a ideia de barra flutuante compacta mas implementar com a arquitetura existente (sem adicionar `framer-motion` como dependência).

