import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import AcordosPage from "@/pages/AcordosPage";

const AguardandoLiberacaoPage = () => {
  const permissions = usePermissions();
  if (permissions.loading) return null;
  if (!permissions.canApproveAcordos) return <Navigate to="/acordos" replace />;
  return <AcordosPage lockedStatus="pending_approval" pageTitle="Aguardando Liberação" />;
};

export default AguardandoLiberacaoPage;
