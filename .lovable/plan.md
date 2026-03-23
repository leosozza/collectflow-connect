

# Plano: Unificar tabulação — eliminar dupla tabulação

## O que está acontecendo hoje (por que está confuso)

O operador tabula **duas vezes**:

1. **Durante a ligação** — O sistema abre a ficha do cliente (AtendimentoPage) que tem o `DispositionPanel`. O operador seleciona a tabulação RIVO e salva no banco de dados (`call_dispositions`)
2. **Após a ligação** — A 3CPlus coloca o agente em ACW (pausa automática). O dashboard mostra uma **segunda** tela de tabulação que envia a qualificação para a API 3CPlus via `qualify_call` para liberar o agente

Resultado: o operador faz o mesmo trabalho duas vezes em telas diferentes.

## Solução: Unificar em um único passo

Quando o operador tabular na ficha do cliente (DispositionPanel), o sistema deve **automaticamente**:
1. Salvar a tabulação no RIVO (já faz)
2. Enviar a qualificação correspondente para a 3CPlus via `qualify_call` (usando o mapeamento `threecplus_disposition_map` que já existe no tenant settings)
3. Liberar o agente do ACW automaticamente

A tela separada de tabulação ACW só aparecerá como **fallback** — se o operador fechou a ficha sem tabular.

## Mudanças

### 1. `src/components/atendimento/DispositionPanel.tsx`

Após salvar a tabulação no RIVO (`onDisposition`), verificar se existe um `callId` ativo (vindo do contexto de telefonia) e um mapeamento 3CPlus para a tabulação selecionada. Se sim, chamar `qualify_call` automaticamente via `threecplus-proxy`.

- Receber novas props opcionais: `callId`, `agentId` (do contexto de telefonia)
- Após `onDisposition` concluir com sucesso, buscar o mapeamento `threecplus_disposition_map` do tenant settings
- Se a tabulação selecionada tem correspondência no mapeamento, chamar `qualify_call`
- Toast informando que a qualificação foi enviada automaticamente

### 2. `src/hooks/useAtendimentoModal.tsx`

Passar `callId` e `agentId` como parte do contexto do modal para que o `DispositionPanel` tenha acesso.

### 3. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

Na tela de ACW (fallback), adicionar texto explicativo: "Você não tabulou durante o atendimento. Selecione a qualificação para retornar à campanha."

Quando a tabulação no `DispositionPanel` já fez o `qualify_call`, o agente sai do ACW automaticamente — a tela de fallback nem aparece.

## Fluxo unificado

```text
Ligação ativa (status 2)
  → Abre ficha do cliente (AtendimentoPage)
  → Operador usa DispositionPanel para tabular

Operador clica "Tabular"
  → Salva call_disposition no RIVO ✓
  → Busca mapeamento 3CPlus ✓
  → Chama qualify_call automaticamente ✓
  → Agente volta ao idle (status 1) ✓
  → Tela de ACW NÃO aparece

Se operador NÃO tabulou durante a ligação
  → Ligação termina → ACW (status 3)
  → Tela de tabulação fallback aparece
  → Operador seleciona qualificação manualmente
```

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `src/components/atendimento/DispositionPanel.tsx` | Após tabular, chamar `qualify_call` automaticamente se em contexto de telefonia |
| `src/hooks/useAtendimentoModal.tsx` | Expor `callId` e `agentId` no contexto |
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Texto de fallback na tela ACW |

