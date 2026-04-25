import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import AcordosPage from "@/pages/AcordosPage";

const ConfirmacaoPagamentoPage = () => {
  const permissions = usePermissions();
  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;
  return <AcordosPage lockedStatus="payment_confirmation" pageTitle="Confirmação de Pagamento" />;
};

export default ConfirmacaoPagamentoPage;
