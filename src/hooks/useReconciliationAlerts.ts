import { useQuery } from "@tanstack/react-query";
import { listAlertsForAgreement, type ReconciliationAlert } from "@/services/reconciliationAlertService";

export function useReconciliationAlerts(agreementId: string | undefined, tenantId: string | undefined) {
  return useQuery<ReconciliationAlert[]>({
    queryKey: ["reconciliation-alerts", tenantId, agreementId],
    queryFn: () => listAlertsForAgreement(agreementId!, tenantId!),
    enabled: !!agreementId && !!tenantId,
    staleTime: 30_000,
  });
}
