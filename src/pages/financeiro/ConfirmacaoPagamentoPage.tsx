import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import PaymentConfirmationTab from "@/components/acordos/PaymentConfirmationTab";

const ConfirmacaoPagamentoPage = () => {
  const permissions = usePermissions();
  const { tenant } = useTenant();

  if (permissions.loading) return <p className="text-muted-foreground p-6">Carregando permissões...</p>;
  if (!permissions.canApproveAcordos) return <Navigate to="/financeiro/acordos" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Confirmação de Pagamento</h1>
      <p className="text-muted-foreground">
        Abaixo estão os acordos que possuem envios de comprovante aguardando conferência e baixa.
      </p>
      {tenant?.id ? (
        <PaymentConfirmationTab tenantId={tenant.id} />
      ) : (
        <p className="text-muted-foreground">Carregando dados do tenant...</p>
      )}
    </div>
  );
};

export default ConfirmacaoPagamentoPage;
