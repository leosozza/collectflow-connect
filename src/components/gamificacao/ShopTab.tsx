import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { fetchProducts, createOrder, ShopProduct } from "@/services/shopService";
import { fetchMyWallet, spendRivoCoins } from "@/services/rivocoinService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShoppingCart, Coins, Package } from "lucide-react";

const ShopTab = () => {
  const { profile } = useAuth();
  const { tenantUser } = useTenant();
  const queryClient = useQueryClient();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["shop-products"],
    queryFn: () => fetchProducts(),
  });

  const { data: wallet } = useQuery({
    queryKey: ["rivocoin-wallet", profile?.id],
    queryFn: () => fetchMyWallet(profile!.id),
    enabled: !!profile?.id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (product: ShopProduct) => {
      if (!profile?.id || !tenantUser?.tenant_id) throw new Error("Não autenticado");

      await spendRivoCoins({
        tenant_id: tenantUser.tenant_id,
        profile_id: profile.id,
        amount: product.price_rivocoins,
        description: `Compra: ${product.name}`,
        reference_type: "shop_purchase",
        reference_id: product.id,
      });

      await createOrder({
        tenant_id: tenantUser.tenant_id,
        profile_id: profile.id,
        product_id: product.id,
        price_paid: product.price_rivocoins,
      });

      // Notify admins, gerentes, supervisors via secure RPC (best-effort)
      try {
        const { data: responsaveis } = await supabase
          .from("tenant_users")
          .select("user_id")
          .eq("tenant_id", tenantUser.tenant_id)
          .in("role", ["admin", "super_admin", "gerente", "supervisor"]);

        if (responsaveis && responsaveis.length > 0) {
          const operatorName = profile.full_name || "Operador";
          const message = `${operatorName} comprou "${product.name}" por ${product.price_rivocoins.toLocaleString("pt-BR")} RivoCoins`;
          for (const r of responsaveis) {
            if (r.user_id === profile.user_id) continue;
            await supabase.rpc("create_notification" as any, {
              _tenant_id: tenantUser.tenant_id,
              _user_id: r.user_id,
              _title: "Nova compra na Loja",
              _message: message,
              _type: "info",
              _reference_type: "shop_order",
            }).catch(() => null);
          }
        }
      } catch (e) {
        console.error("Erro ao enviar notificações de compra:", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rivocoin-wallet"] });
      queryClient.invalidateQueries({ queryKey: ["rivocoin-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["shop-products"] });
      toast.success("Compra realizada com sucesso! Aguarde a aprovação do admin.");
    },
    onError: (err: any) => {
      toast.error(err.message || "Erro ao realizar compra");
    },
  });

  const balance = wallet?.balance || 0;

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground text-sm">Carregando loja...</div>;
  }

  const activeProducts = products.filter(p => p.is_active);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Troque seus RivoCoins por produtos</p>
        <Badge variant="outline" className="gap-1">
          <Coins className="w-3.5 h-3.5" />
          {balance.toLocaleString("pt-BR")} RivoCoins
        </Badge>
      </div>

      {activeProducts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          Nenhum produto disponível na loja ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeProducts.map((product) => {
            const canAfford = balance >= product.price_rivocoins;
            const outOfStock = product.stock !== null && product.stock <= 0;

            return (
              <Card key={product.id} className="overflow-hidden">
                {product.image_url && (
                  <div className="aspect-video bg-muted">
                    <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className={`p-4 ${!product.image_url ? "pt-4" : ""}`}>
                  <h3 className="font-semibold text-foreground">{product.name}</h3>
                  {product.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{product.description}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-primary font-bold">
                      <Coins className="w-4 h-4" />
                      {product.price_rivocoins.toLocaleString("pt-BR")}
                    </div>
                    {product.stock !== null && (
                      <span className="text-xs text-muted-foreground">{product.stock} em estoque</span>
                    )}
                  </div>
                  <Button
                    className="w-full mt-3"
                    size="sm"
                    disabled={!canAfford || outOfStock || purchaseMutation.isPending}
                    onClick={() => purchaseMutation.mutate(product)}
                  >
                    <ShoppingCart className="w-4 h-4 mr-1" />
                    {outOfStock ? "Esgotado" : !canAfford ? "Saldo insuficiente" : "Comprar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ShopTab;
