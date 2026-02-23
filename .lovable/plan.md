

## Correcao da Conexao WhatsApp - Tratamento de connection.update

### Problema identificado

Os logs mostram que:
- O QR Code e gerado corretamente
- O webhook recebe eventos `connection.update` com estado "connecting"
- O evento `connection.update` NAO e tratado pelo webhook (so `messages.upsert` e `messages.update` sao processados)
- Resultado: o status da instancia nunca e atualizado no banco, e a UI nunca reflete a conexao

### Solucao

**1. Webhook (`supabase/functions/whatsapp-webhook/index.ts`)**

Adicionar tratamento para o evento `connection.update`:
- Quando receber `state: "open"`: atualizar o campo `status` da instancia para "connected" e salvar o numero de telefone do `sender`
- Quando receber `state: "close"`: atualizar status para "disconnected"
- Logar o estado para facilitar debug futuro

**2. UI - Polling apos QR scan (`src/components/integracao/BaylersInstancesList.tsx`)**

Apos exibir o QR Code, iniciar polling automatico (a cada 5 segundos, por ate 2 minutos) para verificar o status da instancia via Evolution API. Quando detectar estado `"open"`:
- Fechar o dialog do QR Code automaticamente
- Mostrar toast de sucesso
- Atualizar o badge de status

**3. Dialog do QR Code - Feedback visual**

Adicionar mensagem no dialog do QR indicando que o sistema esta aguardando a leitura, e um spinner enquanto espera a conexao. Se a conexao for confirmada, mostrar icone de sucesso e fechar apos 2 segundos.

### Detalhes tecnicos

**Webhook - novo bloco `connection.update`:**

Antes do `return` final do webhook, adicionar:

```text
if (event === "connection.update") {
  const state = body.data?.state;
  const sender = body.sender;

  // Atualizar status da instancia
  const statusValue = state === "open" ? "connected" : "disconnected";
  await supabase
    .from("whatsapp_instances")
    .update({
      status: statusValue,
      phone_number: state === "open" && sender
        ? sender.replace("@s.whatsapp.net", "")
        : undefined
    })
    .eq("instance_name", instanceName);

  return response { ok: true, state };
}
```

**UI - Polling no BaylersInstancesList:**

Na funcao `handleConnect`, apos exibir o QR Code, iniciar um intervalo:
- Chamar `getEvolutionInstanceStatus(inst.instance_name)` a cada 5s
- Se `state === "open"`: parar polling, fechar dialog, atualizar statusMap, mostrar toast de sucesso
- Timeout de 120s: parar polling, mostrar mensagem pedindo nova tentativa
- Limpar intervalo ao fechar o dialog

### Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Tratar evento `connection.update` para atualizar status e telefone da instancia |
| `src/components/integracao/BaylersInstancesList.tsx` | Polling automatico apos QR scan, feedback visual no dialog, auto-fechar ao conectar |

