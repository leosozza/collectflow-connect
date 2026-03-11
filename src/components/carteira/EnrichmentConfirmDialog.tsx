import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { checkTokenBalance } from "@/services/tokenService";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Search, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

interface EnrichmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClients: { id: string; cpf: string; credor?: string }[];
  onComplete: () => void;
}

const COST_PER_CLIENT = 0.15;

const EnrichmentConfirmDialog = ({
  open,
  onOpenChange,
  selectedClients,
  onComplete,
}: EnrichmentConfirmDialogProps) => {
  const { tenant } = useTenant();
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    enriched: number;
    failed: number;
    status: string;
  } | null>(null);

  // Get unique CPFs
  const uniqueCpfs = Array.from(
    new Set(selectedClients.map((c) => c.cpf.replace(/\D/g, "")))
  );
  const totalCost = uniqueCpfs.length * COST_PER_CLIENT;
  const tokensNeeded = uniqueCpfs.length;

  useEffect(() => {
    if (open && tenant?.id) {
      setLoading(true);
      setProgress(null);
      checkTokenBalance(tenant.id, tokensNeeded)
        .then((result: any) => {
          setBalance(result?.current_balance ?? 0);
        })
        .catch(() => setBalance(0))
        .finally(() => setLoading(false));
    }
  }, [open, tenant?.id, tokensNeeded]);

  const hasSufficientBalance = balance !== null && balance >= tokensNeeded;

  const handleConfirm = async () => {
    if (!tenant?.id || !hasSufficientBalance) return;
    setProcessing(true);

    try {
      // Create enrichment job
      const { data: job, error: jobError } = await supabase
        .from("enrichment_jobs" as any)
        .insert({
          tenant_id: tenant.id,
          total_clients: uniqueCpfs.length,
          cost_per_client: COST_PER_CLIENT,
          status: "pending",
        } as any)
        .select()
        .single();

      if (jobError) throw jobError;

      const jobId = (job as any).id;

      // Invoke edge function
      const { error: fnError } = await supabase.functions.invoke(
        "targetdata-enrich",
        {
          body: {
            tenant_id: tenant.id,
            cpfs: uniqueCpfs,
            job_id: jobId,
            cost_per_client: COST_PER_CLIENT,
          },
        }
      );

      if (fnError) throw fnError;

      // Poll for results
      const { data: finalJob } = await supabase
        .from("enrichment_jobs" as any)
        .select("*")
        .eq("id", jobId)
        .single();

      const fj = finalJob as any;
      setProgress({
        total: fj?.total_clients || uniqueCpfs.length,
        enriched: fj?.enriched || 0,
        failed: fj?.failed || 0,
        status: fj?.status || "completed",
      });

      toast.success(
        `Higienização concluída! ${fj?.enriched || 0} clientes atualizados.`
      );
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar higienização");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" />
            Higienização de Base
          </DialogTitle>
          <DialogDescription>
            Enriqueça os dados cadastrais dos clientes selecionados com
            informações atualizadas de telefone, e-mail e endereço.
          </DialogDescription>
        </DialogHeader>

        {progress ? (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <span className="font-medium">Higienização concluída</span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-foreground">
                  {progress.total}
                </p>
                <p className="text-xs text-muted-foreground">Total CPFs</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">
                  {progress.enriched}
                </p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-500">
                  {progress.failed}
                </p>
                <p className="text-xs text-muted-foreground">Não encontrados</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CPFs únicos</span>
                <span className="font-medium">{uniqueCpfs.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Custo por cliente</span>
                <span className="font-medium">1 token ({formatCurrency(COST_PER_CLIENT)})</span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between text-sm font-semibold">
                <span>Custo total</span>
                <span>
                  {tokensNeeded} tokens ({formatCurrency(totalCost)})
                </span>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Verificando saldo...
              </div>
            ) : (
              <div
                className={`flex items-center gap-2 text-sm p-3 rounded-lg ${
                  hasSufficientBalance
                    ? "bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400"
                    : "bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400"
                }`}
              >
                {hasSufficientBalance ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertTriangle className="w-4 h-4" />
                )}
                <span>
                  Saldo atual: <strong>{balance} tokens</strong>
                  {!hasSufficientBalance && (
                    <> — faltam {tokensNeeded - (balance || 0)} tokens</>
                  )}
                </span>
              </div>
            )}

            {processing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processando higienização...
                </div>
                <Progress value={50} className="h-2" />
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={processing}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!hasSufficientBalance || processing || loading}
                className="gap-2"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Confirmar Higienização
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EnrichmentConfirmDialog;
