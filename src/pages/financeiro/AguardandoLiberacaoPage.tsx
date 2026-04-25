import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { fetchAgreements } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import { Loader2 } from "lucide-react";

/**
 * Rota /financeiro/aguardando-liberacao
 * Restrita a usuários com permissão de aprovar acordos.
 */
const AguardandoLiberacaoPage = () => {
  const permissions = usePermissions();
  const { tenant } = useTenant();

  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ["agreements-pending-approval", tenant?.id],
    queryFn: () => fetchAgreements(tenant?.id || "", { excludeFinal: true }),
    enabled: !!tenant?.id,
  });

  // Filtra apenas os acordos que estão aguardando liberação
  const pendingAgreements = agreements.filter(a => a.status === "pending_approval");

  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aguardando Liberação</h1>
      
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin w-8 h-8 text-primary" />
        </div>
      ) : pendingAgreements.length === 0 ? (
        <div className="text-center p-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
          Nenhum acordo aguardando liberação no momento.
        </div>
      ) : (
        <AgreementsList agreements={pendingAgreements} />
      )}
    </div>
  );
};

export default AguardandoLiberacaoPage;
