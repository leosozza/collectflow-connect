
# Plano: corrigir TPA x pausa e manter a ficha aberta até finalizar a tabulação

## Diagnóstico do que está errado hoje

1. O dashboard mistura **TPA** com **pausa manual**:
   - em `TelefoniaDashboard.tsx`, `isPausedStatus` inclui `status === 4`
   - o callback `onFinishDisposition` chama `unpause_agent`
   - o botão **Retomar** acaba sendo exibido/acionado também em contexto de TPA

2. A mensagem “**O agente não está em intervalo ou não pode ser removido**” faz sentido com o código atual:
   - `unpause_agent` usa `/agent/work_break/exit`
   - isso serve para **intervalo manual**
   - em **TPA**, o fluxo correto é **qualificar/finalizar a chamada**, não sair de intervalo

3. A ficha não está sendo tratada como a tela principal do pós-chamada:
   - quando a ligação cai, o dashboard passa para a tela de ACW/TPA
   - mas o desejado é: **a ficha continuar aberta** até o operador encerrar o TPA nela

## O que vou corrigir

### 1. Separar estado real de UI: pausa manual vs TPA
Criar uma derivação única no `TelefoniaDashboard`:

- `manualPause`: status 3 com `pause_name`/`activePauseName`
- `tpa`: status 4, ou status 3 sem pausa manual e com chamada recém-finalizada
- `onCall`
- `idle`

Isso passa a controlar:
- texto do topo
- cor/status badge
- botão da barra superior
- estado enviado ao modal de atendimento

Resultado esperado:
- TPA nunca mais aparece como “Em pausa”
- “Retomar” só aparece para pausa manual
- TPA aparece como “TPA — Pós-atendimento”

### 2. Parar de usar `unpause_agent` para encerrar TPA
Trocar a lógica do `onFinishDisposition`:

- se a chamada já foi qualificada pela ficha (`3cp_qualified_from_disposition`), apenas:
  - atualizar status
  - aguardar retorno para ocioso
  - limpar flags e fechar a ficha
- se ainda não foi qualificada:
  - tentar `qualify_call` usando o `callId` correto
  - só fechar a ficha se a qualificação der certo
- `unpause_agent` fica restrito a pausa manual

Resultado esperado:
- some o erro de “não está em intervalo”
- finalizar TPA usa o fluxo correto da 3CPlus

### 3. Manter a ficha aberta após a queda da ligação
Ajustar o `TelefoniaDashboard` para que, quando a ligação cair:

- se a ficha/modal já estiver aberta, **não trocar para a tela fallback de ACW**
- a ficha continua aberta com o banner de status em TPA
- o operador finaliza por dentro da própria ficha

A tela fallback de ACW continua existindo apenas se:
- a ficha não estiver aberta
- ou o operador não tabulou durante o atendimento

### 4. Ajustar a ação “Finalizar Tabulação” dentro da ficha
Em `AtendimentoPage.tsx`:

- manter o banner central com status da 3CPlus
- alterar o botão para obedecer o fluxo:
  - em **TPA**: finalizar qualificação/encerramento do pós-atendimento
  - em **pausa manual**: não usar o mesmo fluxo de TPA
- impedir fechamento “silencioso” da ficha enquanto o operador ainda estiver em TPA sem finalizar corretamente

### 5. Garantir consistência do callId e do estado de tabulação
Aproveitar o fluxo já existente para reforçar:

- priorizar `telephony_id` / `3cp_last_call_id`
- não limpar flags cedo demais
- só limpar:
  - `3cp_last_call_id`
  - `3cp_qualified_from_disposition`
  - `3cp_active_pause_name`
  quando o estado realmente tiver sido concluído

## Arquivos a ajustar

| Arquivo | Ajuste |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | separar TPA de pausa, corrigir botão Retomar, manter ficha aberta no pós-chamada, corrigir callback de finalização |
| `src/pages/AtendimentoPage.tsx` | finalizar TPA corretamente na ficha, fechar só após sucesso, reforçar banner/status |
| `src/hooks/useAtendimentoModal.tsx` | expor/usar `isOpen` e contexto do modal para priorizar a ficha durante o TPA |
| `src/services/dispositionService.ts` | reutilizar `qualifyOn3CPlus` como caminho oficial de encerramento do TPA |

## Resultado esperado após a correção

```text
Ligação ativa
  → ficha abre
  → cliente desliga
  → 3CPlus entra em TPA
  → ficha permanece aberta
  → topo mostra "TPA — Pós-atendimento"
  → operador finaliza a tabulação na ficha
  → sistema qualifica a chamada corretamente
  → operador volta para "Ocioso"

Pausa manual
  → topo mostra "Em pausa"
  → botão "Retomar" usa unpause_agent
```

## Observação técnica importante

Hoje o bug não é só visual. Ele é de fluxo:
- o frontend está tratando TPA como se fosse intervalo
- por isso chama a ação errada no proxy
- e por isso o operador fica preso no estado incorreto

A correção precisa centralizar a lógica em um **estado derivado único de telefonia**, para evitar que cada trecho da UI interprete o status de um jeito diferente.
