import { supabase } from "@/integrations/supabase/client";

export interface SAModule {
  id: string;
  name: string;
  slug: string;
  sidebar_group: string;
  icon: string | null;
  route_path: string | null;
  sort_order: number;
}

export interface SAUserPermission {
  module_slug: string;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export async function fetchModules(): Promise<SAModule[]> {
  const { data, error } = await supabase
    .from("sa_modules")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return data || [];
}

export async function fetchUserPermissions(userId: string): Promise<SAUserPermission[]> {
  const { data, error } = await supabase
    .from("sa_user_permissions")
    .select("module_slug, can_view, can_create, can_edit, can_delete")
    .eq("user_id", userId);
  if (error) throw error;
  return data || [];
}

export async function saveUserPermissions(
  userId: string,
  permissions: SAUserPermission[],
  grantedBy: string
) {
  // Upsert all permissions
  const rows = permissions.map((p) => ({
    user_id: userId,
    module_slug: p.module_slug,
    can_view: p.can_view,
    can_create: p.can_create,
    can_edit: p.can_edit,
    can_delete: p.can_delete,
    granted_by: grantedBy,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from("sa_user_permissions")
    .upsert(rows, { onConflict: "user_id,module_slug" });
  if (error) throw error;
}

export async function fetchSuperAdminUsers() {
  const { data, error } = await supabase
    .from("tenant_users")
    .select("user_id, role, profiles!inner(id, full_name, user_id)")
    .eq("role", "super_admin");
  if (error) throw error;
  return data || [];
}
