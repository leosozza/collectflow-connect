

# Evolution API via Secrets Globais

## Resumo

A URL e a API Key do servidor Evolution API serao armazenadas como **secrets globais** do projeto, nao mais por instancia. Quando o admin clicar "Nova Instancia", ele informa apenas o **nome** (ex: "Agente 01"). O sistema automaticamente:

1. Gera o `instanceName` no formato **"{nome_empresa} - {nome_digitado}"**
2. Chama a Evolution API para criar a instancia
3. Exibe o QR Code para conexao
4. Salva no banco com o token especifico retornado pela API

## O que muda

### 1. Dois novos secrets globais

| Secret | Valor |
|---|---|
| `EVOLUTION_API_URL` | URL base do servidor Evolution (ex: `https://evolution.minhaempresa.com`) |
| `EVOLUTION_API_KEY` | API Key global do servidor Evolution |

Esses secrets ficam disponiveis nas edge functions via `Deno.env.get()`.

### 2. Nova edge function: `evolution-proxy`

Centraliza todas as chamadas a Evolution API, evitando expor credenciais no frontend.

Acoes suportadas (via query param `action`):

- **create** - `POST /instance/create` - cria instancia e retorna QR code
- **connect** - `GET /instance/connect/{instanceName}` - retorna QR code para reconexao
- **status** - `GET /instance/connectionState/{instanceName}` - retorna estado (open/close/connecting)
- **delete** - `DELETE /instance/delete/{instanceName}` - remove instancia do servidor

### 3. Formulario simplificado (BaylersInstanceForm)

Campos atuais removidos: URL da Instancia, API Key, Nome da Instancia (API).

Novo formulario:
- **Nome da Instancia** (obrigatorio) - ex: "Agente 01", "Cobranca"
- O `instanceName` na API sera gerado como: `"{tenant.name} - {nome}"`
- Exibicao informativa do nome que sera criado na API

### 4. Fluxo de criacao com QR Code

```text
1. Admin clica "+ Nova Instancia"
2. Digita o nome (ex: "Agente 01")
3. Clica "Criar"
4. Frontend chama edge function evolution-proxy?action=create
   - Edge function usa secrets EVOLUTION_API_URL + EVOLUTION_API_KEY
   - Chama POST {url}/instance/create com instanceName = "Temis - Agente 01"
5. Se sucesso:
   - Salva no banco: instance_name, api_key (hash retornado), instance_url (do secret)
   - Exibe QR Code em um Dialog para escanear
6. Se erro: exibe mensagem
```

### 5. Botoes na lista de instancias

Cada instancia tera:
- **QR Code / Conectar** - chama connect para exibir QR code
- **Status** - indicador visual (conectado/desconectado) consultando connectionState
- **Definir padrao** (estrela)
- **Remover** - remove do banco E chama delete na Evolution API

### 6. Atualizacao do send-bulk-whatsapp

A edge function de envio em lote passa a usar os secrets `EVOLUTION_API_URL` e `EVOLUTION_API_KEY` como fallback caso a instancia no banco nao tenha URL/key proprios.

---

## Detalhes tecnicos

### Edge function: `evolution-proxy/index.ts`

```text
POST /evolution-proxy?action=create
Body: { instanceName: "Temis - Agente 01", tenantId: "uuid" }
-> Chama POST {EVOLUTION_API_URL}/instance/create
-> Retorna: { instance, hash, qrcode }

POST /evolution-proxy?action=connect
Body: { instanceName: "Temis - Agente 01" }
-> Chama GET {EVOLUTION_API_URL}/instance/connect/{instanceName}
-> Retorna: { base64: "data:image/png;base64,..." }

POST /evolution-proxy?action=status
Body: { instanceName: "Temis - Agente 01" }
-> Chama GET {EVOLUTION_API_URL}/instance/connectionState/{instanceName}
-> Retorna: { state: "open" | "close" | "connecting" }

POST /evolution-proxy?action=delete
Body: { instanceName: "Temis - Agente 01" }
-> Chama DELETE {EVOLUTION_API_URL}/instance/delete/{instanceName}
```

Todas as acoes validam JWT do usuario autenticado.

### Arquivos a criar

| Arquivo | Descricao |
|---|---|
| `supabase/functions/evolution-proxy/index.ts` | Proxy para a Evolution API usando secrets globais |

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/integracao/BaylersInstanceForm.tsx` | Simplificar para apenas campo "Nome", receber tenantName como prop, mostrar preview do instanceName |
| `src/components/integracao/BaylersInstancesList.tsx` | Chamar evolution-proxy para criar/conectar/deletar, exibir QR code em Dialog, mostrar status de conexao |
| `src/services/whatsappInstanceService.ts` | Adicionar funcoes para chamar a edge function (createEvolutionInstance, connectInstance, getInstanceStatus, deleteEvolutionInstance) |
| `supabase/functions/send-bulk-whatsapp/index.ts` | Usar EVOLUTION_API_URL e EVOLUTION_API_KEY dos secrets como fallback |
| `supabase/config.toml` | Adicionar `[functions.evolution-proxy]` com verify_jwt = false |

### Tabela whatsapp_instances

Continua igual. Os campos `instance_url` e `api_key` serao preenchidos com os valores do secret global (URL) e do token especifico retornado pela API (hash.apikey). Isso garante que o envio de mensagens continue funcionando sem mudancas.

### Config TOML

```text
[functions.evolution-proxy]
verify_jwt = false
```

