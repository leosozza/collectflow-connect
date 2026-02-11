

# Integracao com Gateway de Pagamento Negociarie

## Resumo

Integrar o sistema com a API Negociarie (https://sistema.negociarie.com.br/api/v2) para permitir geracao de cobranças via Boleto, Pix e Cartao de Credito diretamente a partir das parcelas dos clientes, alem de sincronizar pagamentos recebidos e gerenciar inadimplencia.

---

## Autenticacao da API Negociarie

A API usa autenticacao Bearer Token. Para obter o token:
- **POST** `https://sistema.negociarie.com.br/api/login`
- Body: `{ "client_id": "...", "client_secret": "..." }`

Sera necessario configurar dois segredos no backend:
- `NEGOCIARIE_CLIENT_ID`
- `NEGOCIARIE_CLIENT_SECRET`

O token sera gerado e cacheado na edge function (com renovacao automatica).

---

## Endpoints da API que serao utilizados

### Cobranca Simples (Boletos)
| Acao | Metodo | Endpoint |
|------|--------|----------|
| Adicionar cobranca (boleto) | POST | `/cobranca/nova` |
| Consultar cobrancas | GET | `/cobranca/consulta` |
| Baixar parcela manual | POST | `/cobranca/baixa-manual` |
| Parcelas pagas por data | GET | `/cobranca/parcelas-pagas?data=YYYY-MM-DD` |
| Alteradas hoje | GET | `/cobranca/alteradas-hoje` |
| Atualizar URL callback | POST | `/cobranca/atualizar-url-callback` |

### Pix e Cartao
| Acao | Metodo | Endpoint |
|------|--------|----------|
| Novo Pix | POST | `/cobranca/nova-pix` |
| Novo Link de Cartao | POST | `/cobranca/nova-cartao` |
| Pagamento via Credito | POST | `/cobranca/pagamento-credito` |
| Cancelar pagamento | PATCH | `/cobranca/pagamento-credito/cancelar` |
| Desativar recorrencia | PATCH | `/cobranca/pagamento-credito/recorrencia/desativar` |

### Inadimplencia
| Acao | Metodo | Endpoint |
|------|--------|----------|
| Adicionar titulos | POST | `/inadimplencia/nova` |
| Consultar titulos | GET | `/inadimplencia/titulos` |
| Listar acordos | GET | `/inadimplencia/acordos` |
| Baixa de parcela do acordo | POST | `/inadimplencia/baixa-parcela` |
| Devolucao de titulo | POST | `/inadimplencia/devolucao-titulo` |
| Parcelas pagas (inadimplencia) | GET | `/inadimplencia/parcelas-pagas?data=YYYY-MM-DD` |

---

## Arquitetura

### Edge Function: `negociarie-proxy`

Uma nova edge function centralizada que:
1. Autentica o usuario interno (admin)
2. Gera/renova o token Bearer da Negociarie usando `client_id` e `client_secret` (armazenados como segredos)
3. Roteia as acoes para os endpoints corretos da API
4. Valida inputs com Zod
5. Respeita rate limit da API (60 req/min)

### Edge Function: `negociarie-callback`

Uma edge function publica (sem JWT) que recebe callbacks da Negociarie quando:
- Boleto e registrado na rede bancaria
- Pagamento e confirmado (Pix, boleto, cartao)
- Status de parcela muda

Ao receber um callback de pagamento, atualiza automaticamente o status da parcela no sistema e gera notificacao.

---

## Detalhes Tecnicos

### Nova tabela: `negociarie_cobrancas`

Armazena a relacao entre parcelas internas (clients) e cobrancas na Negociarie:

```sql
CREATE TABLE negociarie_cobrancas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  id_geral TEXT NOT NULL,          -- identificador no Negociarie
  id_parcela TEXT,                  -- id_parcela no Negociarie
  tipo TEXT NOT NULL DEFAULT 'boleto', -- boleto, pix, cartao
  status TEXT NOT NULL DEFAULT 'pendente',
  valor NUMERIC NOT NULL,
  data_vencimento DATE NOT NULL,
  link_boleto TEXT,
  pix_copia_cola TEXT,
  link_cartao TEXT,
  linha_digitavel TEXT,
  id_status INTEGER,               -- codigo status Negociarie (800, 801, etc)
  callback_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

RLS: isolamento por tenant_id, admins gerenciam.

### Novos arquivos

```text
supabase/functions/negociarie-proxy/index.ts    -- Edge function principal
supabase/functions/negociarie-callback/index.ts -- Webhook de callback
src/services/negociarieService.ts               -- Service frontend
src/components/integracao/NegociarieTab.tsx      -- Tab na pagina de integracao
src/components/integracao/CobrancaForm.tsx       -- Formulario de nova cobranca
src/components/integracao/CobrancasList.tsx      -- Lista de cobrancas geradas
src/components/integracao/SyncPanel.tsx          -- Painel de sincronizacao
```

### Arquivos modificados

```text
src/pages/IntegracaoPage.tsx    -- Adicionar tabs: CobCloud | Negociarie
supabase/config.toml            -- Adicionar config das novas edge functions
```

---

## Fluxo do Usuario

### 1. Configuracao (admin)
- Na pagina `/integracao`, nova aba "Negociarie"
- Botao "Testar Conexao" valida as credenciais
- Campo para configurar URL de callback

### 2. Gerar Cobranca
- A partir de um cliente/parcela pendente, admin escolhe o metodo de pagamento:
  - **Boleto**: Gera boleto com link PDF e linha digitavel
  - **Pix**: Gera QR Code com pix copia e cola
  - **Link de Cartao**: Gera link de pagamento via cartao de credito
- Dados do devedor sao preenchidos automaticamente a partir do cadastro do cliente

### 3. Acompanhamento
- Lista de cobrancas geradas com status em tempo real
- Consulta de status diretamente na API Negociarie
- Sincronizacao manual: buscar "alteradas hoje" e atualizar status locais

### 4. Recebimento automatico via Callback
- Negociarie envia POST para o webhook quando pagamento e confirmado
- Sistema atualiza status da parcela para "pago" automaticamente
- Gera notificacao para o operador responsavel
- Registra no log de auditoria

### 5. Inadimplencia
- Enviar titulos vencidos para gestao de inadimplencia na Negociarie
- Consultar titulos e acordos registrados
- Baixar parcelas de acordos

---

## Seguranca

- Credenciais `NEGOCIARIE_CLIENT_ID` e `NEGOCIARIE_CLIENT_SECRET` armazenadas como segredos do backend (nunca expostas no frontend)
- Callback verifica token SHA1 (`sha1(client_id + client_secret)`) enviado pela Negociarie
- Edge function de callback nao requer JWT mas valida identidade via token
- Inputs validados com Zod em todas as acoes
- Rate limiting respeitado (60 req/min conforme headers da API)

---

## Segredos Necessarios

Antes de implementar, sera solicitado que voce configure:
1. **NEGOCIARIE_CLIENT_ID** -- fornecido pela Negociarie ao contratar o servico
2. **NEGOCIARIE_CLIENT_SECRET** -- fornecido pela Negociarie ao contratar o servico

---

## Ordem de Implementacao

| Ordem | Etapa | Descricao |
|-------|-------|-----------|
| 1 | Segredos | Solicitar NEGOCIARIE_CLIENT_ID e CLIENT_SECRET |
| 2 | Migracao | Criar tabela `negociarie_cobrancas` |
| 3 | Edge Function proxy | Implementar `negociarie-proxy` com autenticacao e rotas |
| 4 | Edge Function callback | Implementar `negociarie-callback` para webhooks |
| 5 | Service frontend | Criar `negociarieService.ts` |
| 6 | UI Integracao | Adicionar aba Negociarie com formulario de cobranca, lista e sync |
| 7 | Fluxo de pagamento | Integrar geracao de cobranca no fluxo de parcelas (ClientsPage) |

