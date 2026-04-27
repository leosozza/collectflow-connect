import { useEffect } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import AcordosPage from "@/pages/AcordosPage";

/**
 * Rota /financeiro/aguardando-liberacao
 * Restrita a usuários com permissão de aprovar acordos.
 * Reaproveita a AcordosPage forçando o filtro de status na URL.
 */
const AguardandoLiberacaoPage = () => {
  const permissions = usePermissions();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("status") !== "pending_approval") {
      const next = new URLSearchParams(params);
      next.set("status", "pending_approval");
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;

  return <AcordosPage />;
};

export default AguardandoLiberacaoPage;
