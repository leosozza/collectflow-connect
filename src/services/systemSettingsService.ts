import { supabase } from "@/integrations/supabase/client";

export const getSystemSetting = async (key: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from("system_settings" as any)
    .select("value")
    .eq("key", key)
    .single();

  if (error || !data) return null;
  return (data as any).value;
};

export const updateSystemSetting = async (key: string, value: string): Promise<void> => {
  const { error } = await supabase
    .from("system_settings" as any)
    .update({ value, updated_at: new Date().toISOString() } as any)
    .eq("key", key);

  if (error) throw error;
};
