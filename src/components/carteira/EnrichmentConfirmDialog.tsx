import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { checkTokenBalance } from "@/services/tokenService";
import { formatCurrency } from "@/lib/formatters";
import { logAction } from "@/services/auditService";
import { exportToExcel } from "@/lib/exportUtils";
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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Search, AlertTriangle, CheckCircle2, Loader2, Copy, Download,
} from "lucide-react";

interface EnrichmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClients: { id: string; cpf: string; credor?: string }[];
  onComplete: () => void;
}

interface EnrichmentLog {
  id: string;
  cpf: string;
  status: string;
  phones_found: string[] | null;
  emails_found: string[] | null;
  error_message: string | null;
}

const COST_PER_CLIENT = 0.15;

const extractFromDataReturned = (raw: any) => {
  const phones: string[] = [];
  if (Array.isArray(raw?.telefones)) {
    raw.telefones.forEach((t: any) => {
      const num = typeof t === "string" ? t : t.numero || t.telefone || "";
      if (num) phones.push(num);
    });
  } else if (raw?.celular) phones.push(String(raw.celular));

  const emails: string[] = [];
  if (Array.isArray(raw?.emails)) {
    raw.emails.forEach((e: any) => {
      const addr = typeof e === "string" ? e : e.email || "";
      if (addr) emails.push(addr);
    });
  } else if (raw?.email) emails.push(raw.email);

  return { phones, emails, error: raw?.error || null };
};

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
  const [logs, setLogs] = useState<EnrichmentLog[]>([]);
  const [progress, setProgress] = useState<{
    total: number;
    enriched: number;
    failed: number;
    status: string;
  } | null>(null);

  const uniqueCpfs = Array.from(
    new Set(selectedClients.map((c) => c.cpf.replace(/\D/g, "")))
  );
  const totalCost = uniqueCpfs.length * COST_PER_CLIENT;
  const tokensNeeded = uniqueCpfs.length;

  useEffect(() => {
    if (open && tenant?.id) {
      setLoading(true);
      setProgress(null);
      setLogs([]);
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

      // Fetch final job status
      const { data: finalJob } = await supabase
        .from("enrichment_jobs" as any)
        .select("*")
        .eq("id", jobId)
        .single();

      const fj = finalJob as any;
      const enriched = fj?.enriched || 0;
      const failed = fj?.failed || 0;

      setProgress({
        total: fj?.total_clients || uniqueCpfs.length,
        enriched,
        failed,
        status: fj?.status || "completed",
      });

      // Fetch enrichment logs for this job
      const { data: jobLogs } = await supabase
        .from("enrichment_logs" as any)
        .select("*")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true });

      if (jobLogs) {
        setLogs(
          (jobLogs as any[]).map((l) => ({
            id: l.id,
            cpf: l.cpf,
            status: l.status,
            phones_found: l.phones_found,
            emails_found: l.emails_found,
            error_message: l.error_message,
          }))
        );
      }

      // Audit log
      await logAction({
        action: "enrichment",
        entity_type: "enrichment_job",
        entity_id: jobId,
        details: {
          cpfs: uniqueCpfs.length,
          enriched,
          failed,
          cost: totalCost,
        },
      });

      const logText = (jobLogs as any[] || []).map((l: any) => {
        const st = l.status === "success" ? "✅" : "❌";
        const phones = l.phones_found?.length ? l.phones_found.join(", ") : "-";
        const emails = l.emails_found?.length ? l.emails_found.join(", ") : "-";
        return `${st} CPF: ${l.cpf} | Telefones: ${phones} | Email: ${emails}${l.error_message ? ` | Erro: ${l.error_message}` : ""}`;
      }).join("\n");

      toast(`Higienização concluída! ${enriched} atualizados, ${failed} não encontrados.`, {
        duration: Infinity,
        dismissible: true,
        action: {
          label: "Copiar Log",
          onClick: () => {
            const header = `Higienização — ${enriched} atualizados, ${failed} falhos de ${uniqueCpfs.length} total`;
            navigator.clipboard.writeText(`${header}\n${"─".repeat(60)}\n${logText}`);
            toast.success("Log copiado!");
          },
        },
      });
      onComplete();
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar higienização");
    } finally {
      setProcessing(false);
    }
  };

  const handleCopyLog = () => {
    const lines = logs.map((l) => {
      const status = l.status === "success" ? "✅" : "❌";
      const phones = l.phones_found?.length ? l.phones_found.join(", ") : "-";
      const emails = l.emails_found?.length ? l.emails_found.join(", ") : "-";
      return `${status} CPF: ${l.cpf} | Telefones: ${phones} | Email: ${emails}${l.error_message ? ` | Erro: ${l.error_message}` : ""}`;
    });
    const header = `Higienização — ${progress?.enriched || 0} atualizados, ${progress?.failed || 0} falhos de ${progress?.total || 0} total`;
    navigator.clipboard.writeText(`${header}\n${"─".repeat(60)}\n${lines.join("\n")}`);
    toast.success("Log copiado para a área de transferência");
  };

  const handleExportExcel = () => {
    const rows = logs.map((l) => ({
      CPF: l.cpf,
      Status: l.status === "success" ? "Atualizado" : "Não encontrado",
      Telefones: l.phones_found?.join(", ") || "-",
      Emails: l.emails_found?.join(", ") || "-",
      Erro: l.error_message || "-",
    }));
    exportToExcel(rows, "Higienização", `higienizacao_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
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

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-muted rounded-lg p-3">
                <p className="text-2xl font-bold text-foreground">{progress.total}</p>
                <p className="text-xs text-muted-foreground">Total CPFs</p>
              </div>
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{progress.enriched}</p>
                <p className="text-xs text-muted-foreground">Atualizados</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-3">
                <p className="text-2xl font-bold text-red-500">{progress.failed}</p>
                <p className="text-xs text-muted-foreground">Não encontrados</p>
              </div>
            </div>

            {/* Detailed logs table */}
            {logs.length > 0 && (
              <ScrollArea className="h-[260px] rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">CPF</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Telefones</TableHead>
                      <TableHead className="text-xs">Email</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-xs font-mono">{log.cpf}</TableCell>
                        <TableCell>
                          {log.status === "success" ? (
                            <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-700">Atualizado</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">Não encontrado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.phones_found?.join(", ") || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.emails_found?.join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={handleCopyLog} disabled={logs.length === 0} className="gap-1.5">
                <Copy className="w-3.5 h-3.5" /> Copiar Log
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={logs.length === 0} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Exportar Excel
              </Button>
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
