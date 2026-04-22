

## Auditoria do filtro "Sem disparo de WhatsApp"

### Diagnóstico

O filtro **funciona parcialmente, mas está incompleto**. Hoje ele só considera disparos via **Campanhas em Massa**, ignorando todos os outros canais de envio do Rivo.

**Onde o filtro vive:** RPC `get_carteira_grouped` (linhas 102–112) faz `NOT EXISTS` em `whatsapp_campaign_recipients`.

**Problema:** o Rivo envia mensagens por **5 caminhos diferentes**:

| Caminho | Tabela onde grava | Considerado hoje? |
|---|---|---|
| Campanhas em massa (`send-bulk-whatsapp`) | `whatsapp_campaign_recipients` | ✅ Sim |
| Atendimento 1-a-1 (`send-chat-message`) | `chat_messages` (direction=`outbound`) | ❌ Não |
| Régua de cobrança (`send-notifications`) | `chat_messages` | ❌ Não |
| Workflows / Automação (`workflow-engine`) | `chat_messages` | ❌ Não |
| API REST pública (`clients-api/whatsapp/send`) | `chat_messages` | ❌ Não |

Resultado: marcar "Sem disparo de WhatsApp" **mostra clientes que já receberam mensagens via atendimento, régua, workflow ou API**, contradizendo a expectativa do usuário ("nunca tivemos contato via Rivo").

**Bugs adicionais encontrados na sub-CTE atual:**

1. **Ignora `assigned_instance_id`** — Se um destinatário foi enfileirado mas a campanha foi cancelada antes de despachar, ainda assim aparece como "teve disparo". Deveria filtrar por `status IN ('sent','delivered','read')` (ou pelo menos `sent_at IS NOT NULL`) para considerar apenas envios efetivos.
2. **Não usa `client_profiles`** — A consolidação canônica de CPF está em `client_profiles`. CPFs com pontuação diferente já estão normalizados via `replace`, então OK, mas seria mais limpo via JOIN canônico. (Não-bloqueante.)

### Correção proposta

Reescrever apenas o bloco `sem_whatsapp_filter` da RPC `get_carteira_grouped` para considerar **ambas as fontes** com envios **efetivamente realizados**:

```sql
sem_whatsapp_filter AS (
  SELECT s.* FROM sem_acordo_filter s
  WHERE NOT _sem_whatsapp OR (
    -- Sem envio efetivo via campanha
    NOT EXISTS (
      SELECT 1 FROM whatsapp_campaign_recipients r
      JOIN clients cl ON cl.id = r.representative_client_id
      WHERE cl.tenant_id = _tenant_id
        AND r.sent_at IS NOT NULL
        AND r.status IN ('sent','delivered','read')
        AND regexp_replace(cl.cpf,'\D','','g') = regexp_replace(s.cpf,'\D','','g')
        AND cl.credor = s.credor
    )
    -- E sem mensagem outbound em atendimento/régua/workflow/API
    AND NOT EXISTS (
      SELECT 1 FROM chat_messages cm
      JOIN whatsapp_conversations wc ON wc.id = cm.conversation_id
      JOIN clients cl ON cl.id = wc.client_id
      WHERE cm.tenant_id = _tenant_id
        AND cm.direction = 'outbound'
        AND regexp_replace(cl.cpf,'\D','','g') = regexp_replace(s.cpf,'\D','','g')
        AND cl.credor = s.credor
    )
  )
)
```

Critério "teve disparo" = pelo menos uma mensagem **outbound** (em qualquer canal interno) associada ao mesmo CPF + Credor do agrupamento da carteira.

### Validação

Após aplicar a migration, vou executar as seguintes verificações:

1. Contar CPFs totais na carteira do tenant ativo.
2. Contar CPFs com pelo menos 1 disparo (campanha OU chat outbound).
3. Rodar a RPC com `_sem_whatsapp = true` e confirmar que `total_count = total - com_disparo`.
4. Pegar 3 CPFs de amostra retornados e confirmar via SQL que **nenhum** deles aparece em `whatsapp_campaign_recipients` (com sent_at) nem em `chat_messages` (outbound).

### Arquivos alterados

- **Migration SQL** (via tool de migração): `CREATE OR REPLACE FUNCTION public.get_carteira_grouped(...)` com o bloco `sem_whatsapp_filter` corrigido. Demais parâmetros e lógica permanecem idênticos.

### Fora de escopo

- UI do checkbox (já correto, passa `semWhatsapp: true` corretamente).
- `clientService.ts` (já mapeia para `_sem_whatsapp`).
- Adicionar contadores na UI ("X clientes sem disparo") — não foi pedido.

### Próximo passo

Confirme **"Aplicar correção"** e eu publico a migration + rodo a bateria de validação trazendo o relatório com os números antes/depois.

