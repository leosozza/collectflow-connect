# Plano: Enviar CPF no mailing e localizar ficha por CPF na chamada

## Contexto

O mailing enviado ao 3CPlus ja inclui o CPF como `identifier` e o ID do cliente como `Extra3`. Porem, quando a chamada retorna, o sistema tenta localizar o cliente apenas pelo telefone (`useClientByPhone`), que falha se o formato do numero nao bater. A 3CPlus retorna os dados do mailing no objeto do agente durante a chamada (campos como `mailing_identifier`, `mailing_extra3`, etc).

## Mudancas

### 1. `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

**Extrair dados do mailing do agente em chamada:**

- Quando `isOnCall`, alem do `phone`/`remote_phone`, extrair:
  - `myAgent.mailing_identifier` ou `myAgent.identifier` (CPF)
  - `myAgent.mailing_extra3` ou `myAgent.Extra3` (client UUID)
- Logar esses campos no console para debug
- Passar `clientCpf` e `clientId` para o `TelefoniaAtendimentoWrapper`

**Atualizar `TelefoniaAtendimentoWrapper`:**

- Aceitar novas props: `clientCpf?: string` e `clientDbId?: string`
- Prioridade de lookup:
  1. Se `clientDbId` (UUID) estiver presente, navegar direto para `/atendimento/${clientDbId}`
  2. Se `clientCpf` estiver presente, buscar cliente por CPF na tabela `clients`
  3. Fallback: buscar por telefone (comportamento atual)
- Criar query adicional para buscar por CPF quando disponivel

### 2. `src/components/carteira/DialerExportDialog.tsx`

Ja envia `identifier` (CPF) e `Extra3` (client.id) -- nenhuma mudanca necessaria aqui.

### 3. `src/components/contact-center/threecplus/MailingPanel.tsx`

Ja envia `identifier` (CPF) -- nenhuma mudanca necessaria aqui.

## Resumo


| Arquivo                  | Mudanca                                                                                                                                                                                                                                                                                                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TelefoniaDashboard.tsx` | Extrair CPF/ID do mailing da chamada, passar para wrapper, priorizar lookup por ID > CPF > telefone e normalize o cpf para somente numeros e mostre toast como feedback se ocorrer algum erro e ao clicar no toast mostre o log detalhado do erro com botao para copiar e ao copiar mostre o resultado completo no log |
