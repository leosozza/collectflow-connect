import { useNavigate } from "react-router-dom";
import { Rocket, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useTenantSetupStatus } from "@/hooks/useTenantSetupStatus";
import { useTenant } from "@/hooks/useTenant";

export default function SetupBanner() {
  const navigate = useNavigate();
  const { isTenantAdmin } = useTenant();
  const { criticalPending, setupCompletedAt, loading } = useTenantSetupStatus();
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem("setup-banner-dismissed") === "1"; } catch { return false; }
  });

  if (!isTenantAdmin) return null;
  if (loading) return null;
  if (setupCompletedAt) return null;
  if (criticalPending === 0) return null;
  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try { sessionStorage.setItem("setup-banner-dismissed", "1"); } catch {}
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
        <Rocket className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">
          Termine de configurar sua empresa
        </p>
        <p className="text-xs text-muted-foreground">
          {criticalPending} etapa(s) crítica(s) pendente(s) para deixar a operação pronta.
        </p>
      </div>
      <Button size="sm" onClick={() => navigate("/setup")} className="gap-1.5 flex-shrink-0">
        Continuar setup
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
      <Button size="icon" variant="ghost" onClick={handleDismiss} className="h-7 w-7 flex-shrink-0" title="Ocultar até a próxima sessão">
        <X className="w-4 h-4" />
      </Button>
    </div>
  );
}
