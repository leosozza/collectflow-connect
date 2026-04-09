

# Análise da Integração Gupshup — Problemas Encontrados e Correções

## Problemas identificados

### 1. **Header da API Key está errado no `whatsapp-sender.ts`** (CRÍTICO)

A documentação oficial exige o header `apikey` (minúsculo). No nosso `sendGupshupMsg` (linha 256) estamos enviando `"apiKey"` (camelCase). Embora a Gupshup possa aceitar ambos em alguns endpoints, o padrão da documentação é `apikey`.

**Correção**: Trocar `"apiKey": apiKey` → `"apikey": apiKey` no `sendGupshupMsg`.

### 2. **Vídeo no Gupshup não aceita `mimetype`** (ERRO DE PAYLOAD)

Segundo a documentação, o payload de vídeo aceita apenas `url` e `caption` (opcional). Nosso código envia `mimetype` que não faz parte da spec:
```json
// Docs: { "type": "video", "url": "...", "caption": "..." }
// Nosso: { "type": "video", "url": "...", "caption": "...", "mimetype": "video/mp4" }
```

**Correção**: Remover `mimetype` do payload de vídeo.

### 3. **Áudio no Gupshup não aceita `mimetype`** (ERRO DE PAYLOAD)

A documentação mostra apenas `url` no payload de áudio. Nosso código adiciona `mimetype` que não é documentado.

**Correção**: Remover `mimetype` do payload de áudio.

### 4. **File no Gupshup não aceita `mimetype`** (ERRO DE PAYLOAD)

A documentação mostra `url` e `filename` apenas. Nosso código envia `mimetype` extra.

**Correção**: Remover `mimetype` do payload de file (document).

### 5. **`sendGupshupMsg` não trata resposta não-JSON** (RISCO)

Na linha 262 do `whatsapp-sender.ts`, `await resp.json()` pode explodir se a Gupshup retornar HTML ou corpo vazio — o mesmo bug que já corrigimos no `gupshup-proxy`.

**Correção**: Usar o padrão text-first + try/catch JSON.parse.

### 6. **`gupshup-proxy` testa endpoint de wallet, não valida o `appName`**

O proxy usa `/sm/api/v2/wallet/balance` que valida a API Key mas ignora o `appName`. Se o appName estiver errado, o teste passa mas o envio falha. Já tínhamos corrigido para `/wa/app/{appName}` no plano anterior, mas o código atual voltou ao endpoint de wallet.

**Correção**: Usar `https://api.gupshup.io/wa/app/${encodeURIComponent(appName)}` para validar ambos.

## Resumo das alterações

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/whatsapp-sender.ts` | (1) Header `apikey` minúsculo; (2) Remover `mimetype` dos payloads de vídeo, áudio e file; (3) Try/catch na resposta JSON |
| `supabase/functions/gupshup-proxy/index.ts` | Trocar endpoint de teste para `/wa/app/{appName}` |

Nenhuma mudança de banco de dados necessária.

