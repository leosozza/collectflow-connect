import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchOrders, updateOrderStatus, ShopProduct, ShopOrder } from "@/services/shopService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Package, ShoppingBag, Coins } from "lucide-react";

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovado",
  delivered: "Entregue",
  rejected: "Rejeitado",
};

const ShopManagementTab = () => {
  const { tenantUser } = useTenant();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ShopProduct | null>(null);
  const [form, setForm] = useState({ name: "", description: "", image_url: "", price_rivocoins: 0, stock: "" as string });

  const { data: products = [] } = useQuery({
    queryKey: ["shop-products-admin"],
    queryFn: () => fetchProducts(),
  });

  const { data: orders = [] } = useQuery({
    queryKey: ["shop-orders-admin"],
    queryFn: () => fetchOrders(),
  });

  // Fetch profiles for orders
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-orders"],
    queryFn: async () => {
      const ids = [...new Set(orders.map(o => o.profile_id))];
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return data || [];
    },
    enabled: orders.length > 0,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.id, p.full_name]));

  // Fetch product names for orders
  const productMap = new Map(products.map(p => [p.id, p.name]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantUser!.tenant_id,
        name: form.name,
        description: form.description || null,
        image_url: form.image_url || null,
        price_rivocoins: form.price_rivocoins,
        stock: form.stock === "" ? null : Number(form.stock),
        is_active: true,
      };
      if (editingProduct) {
        await updateProduct(editingProduct.id, payload);
      } else {
        await createProduct(payload as any);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-products-admin"] });
      queryClient.invalidateQueries({ queryKey: ["shop-products"] });
      toast.success(editingProduct ? "Produto atualizado!" : "Produto criado!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar produto"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-products-admin"] });
      toast.success("Produto removido!");
    },
  });

  const orderMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await updateOrderStatus(id, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-orders-admin"] });
      toast.success("Status do pedido atualizado!");
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingProduct(null);
    setForm({ name: "", description: "", image_url: "", price_rivocoins: 0, stock: "" });
  };

  const openEdit = (p: ShopProduct) => {
    setEditingProduct(p);
    setForm({
      name: p.name,
      description: p.description || "",
      image_url: p.image_url || "",
      price_rivocoins: p.price_rivocoins,
      stock: p.stock !== null ? String(p.stock) : "",
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Produtos</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1.5"><ShoppingBag className="w-3.5 h-3.5" /> Pedidos</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 space-y-4">
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Novo Produto
          </Button>

          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum produto criado ainda.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {products.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">{p.name}</h4>
                        {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="gap-1"><Coins className="w-3 h-3" />{p.price_rivocoins}</Badge>
                          <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                          {p.stock !== null && <span className="text-xs text-muted-foreground">Estoque: {p.stock}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum pedido ainda.</p>
          ) : (
            <div className="space-y-3">
              {orders.map((o) => (
                <Card key={o.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{productMap.get(o.product_id) || "Produto"}</p>
                        <p className="text-xs text-muted-foreground">
                          👤 {profileMap.get(o.profile_id) || "Operador"} · {o.price_paid} RC
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={o.status === "delivered" ? "default" : o.status === "rejected" ? "destructive" : "secondary"}>
                          {statusLabels[o.status] || o.status}
                        </Badge>
                        {o.status === "pending" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="default" onClick={() => orderMutation.mutate({ id: o.id, status: "approved" })}>
                              Aprovar
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => orderMutation.mutate({ id: o.id, status: "rejected" })}>
                              Rejeitar
                            </Button>
                          </div>
                        )}
                        {o.status === "approved" && (
                          <Button size="sm" onClick={() => orderMutation.mutate({ id: o.id, status: "delivered" })}>
                            Marcar Entregue
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Product Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div>
              <Label>URL da Imagem</Label>
              <Input value={form.image_url} onChange={(e) => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (RivoCoins) *</Label>
                <Input type="number" min={0} value={form.price_rivocoins} onChange={(e) => setForm(f => ({ ...f, price_rivocoins: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Estoque (vazio = ilimitado)</Label>
                <Input type="number" min={0} value={form.stock} onChange={(e) => setForm(f => ({ ...f, stock: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
              {editingProduct ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopManagementTab;
