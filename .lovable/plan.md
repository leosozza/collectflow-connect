

# Resolucao das Limitacoes do Painel de Telefonia

## 1. Polling de 30s -- Reduzir para 10s no operador

O intervalo de refresh e configuravel (15/30/60s) mas o padrao e 30s. Para operadores, o polling sera reduzido para **10s** por padrao, garantindo deteccao rapida de ligacoes.

**Arquivo:** `TelefoniaDashboard.tsx`
- Mudar o `useState(30)` para `useState(isOperatorView ? 10 : 30)` no `interval` state
- Adicionar opcao "10 segundos" no Select do admin

## 2. Alerta de threecplus_agent_id nao configurado

Atualmente mostra apenas "Seu perfil nao possui um ID de agente 3CPlus vinculado" sem orientacao. Melhorar a mensagem com instrucoes claras e icone de alerta.

**Arquivo:** `TelefoniaDashboard.tsx`
- Melhorar o bloco de `!operatorAgentId` com instrucoes de como solicitar ao admin a configuracao

## 3. Atendimento automatico -- fallback quando cliente nao existe no CRM

Quando o cliente nao e encontrado pelo telefone, atualmente mostra apenas "Cliente nao encontrado". Adicionar botao para **cadastrar rapidamente** ou **abrir atendimento generico** mesmo sem match.

**Arquivo:** `TelefoniaDashboard.tsx` (componente `TelefoniaAtendimentoWrapper`)
- Adicionar botao "Cadastrar Cliente" que abre o formulario pre-preenchido com o telefone
- Adicionar botao "Abrir Atendimento" mesmo sem cliente vinculado

## 4. SpyButton -- ja funcional, sem alteracao necessaria

O `SpyButton` ja implementa corretamente a chamada `spy_agent` via `threecplus-proxy`. Funciona se o endpoint 3CPlus estiver habilitado na conta. Nenhuma alteracao de codigo necessaria -- depende apenas da conta 3CPlus ter a feature ativa.

---

### Resumo das alteracoes

| Arquivo | Mudanca |
|---|---|
| `TelefoniaDashboard.tsx` | Polling 10s para operadores, mensagem melhorada para agent_id ausente, botoes de acao no fallback de cliente nao encontrado |

