import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { usePermissions } from "@/hooks/usePermissions";
import {
  fetchManagedCampaigns,
  fetchCampaignDashboardStats,
  CampaignWithStats,
} from "@/services/campaignManagementService";
import {
  cancelScheduledCampaign,
  pauseRecurringCampaign,
  resumeRecurringCampaign,
  fireNowScheduledCampaign,
  updateRecurrenceRule,
  fetchCampaignRuns,
  computeNextRunClient,
  RecurrenceRuleFE,
} from "@/services/whatsappCampaignService";
import RecurrenceRuleEditor, {
  describeRecurrenceRule,
  RecurrenceRule,
} from "@/components/carteira/RecurrenceRuleEditor";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Send,
  CheckCircle,
  XCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Clock,
  Repeat,
  Pause,
  Play,
  Zap,
  Pencil,
  History,
  X,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CampaignDetailView from "./campaigns/CampaignDetailView";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  sending: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  completed: "bg-green-500/20 text-green-700 dark:text-green-300",
  completed_with_errors: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  failed: "bg-destructive/20 text-destructive",
  paused: "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  cancelled: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  scheduled: "Agendada",
  sending: "Enviando",
  completed: "Concluída",
  completed_with_errors: "Concluída",
  failed: "Falhou",
  paused: "Pausada",
  cancelled: "Cancelada",
};

const originLabels: Record<string, string> = {
  carteira: "Carteira",
  automacao: "Automação",
  fluxo: "Fluxo",
  gatilho: "Gatilho",
  sistema: "Sistema",
  ia: "IA",
};

const PAGE_SIZE = 50;

