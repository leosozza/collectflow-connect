

# Plano: Widget com status do operador, expandir sempre visível, e fix das pausas

## Problemas identificados

1. **Pausas não aparecem**: `loadPauseIntervals` procura `work_break_group_id` dentro do objeto da campanha retornado por `list_campaigns`, mas a API 3CPlus tipicamente retorna esse campo apenas nos detalhes da campanha individual (`GET /campaign/{id}`), não no listing. Precisa buscar detalhes da campanha para obter o `work_break_group_id`.

2. **Botão expandir ausente**: No widget minimizado, o botão expandir só aparece quando `state.clientId && !state.waitingForCall`. Em modo "aguardando ligação", ele some. Precisa estar sempre visível.

3. **Status do operador não aparece no widget**: A barra minimizada mostra apenas timer + pausa + fechar. Falta mostrar o status atual do operador (Aguardando ligação, Em pausa, Em ligação) com indicador colorido.

## Mudanças

### 1. `src/hooks/useAtendimentoModal.tsx`

**Expandir contexto com status do agente:**
```typescript
interface PauseControls {
  // ... existentes
  agentStatus?: number | string;  // status numérico do agente (1=idle, 2=on_call, 3=paused)
  agentName?: string;
}
```

**Novo layout da barra minimizada:**
```text
┌──────────────────────────────────────────────────────────────┐
│ [≡] ● Aguardando ligação  02:34  [☕ Pausa ▼]  [⬜] [✕]   │
└──────────────────────────────────────────────────────────────┘
```

- Indicador colorido (●) com cor baseada no status (verde=idle, vermelho=em ligação, amarelo=pausa)
- Label do status: "Aguardando ligação" / "Em ligação" / "Em pausa"
- Timer sempre visível
- Pausa/Retomar sempre visível
- **Expandir sempre visível** (remover condição `state.clientId`)
- Fechar

### 2. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**Fix `loadPauseIntervals`:** Quando `work_break_group_id` não estiver no objeto da campanha do listing, buscar detalhes da campanha via `campaign_details` (novo action) para obter o campo.

**Passar status do agente para o widget:**
```typescript
setPauseControls({
  ...existentes,
  agentStatus: myAgent?.status,
  agentName: myAgent?.name,
});
```

### 3. `supabase/functions/threecplus-proxy/index.ts`

**Adicionar action `campaign_details`:**
```typescript
case 'campaign_details': {
  url = buildUrl(baseUrl, `campaign/${body.campaign_id}`, authParam);
  break;
}
```

Isso permite buscar os detalhes da campanha individual incluindo `work_break_group_id`.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/hooks/useAtendimentoModal.tsx` | Mostrar status do operador na barra, expandir sempre visível |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Fix loadPauseIntervals + passar agentStatus/agentName para widget |
| `supabase/functions/threecplus-proxy/index.ts` | Adicionar action `campaign_details` |

