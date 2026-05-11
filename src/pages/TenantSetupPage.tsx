import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rocket, CheckCircle2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { useTenantSetupStatus } from "@/hooks/useTenantSetupStatus";
import { tenantSetupService } from "@/services/tenantSetupService";
import SetupStepCard from "@/components/setup/SetupStepCard";
import SetupProgressHeader from "@/components/setup/SetupProgressHeader";

export default function TenantSetupPage() {
  const navigate = useNavigate();
  const { tenant, isTenantAdmin } = useTenant();
  const { steps, completedCount, totalCount, criticalPending, setupCompletedAt, loading, refetch } = useTenantSetupStatus();
  const [submitting, setSubmitting] = useState(false);

  if (!isTenantAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <h1 className="text-xl font-bold text-foreground">Acesso restrito</h1>
        <p className="text-muted-foreground mt-2">
          Apenas administradores da empresa podem acessar o setup.
        </p>
      </div>
    );
  }

  const canComplete = criticalPending === 0 && !setupCompletedAt;

  const handleComplete = async () => {
    if (!tenant?.id) return;
    setSubmitting(true);
    try {
      await tenantSetupService.completeSetup(tenant.id);
      toast.success("Setup concluído! Sua empresa está pronta para operar.");
      await refetch();
      try { sessionStorage.removeItem("setup-banner-dismissed"); } catch {}
    } catch (e: any) {
      toast.error(e?.message || "Erro ao concluir setup");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!tenant?.id) return;
    if (!confirm("Reabrir o setup? Você poderá revisar e concluir novamente.")) return;
    setSubmitting(true);
    try {
      await tenantSetupService.resetSetup(tenant.id);
      toast.success("Setup reaberto");
      await refetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reabrir setup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-12">
      <SetupProgressHeader
        completedCount={completedCount}
        totalCount={totalCount}
        criticalPending={criticalPending}
        setupCompletedAt={setupCompletedAt}
      />

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando status...</div>
      ) : (
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <SetupStepCard key={step.id} step={step} index={idx} />
          ))}
        </div>
      )}

      {/* Final go-live card */}
      <Card className={canComplete ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${setupCompletedAt ? "bg-emerald-500 text-white" : canComplete ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
              {setupCompletedAt ? <CheckCircle2 className="w-6 h-6" /> : <Rocket className="w-6 h-6" />}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Pronto para operar?</h3>
              <p className="text-sm text-muted-foreground">
                {setupCompletedAt
                  ? `Setup concluído em ${new Date(setupCompletedAt).toLocaleString("pt-BR")}.`
                  : canComplete
                    ? "Todas as etapas críticas estão verdes. Você pode concluir o setup."
                    : `Conclua as ${criticalPending} etapa(s) crítica(s) pendente(s) para finalizar.`}
              </p>
            </div>
            {setupCompletedAt ? (
              <Button variant="outline" onClick={handleReset} disabled={submitting} className="gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Reabrir setup
              </Button>
            ) : (
              <Button onClick={handleComplete} disabled={!canComplete || submitting} className="gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {submitting ? "Salvando..." : "Concluir Setup"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-center pt-2">
        <Button variant="ghost" onClick={() => navigate("/dashboard")}>
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
}
