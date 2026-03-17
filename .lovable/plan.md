

# Histórico de Atendimento — Responsável + Cores por Origem

## Resumo

Duas mudanças na timeline de `/atendimento`:

1. **Mostrar o responsável** em cada item (operador, sistema, régua, IA)
2. **Cores diferenciadas por origem da ação** — leves, sem comprometer a identidade visual

---

## 1. Responsável pela ação

### Problema atual
- `fetchDispositions` faz `select("*")` mas não faz join com `profiles` — o campo `operator_name` nunca chega
- `agreements` não traz quem criou
- `callLogs` já traz `agent_name` (funciona)
- `message_logs` (régua/prevenção) não são exibidos na timeline

### Solução

**`dispositionService.ts`**: Alterar `fetchDispositions` para fazer join com profiles:
```sql
select("*, profiles:operator_id(full_name)")
```
Mapear `profiles.full_name` → `operator_name` no retorno.

**`AtendimentoPage.tsx`**: Na query de agreements, fazer join para buscar o criador:
```sql
select("*, profiles:created_by(full_name)")
```
Passar o nome como campo `operator` no item da timeline.

**`ClientTimeline.tsx`**: Para cada item, mostrar o responsável com label contextual:
- Disposição/Acordo → "por [Nome do Operador]"
- Ligação (call_logs) → "Agente: [agent_name]"
- Régua/sistema → "Sistema" ou "Régua de Prevenção"

---

## 2. Cores por origem da ação

### Esquema de cores (bordas e backgrounds leves)

| Origem | Borda | Background | Dot da timeline |
|---|---|---|---|
| **Operador** (disposição, nota) | `border-amber-200` | `bg-amber-50/50` | `border-amber-400` |
| **Ligação** (call_logs, discador) | `border-blue-200` | `bg-blue-50/50` | `border-blue-400` |
| **Acordo** (agreement) | `border-emerald-200` | `bg-emerald-50/50` | `border-emerald-400` |
| **WhatsApp / Mensagem** (message) | `border-violet-200` | `bg-violet-50/50` | `border-violet-400` |
| **Régua / Prevenção** (message_logs) | `border-slate-200` | `bg-slate-50/50` | `border-slate-400` |
| **IA** (futuro) | `border-purple-200` | `bg-purple-50/50` | `border-purple-400` |
| **Pagamento** | `border-teal-200` | `bg-teal-50/50` | `border-teal-400` |

Cores suaves com `/50` de opacidade — mantém a identidade visual limpa.

### Atualizar `getItemBorderColor` e o dot da timeline

Refatorar para usar um mapa de cores por `type`, aplicando tanto no card quanto no circle indicator da timeline vertical.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `src/services/dispositionService.ts` | Join com profiles para trazer `operator_name` |
| `src/pages/AtendimentoPage.tsx` | Join em agreements para trazer criador; passar operator nos items |
| `src/components/atendimento/ClientTimeline.tsx` | Cores por tipo + exibir responsável em todos os items |

## O que NÃO muda
- Nenhuma mudança de banco de dados
- Nenhuma edge function
- Nenhuma alteração funcional — apenas visual e informacional

