import { useEffect, useState, useCallback } from "react";

const KEY = "support_tenant_id";
const NAME_KEY = "support_tenant_name";
const EVT = "support-tenant-changed";

function readId(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function readName(): string | null {
  try {
    return sessionStorage.getItem(NAME_KEY);
  } catch {
    return null;
  }
}

/**
 * Modo suporte do Super Admin. Mantém o tenant alvo em sessionStorage
 * (escopo da aba). Não persiste após fechar a aba — sai do modo suporte
 * automaticamente.
 *
 * Não confunde com `useTenant`: super admin não tem tenant_users.
 * O guard de RPC (`can_access_tenant`) libera por `is_super_admin`.
 */
export function useImpersonatedTenant() {
  const [tenantId, setTenantIdState] = useState<string | null>(readId);
  const [tenantName, setTenantNameState] = useState<string | null>(readName);

  useEffect(() => {
    const handler = () => {
      setTenantIdState(readId());
      setTenantNameState(readName());
    };
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const setTenant = useCallback((id: string | null, name?: string | null) => {
    try {
      if (id) {
        sessionStorage.setItem(KEY, id);
        if (name) sessionStorage.setItem(NAME_KEY, name);
      } else {
        sessionStorage.removeItem(KEY);
        sessionStorage.removeItem(NAME_KEY);
      }
    } catch {}
    window.dispatchEvent(new Event(EVT));
  }, []);

  const clear = useCallback(() => setTenant(null), [setTenant]);

  return { tenantId, tenantName, setTenant, clear };
}
