

# Plano: Adicionar logs de debug para retornos da 3CPlus

## Problema

Quando uma chamada entra, a ficha nao abre. Precisamos visibilidade no console (mesmo em producao) sobre o que esta retornando da API 3CPlus para diagnosticar: qual o status do agente, se o campo `phone`/`remote_phone` esta presente, e o que `company_calls` retorna.

## Mudancas

### `src/components/contact-center/threecplus/TelefoniaDashboard.tsx`

Adicionar `console.log` nos seguintes pontos:

1. **Apos `fetchAll` resolver os dados** (~linha 278-311): logar `agentList`, `callsData`, e o `myAgent` encontrado com todos os campos relevantes
2. **Na deteccao de `isOnCall`** (~linha 486): logar o status do agente, phone, remote_phone, call_id
3. **No `TelefoniaAtendimentoWrapper`**: logar o telefone recebido e o resultado do `useClientByPhone`

Formato dos logs:
```
console.log("[3CPlus] agents_status response:", JSON.stringify(agentList));
console.log("[3CPlus] company_calls response:", JSON.stringify(callsData));
console.log("[3CPlus] myAgent:", JSON.stringify(myAgent));
console.log("[3CPlus] isOnCall:", isOnCall, "phone:", myAgent?.phone, "remote_phone:", myAgent?.remote_phone);
```

## Arquivos alterados

| Arquivo | Mudanca |
|---|---|
| `src/components/contact-center/threecplus/TelefoniaDashboard.tsx` | Adicionar console.log nos pontos de polling e deteccao de chamada |

