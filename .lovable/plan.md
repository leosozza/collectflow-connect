

## Diagnóstico confirmado — Conversa da Valéria (44 9973-2338) não aparece para Maria Eduarda

### Dados reais no banco

| Campo | Valor |
|---|---|
| Conversa | `48bba162-ecf7-44fd-8abe-a991aed3373f` |
| Contato | Valeria — `554499732338` |
| Instância | Maria Eduarda Acordo (`1872b1c5-...`) — `connected` |
| Status | **`open`** (não é waiting, não é grupo) |
| `assigned_to` | **NULL** (ninguém atribuído) |
| `client_id` | **NULL** (número não bateu com nenhum cadastro) |
| Unread | 2 |
| Maria Eduarda vinculada à instância? | ✅ Sim (`operator_instances`) |
| `whatsapp_visibility.open_statuses` configurado? | ❌ **NULL** |

### Causa-raiz

A RPC `get_visible_conversations` define o que um **operador** enxerga. Ela retorna a conversa se **qualquer uma** das condições abaixo for verdadeira:

1. ✅ `c.assigned_to = meu profile_id` → aqui é NULL, falha
2. ✅ Cliente vinculado com `clients.operator_id = meu profile_id` → `client_id` é NULL, falha
3. ✅ Existe transferência ativa para mim → não existe, falha
4. ✅ `clients.status` está em `tenants.settings.whatsapp_visibility.open_statuses` → `open_statuses` é NULL, falha

**Nenhuma condição é satisfeita.** O vínculo em `operator_instances` **não é consultado** pela RPC — ele só serve para UI de envio, não para visibilidade da inbox. Por isso a Maria Eduarda não vê a conversa, mesmo estando vinculada à instância correta.

Esse é um padrão que afeta **todas as conversas inbound de números desconhecidos** (sem `client_id` e sem atribuição) — elas ficam órfãs e invisíveis para operadores. Só admins veem.

### Correção (cirúrgica, 1 arquivo)

Adicionar uma **5ª regra de visibilidade** à RPC `get_visible_conversations`:

> Operador enxerga conversas **da instância à qual está vinculado em `operator_instances`**, desde que estejam **sem atribuição** (`assigned_to IS NULL`) e **sem cliente vinculado** (`client_id IS NULL`) — ou seja, conversas "mar aberto" daquela instância.

Justificativa: é exatamente a lógica de "Carteira Mar Aberto" aplicada ao WhatsApp — se a operadora é dona daquela instância, ela deve ver as conversas novas órfãs que chegam ali. Quando alguém aceitar/atribuir, as outras regras (1 e 2) voltam a valer.

**Migração SQL** — substituir o bloco `WHERE ... visible AS` na RPC adicionando:

```sql
OR (
  c.assigned_to IS NULL
  AND c.client_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.operator_instances oi
    WHERE oi.profile_id = _profile_id
      AND oi.instance_id = c.instance_id
  )
)
```

Aplicar o mesmo acréscimo na RPC irmã `get_visible_conversation_counts` (para os contadores Abertas/Aguardando/Fechadas baterem com a lista).

### Efeito

- Maria Eduarda passa a ver Valeria + as outras **55 conversas sem atribuição** da instância "Maria Eduarda Acordo".
- Não expõe nada indevido: operador só vê órfãs das instâncias **às quais já foi vinculado** pelo admin.
- Conversas com `assigned_to` de outro operador ou com `client_id` de outro operador continuam invisíveis (regras existentes).
- Admin: sem mudança (já vê tudo).

### Sem alteração
- Código front-end, RLS de tabelas, edge functions, webhook de ingestão, schema.
- Apenas 2 RPCs atualizadas via migração.

### Arquivo
- Nova migração SQL: recria `get_visible_conversations` e `get_visible_conversation_counts` com a regra adicional (~10 linhas a mais em cada).

