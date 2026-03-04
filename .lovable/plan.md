

## Plano: Reorganização da Gamificação — RivoCoin, Loja e Rankings Editáveis

### Resumo

Criar a moeda **RivoCoin** como sistema de recompensas. Admins configuram tudo em "Gerenciar" (incluindo Rankings). Operadores veem suas conquistas, metas e carteira individualmente. Rankings e Campanhas são visíveis para todos. Uma **Loja** permite trocar RivoCoins por produtos criados pelo admin.

### Novas Tabelas (4 migrations)

#### 1. `rivocoin_wallets` — Carteira de cada operador
```sql
CREATE TABLE public.rivocoin_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  balance integer NOT NULL DEFAULT 0,
  total_earned integer NOT NULL DEFAULT 0,
  total_spent integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, profile_id)
);
ALTER TABLE public.rivocoin_wallets ENABLE ROW LEVEL SECURITY;
-- Operador vê só o seu; admin vê todos
```

#### 2. `rivocoin_transactions` — Histórico de transações
```sql
CREATE TABLE public.rivocoin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  amount integer NOT NULL,
  type text NOT NULL DEFAULT 'earn', -- 'earn' | 'spend' | 'admin_adjust'
  description text,
  reference_type text, -- 'achievement' | 'goal' | 'shop_purchase' | 'manual'
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rivocoin_transactions ENABLE ROW LEVEL SECURITY;
```

#### 3. `shop_products` — Produtos da loja
```sql
CREATE TABLE public.shop_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  price_rivocoins integer NOT NULL DEFAULT 0,
  stock integer, -- NULL = ilimitado
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_products ENABLE ROW LEVEL SECURITY;
```

#### 4. `shop_orders` — Pedidos/compras na loja
```sql
CREATE TABLE public.shop_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.shop_products(id),
  price_paid integer NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'delivered' | 'rejected'
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;
```

#### 5. `ranking_configs` — Rankings personalizáveis
```sql
CREATE TABLE public.ranking_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  metric text NOT NULL DEFAULT 'points', -- 'points' | 'total_received' | 'payments_count' | 'agreements_count'
  period text NOT NULL DEFAULT 'mensal',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ranking_configs ENABLE ROW LEVEL SECURITY;
```

### RLS

| Tabela | Operador | Admin |
|---|---|---|
| `rivocoin_wallets` | SELECT próprio | ALL do tenant |
| `rivocoin_transactions` | SELECT próprio | ALL do tenant |
| `shop_products` | SELECT (ativos) | ALL do tenant |
| `shop_orders` | SELECT/INSERT próprio | ALL do tenant |
| `ranking_configs` | SELECT | ALL do tenant |

### Alterações na Estrutura de Abas

**Visão do Operador:**
- Ranking | Campanhas | Conquistas (próprias) | Metas (gauge individual) | Loja | Carteira (RivoCoins)

**Visão do Admin (aba Gerenciar):**
- Campanhas | Conquistas | Metas | Rankings | Loja (produtos)

### Novos Arquivos

| Arquivo | Descrição |
|---|---|
| `src/services/rivocoinService.ts` | CRUD carteira, transações, saldo |
| `src/services/shopService.ts` | CRUD produtos, pedidos |
| `src/services/rankingConfigService.ts` | CRUD configurações de ranking |
| `src/components/gamificacao/WalletTab.tsx` | Carteira do operador (saldo + histórico) |
| `src/components/gamificacao/ShopTab.tsx` | Loja para operador (catálogo + compra) |
| `src/components/gamificacao/ShopManagementTab.tsx` | Admin: CRUD produtos |
| `src/components/gamificacao/RankingManagementTab.tsx` | Admin: CRUD rankings |

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| `src/pages/GamificacaoPage.tsx` | Adicionar abas Loja e Carteira; adicionar Rankings no Gerenciar |
| `src/components/gamificacao/RankingTab.tsx` | Ler de `ranking_configs` para listar rankings dinâmicos |
| `src/components/gamificacao/AchievementsTab.tsx` | Operador vê só as suas (já funciona assim), remover `ACHIEVEMENT_DEFINITIONS` hardcoded |
| `src/pages/PerfilPage.tsx` | Adicionar card de saldo RivoCoin e conquistas individuais |
| `src/hooks/useGamification.ts` | Ao conceder conquista, creditar RivoCoins na carteira |
| `src/services/gamificationService.ts` | Remover `ACHIEVEMENT_DEFINITIONS` hardcoded |

### Fluxo RivoCoin

1. Admin cria achievement template com `points_reward` (= RivoCoins ganhos)
2. Ao atingir conquista ou meta → `rivocoin_transactions` INSERT tipo `earn` + atualizar `rivocoin_wallets.balance`
3. Operador vai na Loja → compra produto → INSERT `shop_orders` + `rivocoin_transactions` tipo `spend` + deduz `balance`
4. Admin aprova/rejeita pedido

### Visibilidade Individual

- **Conquistas**: operador vê apenas as suas (já implementado)
- **Metas**: operador vê apenas a sua meta (já implementado)
- **Carteira/Loja**: operador vê seu saldo e seus pedidos
- **Ranking**: todos veem (público no tenant)
- **Campanhas**: todos veem (público no tenant)
- **Perfil**: mostra conquistas, saldo RivoCoin e pedidos do operador