export default function CampaignManagementTab() {
  const { tenant, tenantUser } = useTenant();
  const permissions = usePermissions();
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [scheduleTypeFilter, setScheduleTypeFilter] = useState<"all" | "once" | "recurring">("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(false);

  // Action dialogs state
  const [cancelTarget, setCancelTarget] = useState<CampaignWithStats | null>(null);
  const [editTarget, setEditTarget] = useState<CampaignWithStats | null>(null);
  const [editRule, setEditRule] = useState<RecurrenceRule | null>(null);
  const [runsTarget, setRunsTarget] = useState<CampaignWithStats | null>(null);

  const tenantId = tenant?.id;
  const onlyOwn = !permissions.canViewAllCampanhas && permissions.canViewOwnCampanhas;
  const canManage = permissions.canCreateCampanhas;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, scheduleTypeFilter]);

  useEffect(() => {
    setExpanded(false);
  }, [debouncedSearch, statusFilter, scheduleTypeFilter, page]);

  const { data: campaignsResult, isLoading } = useQuery({
    queryKey: ["managed-campaigns", tenantId, statusFilter, debouncedSearch, onlyOwn, page],
    queryFn: () =>
      fetchManagedCampaigns(tenantId!, {
        status: statusFilter,
        search: debouncedSearch || undefined,
        onlyOwn,
        userId: onlyOwn ? tenantUser?.user_id : undefined,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  const allCampaigns = campaignsResult?.data || [];
  // Client-side filter by schedule_type when viewing "scheduled" status
  const campaigns = statusFilter === "scheduled" && scheduleTypeFilter !== "all"
    ? allCampaigns.filter((c) => (c.schedule_type || "once") === scheduleTypeFilter)
    : allCampaigns;
  const totalCampaigns = campaignsResult?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalCampaigns / PAGE_SIZE));
  const visibleCampaigns = expanded ? campaigns : campaigns.slice(0, 5);
  const hiddenCount = Math.max(0, campaigns.length - 5);

  const { data: stats } = useQuery({
    queryKey: ["campaign-dashboard-stats", tenantId, onlyOwn],
    queryFn: () =>
      fetchCampaignDashboardStats(tenantId!, onlyOwn ? tenantUser?.user_id : undefined),
    enabled: !!tenantId,
  });

  const invalidateCampaigns = () => {
    qc.invalidateQueries({ queryKey: ["managed-campaigns"] });
    qc.invalidateQueries({ queryKey: ["campaign-dashboard-stats"] });
  };

  const handleFireNow = async (id: string) => {
    try {
      await fireNowScheduledCampaign(id);
      toast.success("Disparo antecipado — será processado em até 1 minuto.");
      invalidateCampaigns();
    } catch (e: any) {
      toast.error("Falha ao antecipar: " + (e.message || ""));
    }
  };

  const handlePause = async (id: string) => {
    try {
      await pauseRecurringCampaign(id);
      toast.success("Recorrência pausada.");
      invalidateCampaigns();
    } catch (e: any) {
      toast.error("Falha ao pausar: " + (e.message || ""));
    }
  };

  const handleResume = async (id: string) => {
    try {
      await resumeRecurringCampaign(id);
      toast.success("Recorrência retomada.");
      invalidateCampaigns();
    } catch (e: any) {
      toast.error("Falha ao retomar: " + (e.message || ""));
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget) return;
    try {
      await cancelScheduledCampaign(cancelTarget.id);
      toast.success("Agendamento cancelado.");
      setCancelTarget(null);
      invalidateCampaigns();
    } catch (e: any) {
      toast.error("Falha ao cancelar: " + (e.message || ""));
    }
  };

  const openEditRule = (c: CampaignWithStats) => {
    setEditTarget(c);
    setEditRule(((c.recurrence_rule as unknown) as RecurrenceRule) || {
      frequency: "daily",
      time: "08:00",
      weekdays: [1, 2, 3, 4, 5],
      window_start: "08:00",
      window_end: "20:00",
      skip_weekends: true,
    });
  };

  const confirmEditRule = async () => {
    if (!editTarget || !editRule) return;
    const next = computeNextRunClient(editRule as RecurrenceRuleFE);
    if (!next) {
      toast.error("Regra inválida — verifique dias e horários.");
      return;
    }
    try {
      await updateRecurrenceRule(editTarget.id, editRule as any, next);
      toast.success("Regra atualizada.");
      setEditTarget(null);
      setEditRule(null);
      invalidateCampaigns();
    } catch (e: any) {
      toast.error("Falha ao atualizar: " + (e.message || ""));
    }
  };

  if (selectedCampaignId) {
    return (
      <CampaignDetailView
        campaignId={selectedCampaignId}
        onBack={() => setSelectedCampaignId(null)}
        onlyOwn={onlyOwn}
        userId={tenantUser?.user_id}
      />
    );
  }

  return (
    <div className="p-4 space-y-4 h-full overflow-auto">
      {/* Dashboard cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Send className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campanhas</p>
              <p className="text-lg font-bold">{stats?.totalCampaigns || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Send className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Enviadas</p>
              <p className="text-lg font-bold">{stats?.totalSent || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregues</p>
              <p className="text-lg font-bold">{stats?.totalDelivered || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Falhas</p>
              <p className="text-lg font-bold">{stats?.totalFailed || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar campanha..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="scheduled">Agendadas</SelectItem>
            <SelectItem value="paused">Pausadas</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sending">Enviando</SelectItem>
            <SelectItem value="completed">Concluída</SelectItem>
            <SelectItem value="completed_with_errors">Concluída</SelectItem>
            <SelectItem value="failed">Falhou</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>

        {(statusFilter === "scheduled" || statusFilter === "paused") && (
          <div className="flex items-center rounded-md border overflow-hidden">
            {[
              { key: "all", label: "Todas" },
              { key: "once", label: "Uma vez" },
              { key: "recurring", label: "Recorrente" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setScheduleTypeFilter(opt.key as any)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  scheduleTypeFilter === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-background hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Campaigns table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando campanhas...</div>
          ) : campaigns.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Nenhuma campanha encontrada</p>
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left p-3 font-medium">Campanha</th>
                    <th className="text-left p-3 font-medium">Origem</th>
                    <th className="text-left p-3 font-medium">Criado por</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-right p-3 font-medium">Selecionados</th>
                    
                    <th className="text-right p-3 font-medium">Enviados</th>
                    <th className="text-right p-3 font-medium">Falhas</th>
                    <th className="text-left p-3 font-medium">Progresso / Agenda</th>
                    <th className="text-left p-3 font-medium">Data</th>
                    <th className="p-3 w-[44px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCampaigns.map((c) => {
                    const isScheduled = c.status === "scheduled" || c.status === "paused";
                    const isRecurring = c.schedule_type === "recurring";
                    const progress =
                      c.total_unique_recipients > 0
                        ? ((c.sent_count + c.failed_count) / c.total_unique_recipients) * 100
                        : 0;

                    return (
                      <tr
                        key={c.id}
                        className="border-b border-border hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => !isScheduled && setSelectedCampaignId(c.id)}
                      >
                        <td className="p-3 font-medium max-w-[220px] truncate">
                          <div className="flex items-center gap-1.5">
                            {isRecurring && isScheduled && (
                              <Repeat className="w-3.5 h-3.5 text-primary shrink-0" />
                            )}
                            {c.name || `Campanha ${c.id.slice(0, 6)}`}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {originLabels[c.origin_type || c.source] || c.source}
                          </Badge>
                        </td>
                        <td className="p-3 text-muted-foreground">{c.creator_name || "—"}</td>
                        <td className="p-3">
                          <Badge className={`text-xs ${statusColors[c.status] || ""}`}>
                            {statusLabels[c.status] || c.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">{c.total_selected}</td>
                        
                        <td className="p-3 text-right">{c.sent_count}</td>
                        <td className="p-3 text-right text-destructive">{c.failed_count}</td>
                        <td className="p-3 w-[220px]">
                          {isScheduled && c.scheduled_for ? (
                            <div className="space-y-0.5">
                              {isRecurring ? (
                                <>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {describeRecurrenceRule(
                                      (c.recurrence_rule as unknown) as RecurrenceRule || {
                                        frequency: "daily",
                                        time: "08:00",
                                      }
                                    )}
                                  </p>
                                  <p className="text-xs">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    Próxima:{" "}
                                    <span className="font-medium">
                                      {format(new Date(c.scheduled_for), "dd/MM HH:mm", {
                                        locale: ptBR,
                                      })}
                                    </span>
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {c.recurrence_run_count || 0}
                                    {((c.recurrence_rule as any)?.max_runs)
                                      ? ` / ${(c.recurrence_rule as any).max_runs}`
                                      : ""}{" "}
                                    execuções
                                  </p>
                                </>
                              ) : (
                                <>
                                  <p className="text-xs">
                                    <Clock className="w-3 h-3 inline mr-1" />
                                    {format(new Date(c.scheduled_for), "dd/MM/yy HH:mm", {
                                      locale: ptBR,
                                    })}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    em{" "}
                                    {formatDistanceToNowStrict(new Date(c.scheduled_for), {
                                      locale: ptBR,
                                    })}
                                  </p>
                                </>
                              )}
                            </div>
                          ) : (
                            <Progress value={Math.min(progress, 100)} className="h-2" />
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground text-xs whitespace-nowrap">
                          {format(new Date(c.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </td>
                        <td
                          className="p-3"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {isScheduled && canManage && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 bg-popover z-50">
                                <DropdownMenuItem onClick={() => handleFireNow(c.id)}>
                                  <Zap className="w-4 h-4 mr-2" />
                                  Disparar agora
                                </DropdownMenuItem>
                                {isRecurring && c.status === "scheduled" && (
                                  <DropdownMenuItem onClick={() => handlePause(c.id)}>
                                    <Pause className="w-4 h-4 mr-2" />
                                    Pausar recorrência
                                  </DropdownMenuItem>
                                )}
                                {isRecurring && c.status === "paused" && (
                                  <DropdownMenuItem onClick={() => handleResume(c.id)}>
                                    <Play className="w-4 h-4 mr-2" />
                                    Retomar recorrência
                                  </DropdownMenuItem>
                                )}
                                {isRecurring && (
                                  <DropdownMenuItem onClick={() => openEditRule(c)}>
                                    <Pencil className="w-4 h-4 mr-2" />
                                    Editar regra
                                  </DropdownMenuItem>
                                )}
                                {isRecurring && (
                                  <DropdownMenuItem onClick={() => setRunsTarget(c)}>
                                    <History className="w-4 h-4 mr-2" />
                                    Ver execuções
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => setCancelTarget(c)}
                                >
                                  <X className="w-4 h-4 mr-2" />
                                  Cancelar agendamento
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {hiddenCount > 0 && (
                <div className="flex justify-center py-3 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((v) => !v)}
                    className="text-muted-foreground"
                  >
                    {expanded ? (
                      <>
                        <ChevronUp className="w-4 h-4 mr-1" />
                        Ocultar
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4 mr-1" />
                        Ver mais {hiddenCount} {hiddenCount === 1 ? "campanha" : "campanhas"}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{totalCampaigns} campanhas encontradas</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
            </Button>
            <span className="px-2">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Cancel confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(v) => !v && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              A campanha <strong>{cancelTarget?.name}</strong> não será executada. Destinatários
              pendentes serão marcados como cancelados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmCancel}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Cancelar agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit recurrence rule */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(v) => {
          if (!v) {
            setEditTarget(null);
            setEditRule(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="w-4 h-4" />
              Editar regra de recorrência
            </DialogTitle>
            <DialogDescription>
              Ajustes recalculam a próxima execução automaticamente.
            </DialogDescription>
          </DialogHeader>
          {editRule && (
            <RecurrenceRuleEditor value={editRule} onChange={setEditRule} />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmEditRule}>Salvar regra</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Runs history */}
      <RunsDialog
        campaign={runsTarget}
        onClose={() => setRunsTarget(null)}
      />
    </div>
  );
}

// --- Runs history sub-component ---
function RunsDialog({
  campaign,
  onClose,
}: {
  campaign: CampaignWithStats | null;
  onClose: () => void;
}) {
  const { data: runs = [], isLoading } = useQuery({
    queryKey: ["campaign-runs", campaign?.id],
    queryFn: () => fetchCampaignRuns(campaign!.id),
    enabled: !!campaign?.id,
  });

  return (
    <Dialog open={!!campaign} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Histórico de execuções
          </DialogTitle>
          <DialogDescription>
            {campaign?.name} — {runs.length} execuç{runs.length === 1 ? "ão" : "ões"}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-96 overflow-auto">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Carregando...</p>
          ) : runs.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              Ainda não houve execuções.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left p-2 font-medium">Data</th>
                  <th className="text-left p-2 font-medium">Status</th>
                  <th className="text-right p-2 font-medium">Destinatários</th>
                  <th className="text-left p-2 font-medium">Campanha filha</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r: any) => (
                  <tr key={r.id} className="border-b border-border">
                    <td className="p-2">
                      {format(new Date(r.run_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="p-2">
                      <Badge className={`text-xs ${statusColors[r.status] || ""}`}>
                        {statusLabels[r.status] || r.status}
                      </Badge>
                    </td>
                    <td className="p-2 text-right">{r.recipients_count || 0}</td>
                    <td className="p-2 text-muted-foreground text-xs font-mono">
                      {r.child_campaign_id?.slice(0, 8) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
