import { supabase } from "@/integrations/supabase/client";

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_type: string | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const fetchNotifications = async (limit = 50): Promise<Notification[]> => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as Notification[]) || [];
};

export const markNotificationRead = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as any)
    .eq("id", id);
  if (error) throw error;
};

export const markAllNotificationsRead = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true } as any)
    .eq("user_id", user.id)
    .eq("is_read", false);
  if (error) throw error;
};

export const deleteNotification = async (id: string): Promise<void> => {
  const { error } = await supabase.from("notifications").delete().eq("id", id);
  if (error) throw error;
};
