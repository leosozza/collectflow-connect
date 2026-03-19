

# Plano: Corrigir intervalos de pausa e abertura de ficha na chamada

## Problema 1: Intervalos de pausa vazios

No `TelefoniaDashboard.tsx` (linha 416), a funcao `loadPauseIntervals` chama a action `list_work_break_intervals` que **nao existe** no proxy. A action correta e `list_work_break_group_intervals` com `group_id`.

O fluxo correto e:
1. Pegar o `work_break_group_id` da campanha ativa do agente
2. Chamar `list_work_break_group_intervals` com esse `group_id`

**Correcao** em `TelefoniaDashboard.tsx`:
- Modificar `loadPauseIntervals` para receber o `campaignId`, encontrar a campanha nos dados ja carregados, extrair `work_break_group_id`, e chamar `list_work_break_group_intervals` com `group_id`
- Se a campanha nao tiver `work_break_group_id`, deixar vazio (sem erro silencioso)

## Problema 2: Ficha nao abre quando chamada entra

O `TelefoniaAtendimentoWrapper` usa `useClientByPhone` para resolver o cliente pelo telefone. Se o telefone nao bate (formato diferente, DDD/DDI), a ficha nao abre. Alem disso, o componente renderiza inline (embedded) mas o usuario espera navegar para `/atendimento/:clientId`.

**Correcao** em `TelefoniaDashboard.tsx`:
- Quando `isOnCall` e o cliente e encontrado pelo phone, navegar para `/atendimento/${client.id}` ao inves de renderizar embedded
- Manter o fallback embedded para quando o cliente nao e encontrado (opcao de cadastrar)
- Adicionar logs de debug para facilitar diagnostico futuro

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Fix `loadPauseIntervals` para usar `work_break_group_id` da campanha; navegar para `/atendimento/:clientId` quando chamada detectada |

