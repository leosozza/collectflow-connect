import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useTenant } from "@/hooks/useTenant";
import { fetchAgreements, Agreement } from "@/services/agreementService";
import AgreementsList from "@/components/acordos/AgreementsList";
import { useToast } from "@/hooks/use-toast";

const AguardandoLiberacaoPage = () => {
  const permissions = usePermissions();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!tenant?.id) return;
      setLoading(true);
      try {
        const data = await fetchAgreements(tenant.id, { status: "pending_approval" });
        setAgreements(data);
      } catch (err: any) {
        toast({ title: "Erro", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenant?.id, toast]);

  if (permissions.loading) return <p className="text-muted-foreground p-6">Carregando...</p>;
  if (!permissions.canApproveAcordos) return <Navigate to="/financeiro/acordos" replace />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Aguardando Liberação</h1>
      <p className="text-muted-foreground">
        Acordos que foram gerados fora da política padrão e aguardam aprovação de um supervisor.
      </p>
      {loading ? (
        <p className="text-muted-foreground">Carregando acordos pendentes...</p>
      ) : (
        <AgreementsList agreements={agreements} />
      )}
    </div>
  );
};

export default AguardandoLiberacaoPage;
