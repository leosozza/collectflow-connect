import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Circle, Clock, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { SetupStep } from "@/hooks/useTenantSetupStatus";

interface Props {
  step: SetupStep;
  index: number;
}

const STATUS_STYLES: Record<SetupStep["status"], { ring: string; iconBg: string; label: string; badge: string }> = {
  complete: {
    ring: "border-emerald-500/40 bg-emerald-500/5",
    iconBg: "bg-emerald-500 text-white",
    label: "Concluído",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
  },
  in_progress: {
    ring: "border-amber-500/40 bg-amber-500/5",
    iconBg: "bg-amber-500 text-white",
    label: "Em andamento",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/30 dark:text-amber-300",
  },
  pending: {
    ring: "border-border",
    iconBg: "bg-muted text-muted-foreground",
    label: "Pendente",
    badge: "bg-muted text-muted-foreground border-border",
  },
};

export default function SetupStepCard({ step, index }: Props) {
  const navigate = useNavigate();
  const s = STATUS_STYLES[step.status];

  return (
    <Card className={`transition-all ${s.ring}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold ${s.iconBg}`}>
            {step.status === "complete" ? (
              <Check className="w-5 h-5" />
            ) : step.status === "in_progress" ? (
              <Clock className="w-5 h-5" />
            ) : (
              <span>{index + 1}</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h3 className="font-semibold text-foreground">{step.title}</h3>
              <Badge variant="outline" className={s.badge}>
                {s.label}
              </Badge>
              {step.optional && (
                <Badge variant="outline" className="text-xs">
                  Opcional
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-1">{step.description}</p>
            <p className="text-xs text-muted-foreground/80 flex items-center gap-1.5">
              <Circle className="w-2 h-2 fill-current" />
              {step.detail}
            </p>
          </div>

          <div className="flex-shrink-0">
            <Button
              variant={step.status === "complete" ? "outline" : "default"}
              size="sm"
              onClick={() => navigate(step.ctaPath)}
              className="gap-1.5"
            >
              {step.status === "complete" ? "Revisar" : step.ctaLabel}
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
