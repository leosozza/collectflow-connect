

## Plano: Notificação de compra na loja para responsáveis

### Problema
Quando um operador compra na loja, nenhuma notificação é enviada. O admin/supervisor/gerente só descobre ao verificar manualmente a aba de pedidos.

### Solução
Ao criar um pedido na loja, enviar uma notificação (sininho) para todos os admins e gerentes do tenant, e para o supervisor direto do operador (líder da equipe).

### Alteração

**`src/components/gamificacao/ShopTab.tsx`** — após `createOrder`, chamar uma função que insere notificações para os responsáveis:

1. Buscar todos os profiles do tenant com role `admin`, `gerente`, ou `supervisor`
2. Inserir uma notificação para cada um via `supabase.from("notifications").insert(...)` com:
   - `type: "info"`
   - `reference_type: "shop_order"`
   - `title: "Nova compra na Loja"`
   - `message: "{nome do operador} comprou {nome do produto} por {X} RivoCoins"`
3. O sininho já escuta notificações em tempo real (`useNotifications` com realtime subscription), então aparecerá instantaneamente

### Alternativa (mais robusta)
Criar um trigger no banco na tabela `shop_orders` (INSERT) que insere notificações automaticamente via função `SECURITY DEFINER`. Isso garante que funcione mesmo se a compra vier de outro fluxo futuro.

**Recomendação**: implementar no código do frontend por simplicidade, já que a compra só acontece pelo ShopTab.

| Arquivo | Alteração |
|---|---|
| `src/components/gamificacao/ShopTab.tsx` | Após criar pedido, buscar responsáveis e inserir notificações |

