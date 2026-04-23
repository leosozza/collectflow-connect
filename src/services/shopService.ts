import { supabase } from "@/integrations/supabase/client";

export interface ShopProduct {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_rivocoins: number;
  stock: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopOrder {
  id: string;
  tenant_id: string;
  profile_id: string;
  product_id: string;
  price_paid: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  product?: ShopProduct;
  profile?: { full_name: string };
}

const getMyTenantId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("tenant_users")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data?.tenant_id as string) || null;
};

export const fetchProducts = async (tenantId?: string): Promise<ShopProduct[]> => {
  const tid = tenantId || (await getMyTenantId());
  let query = supabase
    .from("shop_products")
    .select("*")
    .order("created_at", { ascending: false });
  if (tid) query = query.eq("tenant_id", tid);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ShopProduct[]) || [];
};

export const createProduct = async (product: Omit<ShopProduct, "id" | "created_at" | "updated_at">): Promise<void> => {
  const { error } = await supabase.from("shop_products").insert(product as any);
  if (error) throw error;
};

export const updateProduct = async (id: string, updates: Partial<ShopProduct>): Promise<void> => {
  const { error } = await supabase.from("shop_products").update({ ...updates, updated_at: new Date().toISOString() } as any).eq("id", id);
  if (error) throw error;
};

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await supabase.from("shop_products").delete().eq("id", id);
  if (error) throw error;
};

export const fetchOrders = async (profileId?: string): Promise<ShopOrder[]> => {
  const tid = await getMyTenantId();
  let query = supabase.from("shop_orders").select("*").order("created_at", { ascending: false });
  if (tid) query = query.eq("tenant_id", tid);
  if (profileId) query = query.eq("profile_id", profileId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as ShopOrder[]) || [];
};

export const createOrder = async (order: { tenant_id: string; profile_id: string; product_id: string; price_paid: number }): Promise<void> => {
  const { error } = await supabase.from("shop_orders").insert(order as any);
  if (error) throw error;
};

export const updateOrderStatus = async (id: string, status: string, adminNote?: string): Promise<void> => {
  const { error } = await supabase.from("shop_orders").update({ status, admin_note: adminNote || null, updated_at: new Date().toISOString() } as any).eq("id", id);
  if (error) throw error;
};
