import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

const MODULE = "lockService";

export interface AtendimentoLock {
  id: string;
  tenant_id: string;
  client_id: string;
  operator_id: string;
  operator_name: string;
  channel: string | null;
  started_at: string;
  expires_at: string;
}

/** Clean expired locks then try to acquire */
export async function acquireLock(
  tenantId: string,
  clientId: string,
  operatorId: string,
  operatorName: string,
  channel?: string
): Promise<{ acquired: boolean; lock?: AtendimentoLock; existingOperator?: string }> {
  try {
    // Clean expired locks first
    await supabase.rpc("cleanup_expired_locks" as any);

    // Check existing lock
    const { data: existing } = await supabase
      .from("atendimento_locks" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing) {
      const lock = existing as any as AtendimentoLock;
      // If same operator, just renew
      if (lock.operator_id === operatorId) {
        await renewLock(tenantId, clientId, operatorId);
        return { acquired: true, lock };
      }
      // Different operator holds the lock
      return { acquired: false, existingOperator: lock.operator_name };
    }

    // Try to insert
    const { data: newLock, error } = await supabase
      .from("atendimento_locks" as any)
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        operator_id: operatorId,
        operator_name: operatorName,
        channel: channel || null,
      } as any)
      .select()
      .single();

    if (error) {
      // Unique constraint = race condition
      if (error.code === "23505") {
        const { data: retry } = await supabase
          .from("atendimento_locks" as any)
          .select("*")
          .eq("tenant_id", tenantId)
          .eq("client_id", clientId)
          .maybeSingle();
        if (retry && (retry as any).operator_id !== operatorId) {
          return { acquired: false, existingOperator: (retry as any).operator_name };
        }
        return { acquired: true, lock: retry as any };
      }
      throw error;
    }

    logger.info(MODULE, "acquired", { clientId, operatorId });
    return { acquired: true, lock: newLock as any };
  } catch (err) {
    logger.error(MODULE, "acquireLock", err);
    // Don't block operations if lock fails
    return { acquired: true };
  }
}

export async function renewLock(tenantId: string, clientId: string, operatorId: string): Promise<void> {
  try {
    await supabase
      .from("atendimento_locks" as any)
      .update({ expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() } as any)
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("operator_id", operatorId);
  } catch (err) {
    logger.error(MODULE, "renewLock", err);
  }
}

export async function releaseLock(tenantId: string, clientId: string, operatorId: string): Promise<void> {
  try {
    await supabase
      .from("atendimento_locks" as any)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId)
      .eq("operator_id", operatorId);
    logger.info(MODULE, "released", { clientId, operatorId });
  } catch (err) {
    logger.error(MODULE, "releaseLock", err);
  }
}

/** Force-take the lock (for admins/gerentes) */
export async function takeoverLock(
  tenantId: string,
  clientId: string,
  operatorId: string,
  operatorName: string,
  channel?: string
): Promise<AtendimentoLock | null> {
  try {
    // Delete existing lock
    await supabase
      .from("atendimento_locks" as any)
      .delete()
      .eq("tenant_id", tenantId)
      .eq("client_id", clientId);

    // Insert new lock
    const { data, error } = await supabase
      .from("atendimento_locks" as any)
      .insert({
        tenant_id: tenantId,
        client_id: clientId,
        operator_id: operatorId,
        operator_name: operatorName,
        channel: channel || null,
      } as any)
      .select()
      .single();

    if (error) throw error;
    logger.info(MODULE, "takeover", { clientId, operatorId });
    return data as any;
  } catch (err) {
    logger.error(MODULE, "takeoverLock", err);
    return null;
  }
}
