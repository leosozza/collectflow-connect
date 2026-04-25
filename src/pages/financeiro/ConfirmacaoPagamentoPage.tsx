import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import AcordosPage from "@/pages/AcordosPage";

/**
 * Rota /financeiro/confirmacao-pagamento
 * Restrita a usuários com permissão de aprovar acordos.
 */
const ConfirmacaoPagamentoPage = () => {
  const permissions = usePermissions();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("status") !== "payment_confirmation") {
      const next = new URLSearchParams(params);
      next.set("status", "payment_confirmation");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;

  return <AcordosPage />;
};

export default ConfirmacaoPagamentoPage;
