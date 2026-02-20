
## Diagnóstico Confirmado com Testes ao Vivo

### Causa Raiz (Testado diretamente na Evolution API)

**Teste 1 — `connect` com instância `close`:**
```json
Resposta: {"count": 0}
```
A instância está em estado `close`. O `/instance/connect` retorna `{"count":0}` sem QR.

**Teste 2 — `restart` via `PUT /instance/restart/{name}`:**
```json
Resposta: {"error":"Not Found","response":{"message":["Cannot PUT /instance/restart/..."]}}
```
O endpoint de restart **não é suportado** nessa versão/instância da Evolution API hospedada em `evolution.ybrasil.com.br`. O código atual tenta restart e falha silenciosamente (`try/catch` ignora o erro), depois faz o segundo `connect` que também retorna `{"count":0}`, e o frontend exibe "Instância já conectada ou QR indisponível".

### Por que `{"count":0}` sem QR?

Quando uma instância WhatsApp está em estado `close` (sessão encerrada/desconectada), a Evolution API mantém o contexto da sessão anterior. Para gerar um novo QR Code, é necessário primeiro **fazer logout** da sessão antiga via `DELETE /instance/logout/{name}`, que limpa a sessão e permite que um novo QR seja gerado via `connect`.

### Solução

#### Mudança na `evolution-proxy` — action `connect`

Substituir a tentativa de `restart` pelo fluxo correto:

```
Fluxo corrigido:
  1. GET /instance/connect/{name}
  2. Se retornar base64/qrcode → retornar QR ✓
  3. Se retornar {"count":0} ou sem base64:
     a. DELETE /instance/logout/{name}   ← força limpeza da sessão
     b. Aguardar 1.5 segundos
     c. GET /instance/connect/{name}     ← agora gera QR novo
     d. Retornar resultado com QR
```

O `logout` (`DELETE /instance/logout`) já é usado com sucesso no action `delete`, confirmando que funciona nessa versão da API.

#### Mudança no action `restart`

O `restart` via `PUT` não funciona nessa API. Trocar o método para usar `logout` + `connect` em sequência como forma de "reiniciar" a conexão.

### Arquivos a Modificar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/evolution-proxy/index.ts` | No action `connect`: substituir `PUT /instance/restart` por `DELETE /instance/logout`; no action `restart`: usar logout como alternativa |

### Impacto

- Ao clicar "QR Code" em instância desconectada (`close`): o sistema faz logout da sessão antiga e conecta novamente, gerando o QR
- O processo leva ~2-3 segundos (já há indicador de loading no botão)
- Nenhuma mudança necessária no frontend — apenas na edge function
