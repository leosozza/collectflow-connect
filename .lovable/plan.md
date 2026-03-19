

# Plano: Extrair CPF/telefone do `company_calls` (nao do `agents_status`)

## Diagnostico

Os logs revelam o problema real:

- **`agents_status`** retorna apenas: `{id, extension, name, status, status_start_time}` -- **sem phone, sem mailing fields**
- **`company_calls`** retorna os dados do mailing, incluindo CPF e telefone, **mas indexados por status e por agente**:
```json
{"data":{"4":[{"agent":"100707","phone":"5531987471336","identifier":"03406715648","campaign_id":"251356",...}]}}
```

O codigo atual tenta ler `myAgent.mailing_identifier` e `myAgent.phone`, que nao existem no objeto retornado por `agents_status`. Os dados estao no `company_calls`, no objeto da chamada ativa do agente.

## Correcao

### `TelefoniaDashboard.tsx`

1. **Apos o `fetchAll`**, criar uma funcao que cruza `company_calls.data` com o `operatorAgentId` para encontrar a chamada ativa do agente:
   - `company_calls.data` pode ser um objeto indexado por status (ex: `{"2": [...], "4": [...]}`) ou um array
   - Iterar por todas as chamadas e encontrar a que tem `agent == operatorAgentId` e status de chamada ativa (status 2 = em ligacao)
   - Extrair `identifier` (CPF), `phone`, e quaisquer campos `Extra` dessa chamada

2. **Armazenar a chamada ativa do agente** em um state (`activeCall`) ou derivar via useMemo

3. **Atualizar os logs** para mostrar os dados extraidos da chamada:
```
console.log("[3CPlus] activeCall for agent:", JSON.stringify(activeCall));
console.log("[3CPlus] CPF:", activeCall?.identifier, "Phone:", activeCall?.phone);
```

4. **Passar para o `TelefoniaAtendimentoWrapper`** os dados corretos da chamada ativa ao inves dos campos inexistentes do agente

## Resumo

| Arquivo | Mudanca |
|---|---|
| `TelefoniaDashboard.tsx` | Extrair chamada ativa do `companyCalls.data` cruzando com `operatorAgentId`; usar `identifier`/`phone` da chamada para lookup do cliente |

