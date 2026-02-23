

## Correcao: Forcar logout antes de conectar via QR Code

### Problema raiz

Os logs mostram que:
- O QR Code e gerado com sucesso (`hasQr=true`)
- O webhook recebe `connection.update` com `state: "connecting"` mas **nunca** chega `state: "open"`
- O celular exibe "Tente novamente mais tarde"

Isso acontece porque a instancia na Evolution API mantem uma sessao anterior corrompida/stale. Quando o QR Code e escaneado, o WhatsApp rejeita por conflito de sessao.

### Solucao

Alterar o fluxo de conexao (`connect`) na Edge Function `evolution-proxy` para **sempre fazer logout antes de gerar o QR Code**, garantindo uma sessao limpa.

### Detalhes tecnicos

**`supabase/functions/evolution-proxy/index.ts` - action "connect"**

Antes de chamar `/instance/connect/`, adicionar:

1. Chamar `DELETE /instance/logout/{instanceName}` para limpar qualquer sessao stale
2. Aguardar 1.5 segundos para a sessao ser liberada
3. Entao chamar `/instance/connect/` para obter o QR Code fresco

Isso e analogo ao que ja e feito no caso de "no QR" (linha 172-178), mas aplicado SEMPRE, nao apenas quando o QR esta ausente.

```text
case "connect": {
  const { instanceName } = body;

  // SEMPRE fazer logout primeiro para limpar sessao stale
  try {
    await fetch(`${baseUrl}/instance/logout/${encodeURIComponent(instanceName)}`, {
      method: "DELETE",
      headers: { apikey: evolutionKey },
    });
  } catch { /* ignore */ }

  // Aguardar sessao ser liberada
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Agora conectar com sessao limpa
  const connectResp = await fetch(`${baseUrl}/instance/connect/${encodeURIComponent(instanceName)}`, {
    method: "GET",
    headers: { apikey: evolutionKey },
  });

  // ... resto do fluxo existente (404 handling, QR polling fallback)
}
```

### Arquivo modificado

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/evolution-proxy/index.ts` | Adicionar logout forcado antes de toda tentativa de conexao no case "connect" |

### Por que isso resolve

- Ao fazer logout antes de conectar, a Evolution API descarta a sessao anterior
- O novo QR Code gerado corresponde a uma sessao fresca
- Quando o usuario escaneia, o WhatsApp aceita a conexao normalmente
- O webhook recebera `state: "open"` e o polling da UI detectara a conexao

