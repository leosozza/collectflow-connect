import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ReportErrorState = ({
  message = "Não foi possível carregar os dados deste relatório.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) => (
  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
    <div className="rounded-full p-3 bg-destructive/10 text-destructive">
      <AlertTriangle className="w-5 h-5" />
    </div>
    <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
    {onRetry && (
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
      </Button>
    )}
  </div>
);
