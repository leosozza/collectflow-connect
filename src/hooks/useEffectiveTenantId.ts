import { useTenant } from "@/hooks/useTenant";
import { useImpersonatedTenant } from "@/hooks/useImpersonatedTenant";

/**
 * Retorna o tenant que páginas tenant-scoped (Analytics, etc.) devem usar.
 * - Super Admin com tenant de suporte selecionado → tenant alvo.
 * - Caso contrário → tenant do próprio usuário.
 */
export function useEffectiveTenantId(): {
  tenantId: string | undefined;
  isSupportMode: boolean;
  supportTenantName: string | null;
} {
  const { tenant, isSuperAdmin } = useTenant();
  const { tenantId: supportId, tenantName } = useImpersonatedTenant();

  if (isSuperAdmin && supportId) {
    return { tenantId: supportId, isSupportMode: true, supportTenantName: tenantName };
  }
  return { tenantId: tenant?.id, isSupportMode: false, supportTenantName: null };
}
