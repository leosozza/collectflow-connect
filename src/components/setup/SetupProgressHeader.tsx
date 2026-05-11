import { Progress } from "@/components/ui/progress";
import { Rocket, CheckCircle2 } from "lucide-react";

interface Props {
  completedCount: number;
  totalCount: number;
  criticalPending: number;
  setupCompletedAt: string | null;
}

export default function SetupProgressHeader({ completedCount, totalCount, criticalPending, setupCompletedAt }: Props) {
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const done = setupCompletedAt !== null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${done ? "bg-emerald-500 text-white" : "bg-primary/10 text-primary"}`}>
          {done ? <CheckCircle2 className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">
            {done ? "Setup concluído" : "Configure sua operação"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {done
              ? "Sua empresa já está pronta para operar. Você pode revisar qualquer etapa a qualquer momento."
              : "Siga as etapas abaixo para deixar a empresa pronta para operar. Cada etapa é detectada automaticamente quando você cadastra os dados nas telas correspondentes."}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <Progress value={pct} className="flex-1 h-2" />
        <span className="text-sm font-medium text-foreground tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {done
          ? "Todas as etapas críticas foram concluídas."
          : criticalPending > 0
            ? `${criticalPending} etapa(s) crítica(s) pendente(s).`
            : "Etapas críticas concluídas — pronto para finalizar o setup."}
      </p>
    </div>
  );
}
