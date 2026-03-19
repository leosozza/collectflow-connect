

# Plano: Widget Flutuante de Telefonia + Correção do Desligar

## Parte 1 — Widget Flutuante Global (substituir modal estático)

### Conceito
Trocar o `Dialog` do `useAtendimentoModal` por um widget flutuante arrastável (draggable). O operador pode mover o widget para qualquer canto da tela enquanto trabalha em outras páginas.

O widget terá dois estados:
- **Minimizado**: barra compacta flutuante mostrando nome do cliente + timer + botão desligar + botão expandir
- **Expandido**: painel flutuante grande (~95vw x 85vh) com o `AtendimentoPage embedded` completo, similar ao modal atual mas arrastável

### Implementação

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | Substituir `Dialog` por div flutuante com `position: fixed`, z-index alto, estado minimizado/expandido, drag via mouse events (onMouseDown/Move/Up no header). Adicionar estado `isMinimized`. |
| Nenhum outro arquivo muda | O `TelefoniaDashboard.tsx` e `App.tsx` já usam `openAtendimento()` — continuam funcionando. |

### Detalhes do Widget Flutuante

```text
┌──────────────────────────────────────────┐
│ [≡ drag] João Silva | 02:34 | [−] [✕]  │  ← minimizado (barra ~300px)
└──────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ [≡] Atendimento — João Silva  [−] [✕]           │  ← header draggable
│ ┌──────────────────────────────────────────────┐ │
│ │  AtendimentoPage embedded (scroll interno)   │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

- Drag: usar state `{x, y}` + `onMouseDown` no header que ativa `onMouseMove` no `document`
- Minimizar: colapsa para barra compacta no canto inferior direito
- Fechar: `closeAtendimento()` (confirmar se há chamada ativa)
- `z-index: 9999` para ficar acima de tudo

---

## Parte 2 — Bug do botão DESLIGAR

### Diagnóstico

O `handleHangup` no `AtendimentoPage` lê `settings.threecplus_domain` e `settings.threecplus_api_token` de `tenant?.settings`. Isso funciona. O `effectiveAgentId` usa o `agentId` prop passado pelo modal.

O problema real é que **o `handleHangup` não loga a resposta da API**. Se a 3CPlus retorna erro (ex: agente não está em chamada, token expirado), o código cai no `catch` genérico e exibe apenas "Erro ao desligar ligação" sem detalhes.

### Correção

| Arquivo | Mudança |
|---|---|
| `src/pages/AtendimentoPage.tsx` | No `handleHangup`: adicionar `console.log` da resposta da API antes de avaliar sucesso/erro. Logar o body retornado para diagnóstico. Melhorar mensagem de erro com `data.detail` ou `data.message`. |

Código específico:
```typescript
const handleHangup = async () => {
  const callAgentId = effectiveAgentId;
  if (!callAgentId) { toast.error("Agente não vinculado"); return; }
  const domain = settings.threecplus_domain;
  const apiToken = settings.threecplus_api_token;
  if (!domain || !apiToken) { toast.error("3CPlus não configurada"); return; }
  console.log("[Hangup] Desligando — agentId:", callAgentId, "domain:", domain);
  setHangingUp(true);
  try {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action: "hangup_call", domain, api_token: apiToken, agent_id: callAgentId },
    });
    console.log("[Hangup] Response:", JSON.stringify(data), "error:", error);
    if (error) throw error;
    if (data?.status && data.status >= 400) {
      toast.error(data.detail || data.message || "Erro ao desligar");
    } else {
      toast.success("Ligação encerrada");
    }
  } catch (e) {
    console.error("[Hangup] Exception:", e);
    toast.error("Erro ao desligar ligação");
  } finally { setHangingUp(false); }
};
```

---

## Resumo

1. **Widget flutuante draggable** em `useAtendimentoModal.tsx` — substitui o Dialog por div fixed arrastável com estados minimizado/expandido
2. **Fix do desligar** em `AtendimentoPage.tsx` — adicionar logs detalhados da resposta da API para diagnóstico

