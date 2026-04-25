import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import PaymentConfirmationTab from "@/components/acordos/PaymentConfirmationTab";

/**
 * Rota /financeiro/confirmacao-pagamento
 * Restrita a usuários com permissão de aprovar acordos.
 */
const ConfirmacaoPagamentoPage = () => {
  const permissions = usePermissions();
  const { tenant } = useTenant();

  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Confirmação Pagamento Manual</h1>
      {tenant?.id ? (
        <PaymentConfirmationTab tenantId={tenant.id} />
      ) : (
        <p className="text-muted-foreground">Carregando...</p>
      )}
    </div>
  );
};

export default ConfirmacaoPagamentoPage;
