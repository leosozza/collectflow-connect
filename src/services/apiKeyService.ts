import { supabase } from "@/integrations/supabase/client";

export interface ApiKey {
  id: string;
  tenant_id: string;
  key_prefix: string;
  label: string;
  is_active: boolean;
  last_used_at: string | null;
  created_by: string;
  created_at: string;
  revoked_at: string | null;
}

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function fetchApiKeys(tenantId: string): Promise<ApiKey[]> {
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as ApiKey[];
}

export interface GeneratedKey {
  rawToken: string;
  record: ApiKey;
}

export async function generateApiKey(
  tenantId: string,
  createdBy: string,
  label = "Nova Chave"
): Promise<GeneratedKey> {
  // Generate a cryptographically random token
  const rawBytes = new Uint8Array(32);
  crypto.getRandomValues(rawBytes);
  const rawToken =
    "cf_" +
    Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  const keyHash = await sha256(rawToken);
  const keyPrefix = rawToken.slice(0, 11); // "cf_" + 8 hex chars

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      tenant_id: tenantId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return { rawToken, record: data as ApiKey };
}

export async function revokeApiKey(id: string): Promise<void> {
  const { error } = await supabase
    .from("api_keys")
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw error;
}

export async function updateApiKeyLabel(id: string, label: string): Promise<void> {
  const { error } = await supabase.from("api_keys").update({ label }).eq("id", id);
  if (error) throw error;
}
