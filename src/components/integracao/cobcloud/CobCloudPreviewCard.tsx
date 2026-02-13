import { useState } from "react";
import { cobcloudService, type PreviewResult, type ImportFilters } from "@/services/cobcloudService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, Loader2, DatabaseBackup, FileText, CheckCircle2, Clock, AlertTriangle } from "lucide-react";

interface Props {
  hasCredentials: boolean;
  onLog: (action: string, status: "success" | "error", message: string) => void;
}

const STATUS_CONFIG = {
  aberto: { label: "Em Aberto", icon: Clock, colorClass: "text-yellow-500" },
  baixado: { label: "Pago / Quitado", icon: CheckCircle2, colorClass: "text-green-500" },
};

const CobCloudPreviewCard = ({ hasCredentials, onLog }: Props) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [preview, setPreview] = useState<(PreviewResult & { source?: string }) | null>(null);

  // Filters
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["aberto", "baixado"]);
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [cpfFilter, setCpfFilter] = useState("");

  // Import state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; pages: number; total: number; source?: string } | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setPreview(null);
    setImportResult(null);
    try {
      const dateFilters: Record<string, string> = {};
      if (dateStart && dateEnd) {
        dateFilters.date_type = "vencimento";
        dateFilters.date_value = `${dateStart},${dateEnd}`;
      }
      const result = await cobcloudService.preview(dateFilters);
      setPreview(result);
      const sourceLabel = result.source === "devedores" ? " (fonte: devedores)" : "";
      onLog("Sincronizar Preview", "success", `Total: ${result.total} registros encontrados${sourceLabel}`);
      toast({ title: "Sincronização concluída", description: `${result.total} registros encontrados${sourceLabel}` });
    } catch (e: any) {
      onLog("Sincronizar Preview", "error", e.message);
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const handleImport = async (importAll: boolean) => {
    setImporting(true);
    setImportResult(null);
    try {
      const filters: ImportFilters = {};
      if (!importAll) {
        if (selectedStatuses.length < 2) {
          filters.status = selectedStatuses.join(",");
        }
        if (dateStart && dateEnd) {
          filters.date_type = "vencimento";
          filters.date_value = `${dateStart},${dateEnd}`;
        }
        if (cpfFilter.trim()) {
          filters.cpf = cpfFilter.trim();
        }
      }

      const result = await cobcloudService.importAll(filters);
      setImportResult({ imported: result.imported, pages: result.pages, total: result.total, source: result.source });
      onLog(
        importAll ? "Importar Tudo" : "Importar Filtrado",
        "success",
        `${result.imported} registros importados de ${result.total} em ${result.pages} página(s)`
      );
      toast({ title: "Importação concluída!", description: `${result.imported} registros importados` });
    } catch (e: any) {
      onLog("Importar", "error", e.message);
      toast({ title: "Erro na importação", description: e.message, variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const selectedTotal = preview
    ? selectedStatuses.reduce((sum, s) => sum + (preview.byStatus[s] || 0), 0)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseBackup className="w-5 h-5" />
          Sincronizar e Importar Carteira
        </CardTitle>
        <CardDescription>
          Sincronize para visualizar a carteira disponível no CobCloud, aplique filtros e importe.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Step 1: Sync */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label>Data Início (opcional)</Label>
            <Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1.5">
            <Label>Data Fim (opcional)</Label>
            <Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="w-40" />
          </div>
          <Button onClick={handleSync} disabled={syncing || !hasCredentials}>
            {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar com CobCloud
          </Button>
        </div>

        {!hasCredentials && (
          <p className="text-xs text-muted-foreground">Salve as credenciais acima para sincronizar</p>
        )}

        {/* Step 2: Preview summary */}
        {preview && (
          <div className="space-y-4">
            {preview.total === 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-card-foreground">Nenhum registro encontrado</p>
                  <p className="text-muted-foreground mt-1">
                    O sistema testou os endpoints de títulos e devedores e não encontrou dados. 
                    Verifique se as credenciais estão corretas e se existem dados cadastrados no CobCloud.
                    Use o botão "Testar Conexão" acima para ver a contagem em cada endpoint.
                  </p>
                </div>
              </div>
            )}

            {preview.source && (
              <p className="text-xs text-muted-foreground">
                Fonte dos dados: <strong className="text-card-foreground">{preview.source === "devedores" ? "Endpoint de Devedores" : "Endpoint de Títulos"}</strong>
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.entries(STATUS_CONFIG) as [string, typeof STATUS_CONFIG.aberto][]).map(([key, cfg]) => {
                const count = preview.byStatus[key] || 0;
                const selected = selectedStatuses.includes(key);
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleStatus(key)}
                    className={`rounded-lg border p-4 text-left transition-all ${
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${cfg.colorClass}`} />
                      <span className="text-sm font-medium text-card-foreground">{cfg.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-card-foreground">{count.toLocaleString("pt-BR")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selected ? "✓ Selecionado" : "Clique para selecionar"}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>
                Total disponível: <strong className="text-card-foreground">{preview.total.toLocaleString("pt-BR")}</strong>
                {selectedStatuses.length < 2 && (
                  <> · Selecionados: <strong className="text-primary">{selectedTotal.toLocaleString("pt-BR")}</strong></>
                )}
              </span>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label>CPF (opcional)</Label>
                <Input
                  placeholder="000.000.000-00"
                  value={cpfFilter}
                  onChange={(e) => setCpfFilter(e.target.value)}
                  className="w-44"
                />
              </div>
            </div>

            {/* Import actions */}
            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Importando... isso pode levar alguns minutos
                </div>
                <Progress value={undefined} className="h-2" />
              </div>
            )}

            {importResult && !importing && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
                <p className="flex items-center gap-2 font-medium text-card-foreground">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  Importação finalizada
                </p>
                <p className="text-muted-foreground">
                  {importResult.imported} registros importados de {importResult.total} encontrados em {importResult.pages} página(s)
                  {importResult.source && ` (fonte: ${importResult.source})`}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => handleImport(true)} disabled={importing} variant="outline">
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
                Importar Tudo
              </Button>
              <Button onClick={() => handleImport(false)} disabled={importing || selectedStatuses.length === 0}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <DatabaseBackup className="w-4 h-4 mr-2" />}
                Importar Filtrado ({selectedTotal.toLocaleString("pt-BR")})
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CobCloudPreviewCard;
