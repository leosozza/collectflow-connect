import { useEffect, useMemo, useState } from "react";
import {
  CampaignWithStats,
  fetchRecipientStatusCounts,
  fetchInstanceMetrics,
} from "@/services/campaignManagementService";
import { resolveTemplateClient } from "@/services/whatsappCampaignService";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  CheckCircle,
  XCircle,
  Users,
  TrendingUp,
  Eye,
  Shuffle,
  Clock,
  Pause,
  Play,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LabelList,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useQuery } from "@tanstack/react-query";

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  sending: "Enviando",
  completed: "Concluída",
  completed_with_errors: "Concluída c/ erros",
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

const recipientStatusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  sent: "Enviado",
  delivered: "Entregue",
  read: "Lido",
  failed: "Falhou",
  skipped: "Ignorado",
};

// Cores fixas por status semântico (Falhou=vermelho, Enviado=azul, Entregue=verde, Pendente=cinza)
const STATUS_PIE_COLORS: Record<string, string> = {
  Pendente: "hsl(var(--muted-foreground))",
  Processando: "hsl(var(--muted))",
  Enviado: "hsl(217 91% 60%)",
  Entregue: "hsl(142 71% 45%)",
  Lido: "hsl(142 71% 35%)",
  Falhou: "hsl(var(--destructive))",
  Ignorado: "hsl(var(--muted))",
};

const PIE_FALLBACK = "hsl(var(--muted-foreground))";

// W2.3 — anti-ban constants (mirror of supabase/functions/send-bulk-whatsapp)
const RATE_CONSTANTS = {
  unofficial: { avgDelayMs: 11500, batchSize: 15, restMs: 120_000 },
  official_meta: { avgDelayMs: 2000, batchSize: 50, restMs: 30_000 },
};

interface Props {
  campaign: CampaignWithStats;
}

interface PreviewRecipient {
  id: string;
  recipient_name: string;
  phone: string;
  representative_client_id: string;
  message_body_snapshot: string | null;
}

export default function CampaignSummaryTab({ campaign }: Props) {
  // Lightweight status counts (no full recipient load)
  const { data: statusCounts = [] } = useQuery({
    queryKey: ["campaign-status-counts", campaign.id],
    queryFn: () => fetchRecipientStatusCounts(campaign.id),
  });

  // Instance metrics (lightweight aggregation)
  const { data: instanceMetrics = [] } = useQuery({
    queryKey: ["campaign-instance-metrics", campaign.id],
    queryFn: () => fetchInstanceMetrics(campaign.id),
  });

  const deliveryRate =
    campaign.sent_count > 0
      ? ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
      : "—";

  const pieData = statusCounts
    .filter((s) => s.status !== "read")
    .map((s) => ({
      name: recipientStatusLabels[s.status] || s.status,
      value: s.count,
    }));


  const barData = instanceMetrics.map((m) => ({
    name: m.instance_name,
    recipients: m.recipients,
    sent: m.sent,
    delivered: m.delivered,
    failed: m.failed,
  }));

  // ----------------- W2.2 — Preview de mensagem -----------------
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewRecipient, setPreviewRecipient] = useState<PreviewRecipient | null>(null);
  const [previewRendered, setPreviewRendered] = useState<string>("");
  const [previewSource, setPreviewSource] = useState<"snapshot" | "template" | "empty">("empty");

  async function loadPreview() {
    setPreviewLoading(true);
    try {
      const { data: recipients } = await supabase
        .from("whatsapp_campaign_recipients" as any)
        .select("id, recipient_name, phone, representative_client_id, message_body_snapshot")
        .eq("campaign_id", campaign.id)
        .limit(50);

      const list = (recipients || []) as unknown as PreviewRecipient[];
      if (list.length === 0) {
        setPreviewRecipient(null);
        setPreviewRendered("Nenhum destinatário encontrado para esta campanha.");
        setPreviewSource("empty");
        return;
      }

      const picked = list[Math.floor(Math.random() * list.length)];
      setPreviewRecipient(picked);

      // 1) snapshot tem prioridade — já vem com placeholders resolvidos pelo backend
      if (picked.message_body_snapshot && picked.message_body_snapshot.trim().length > 0) {
        setPreviewRendered(picked.message_body_snapshot);
        setPreviewSource("snapshot");
        return;
      }

      // 2) fallback: resolver localmente usando dados de client_profiles + clients
      const baseTemplate = campaign.message_body || "";
      if (!baseTemplate) {
        setPreviewRendered("(Mensagem da campanha vazia)");
        setPreviewSource("empty");
        return;
      }

      // Buscar dados do cliente para resolver placeholders
      const { data: clientRow } = await supabase
        .from("clients")
        .select("cpf, nome_completo, valor_parcela, data_vencimento, credor")
        .eq("id", picked.representative_client_id)
        .maybeSingle();

      let profileRow: any = null;
      if (clientRow?.cpf) {
        const { data: pr } = await supabase
          .from("client_profiles")
          .select("nome_completo")
          .eq("cpf", clientRow.cpf)
          .eq("tenant_id", campaign.tenant_id)
          .maybeSingle();
        profileRow = pr;
      }

      const resolved = resolveTemplateClient(baseTemplate, {
        nome_completo: profileRow?.nome_completo || clientRow?.nome_completo || picked.recipient_name,
        cpf: clientRow?.cpf,
        valor_parcela: clientRow?.valor_parcela,
        data_vencimento: clientRow?.data_vencimento,
        credor: clientRow?.credor,
        recipient_name: picked.recipient_name,
      });
      setPreviewRendered(resolved);
      setPreviewSource("template");
    } finally {
      setPreviewLoading(false);
    }
  }

  function openPreview() {
    setPreviewOpen(true);
    loadPreview();
  }

  // ----------------- W2.3 — Indicador de rate-limit ativo -----------------
  const isSending = campaign.status === "sending";

  // Re-busca metadata + counters a cada 5s enquanto envia
  const { data: liveData } = useQuery({
    queryKey: ["campaign-progress-meta", campaign.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_campaigns" as any)
        .select("status, progress_metadata, sent_count, failed_count, delivered_count, updated_at")
        .eq("id", campaign.id)
        .single();
      return data as any;
    },
    enabled: isSending,
    refetchInterval: 5000,
  });

  const liveStatus: string = liveData?.status || campaign.status;
  const meta: Record<string, any> | null =
    liveData?.progress_metadata || campaign.progress_metadata || null;
  const liveSent = liveData?.sent_count ?? campaign.sent_count;
  const liveFailed = liveData?.failed_count ?? campaign.failed_count;
  const liveDelivered = liveData?.delivered_count ?? campaign.delivered_count;
  const liveUpdatedAt: string | null = liveData?.updated_at || campaign.updated_at || null;

  const liveDeliveryRate =
    liveSent > 0 ? ((liveDelivered / liveSent) * 100).toFixed(1) : "—";

  const showRateLimit = liveStatus === "sending";

  // Tick de 1s para countdown
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!showRateLimit) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [showRateLimit]);

  const rateInfo = useMemo(() => {
    if (!showRateLimit || !meta) return null;
    const cat: "official_meta" | "unofficial" =
      campaign.provider_category === "official_meta" ? "official_meta" : "unofficial";
    const constants = RATE_CONSTANTS[cat];

    const lastChunkAt: string | null = meta.last_chunk_at || null;
    const resting: boolean = !!meta.batch_resting;
    const restingInstance: string | null = meta.resting_instance || null;
    const restStartedAt: string | null = meta.batch_resting_started_at || meta.resting_started_at || null;

    const now = Date.now();
    void tick;

    if (resting) {
      const startedMs = restStartedAt ? new Date(restStartedAt).getTime() : (lastChunkAt ? new Date(lastChunkAt).getTime() : now);
      const remainingMs = Math.max(0, constants.restMs - (now - startedMs));
      return {
        kind: "resting" as const,
        instanceName: restingInstance,
        remainingSec: Math.ceil(remainingMs / 1000),
      };
    }

    if (lastChunkAt) {
      const elapsed = now - new Date(lastChunkAt).getTime();
      const remainingMs = Math.max(0, constants.avgDelayMs - elapsed);
      return {
        kind: "next" as const,
        remainingSec: Math.ceil(remainingMs / 1000),
      };
    }

    return {
      kind: "next" as const,
      remainingSec: Math.ceil(constants.avgDelayMs / 1000),
    };
  }, [showRateLimit, meta, campaign.provider_category, tick]);

  // ----------------- Detect stalled campaign + manual resume -----------------
  // Banner "pausado" SÓ aparece se realmente está sem progresso recente.
  // Worker ativo move tanto last_chunk_at quanto updated_at — usa o mais recente como referência.
  const lastChunkAtMeta: string | null = (meta as any)?.last_chunk_at || null;
  const timedOutFlag: boolean = !!(meta as any)?.timed_out;

  const referenceTimes = [lastChunkAtMeta, liveUpdatedAt]
    .filter(Boolean)
    .map((t) => new Date(t as string).getTime());
  const lastActivityMs = referenceTimes.length ? Math.max(...referenceTimes) : null;
  const minutesSinceLastChunk =
    lastActivityMs != null ? (Date.now() - lastActivityMs) / 60000 : null;

  // Só considera travado se: timed_out + sem progresso há ≥3min.
  // Se o worker já retomou (updated_at recente), o banner some automaticamente.
  const isStalled =
    isSending &&
    timedOutFlag &&
    minutesSinceLastChunk != null &&
    minutesSinceLastChunk >= 3;

  const [resuming, setResuming] = useState(false);
  async function handleResume() {
    if (resuming) return;
    setResuming(true);
    try {
      const { error } = await supabase.functions.invoke("send-bulk-whatsapp", {
        body: { campaign_id: campaign.id },
      });
      if (error) throw error;
      toast.success("Disparo retomado em segundo plano");
    } catch (e: any) {
      toast.error(`Falha ao retomar: ${e?.message || "erro desconhecido"}`);
    } finally {
      setTimeout(() => setResuming(false), 4000);
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Banner de campanha travada com retomada manual */}
      {isStalled && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">Disparo pausado pelo limite de execução</p>
              <p className="text-xs text-muted-foreground">
                {timedOutFlag
                  ? "O ciclo anterior atingiu o tempo máximo. O sistema retoma automaticamente em até 1 minuto."
                  : `Sem progresso há ~${Math.round(minutesSinceLastChunk!)}min. O watchdog deve retomar em breve.`}
                {" "}Você pode forçar a retomada manualmente.
              </p>
            </div>
            <Button size="sm" onClick={handleResume} disabled={resuming} className="shrink-0">
              <Play className="w-3.5 h-3.5 mr-1" />
              {resuming ? "Retomando..." : "Retomar agora"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* W2.3 — Painel de rate-limit ao vivo */}
      {showRateLimit && rateInfo && !isStalled && (
        <Card
          className={
            rateInfo.kind === "resting"
              ? "border-orange-500/40 bg-orange-500/5"
              : "border-green-500/40 bg-green-500/5"
          }
        >
          <CardContent className="p-3 flex items-center gap-3">
            {rateInfo.kind === "resting" ? (
              <Pause className="w-5 h-5 text-orange-600 shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-green-600 shrink-0" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {rateInfo.kind === "resting"
                  ? `Pausa anti-ban ativa${rateInfo.instanceName ? ` em ${rateInfo.instanceName}` : ""}`
                  : "Próximo envio em breve"}
              </p>
              <p className="text-xs text-muted-foreground">
                {rateInfo.kind === "resting"
                  ? `Retomando em ${rateInfo.remainingSec}s — protege a instância contra bloqueio`
                  : `~${rateInfo.remainingSec}s para o próximo disparo`}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                rateInfo.kind === "resting"
                  ? "border-orange-500/50 text-orange-700"
                  : "border-green-500/50 text-green-700"
              }
            >
              {rateInfo.kind === "resting" ? "Em pausa" : "Em ritmo"}
            </Badge>
          </CardContent>
        </Card>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-xl font-bold">{campaign.total_unique_recipients}</p>
            <p className="text-xs text-muted-foreground">Únicos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <Send className="w-5 h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-xl font-bold">{liveSent}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <CheckCircle className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <p className="text-xl font-bold">{liveDelivered}</p>
            <p className="text-xs text-muted-foreground">Entregues</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <XCircle className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-xl font-bold">{liveFailed}</p>
            <p className="text-xs text-muted-foreground">Falhas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
            <p className="text-xl font-bold">
              {liveDeliveryRate}
              {liveDeliveryRate !== "—" ? "%" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
          </CardContent>
        </Card>
      </div>

      {/* Campaign info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Informações da Campanha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Nome</p>
            <p className="font-medium">{campaign.name || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Status</p>
            <Badge variant="outline">{statusLabels[liveStatus] || statusLabels[campaign.status] || campaign.status}</Badge>
            {isSending && (meta as any)?.batch_resting && (
              <p className="text-[11px] text-orange-700 mt-1">
                Aguardando descanso anti-ban (~2 min)
              </p>
            )}
            {isSending && !((meta as any)?.batch_resting) && timedOutFlag && (
              <p className="text-[11px] text-amber-700 mt-1">
                Reiniciando ciclo automaticamente (até 1 min)
              </p>
            )}
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Origem</p>
            <p className="font-medium">
              {originLabels[campaign.origin_type || campaign.source] || campaign.source}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Criado por</p>
            <p className="font-medium">{campaign.creator_name}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Criação</p>
            <p className="font-medium">
              {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
            </p>
          </div>
          {campaign.started_at && (
            <div>
              <p className="text-muted-foreground text-xs">Início</p>
              <p className="font-medium">
                {format(new Date(campaign.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
          {campaign.completed_at && (
            <div>
              <p className="text-muted-foreground text-xs">Conclusão</p>
              <p className="font-medium">
                {format(new Date(campaign.completed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </p>
            </div>
          )}
          <div>
            <p className="text-muted-foreground text-xs">Modo Mensagem</p>
            <p className="font-medium">
              {campaign.message_mode === "template" ? "Template" : "Personalizada"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {barData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Distribuição por Instância</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="recipients" name="Destinatários" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sent" name="Enviados" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Entregues" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              {/* Legenda + tabela compacta */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs mt-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(var(--muted-foreground))" }} />
                  <span className="text-muted-foreground">Destinatários</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(217 91% 60%)" }} />
                  <span className="text-muted-foreground">Enviados</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                  <span className="text-muted-foreground">Entregues</span>
                </div>
              </div>
              <div className="overflow-auto mt-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left p-1.5 font-medium">Instância</th>
                      <th className="text-right p-1.5 font-medium">Dest.</th>
                      <th className="text-right p-1.5 font-medium">Env.</th>
                      <th className="text-right p-1.5 font-medium">Entr.</th>
                      <th className="text-right p-1.5 font-medium">Taxa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barData.map((m) => (
                      <tr key={m.name} className="border-b border-border/50">
                        <td className="p-1.5 font-medium truncate max-w-[120px]">{m.name}</td>
                        <td className="p-1.5 text-right">{m.recipients}</td>
                        <td className="p-1.5 text-right text-blue-600">{m.sent}</td>
                        <td className="p-1.5 text-right text-green-600">{m.delivered}</td>
                        <td className="p-1.5 text-right">
                          {m.sent > 0 ? ((m.delivered / m.sent) * 100).toFixed(0) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {pieData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Status dos Destinatários</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-3">
              <ChartContainer
                config={pieData.reduce((acc, item) => {
                  acc[item.name] = {
                    label: item.name,
                    color: STATUS_PIE_COLORS[item.name] ?? PIE_FALLBACK,
                  };
                  return acc;
                }, {} as ChartConfig)}
                className="mx-auto aspect-square max-h-[260px] w-full [&_.recharts-text]:fill-white"
              >
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    cornerRadius={8}
                    paddingAngle={4}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={STATUS_PIE_COLORS[entry.name] ?? PIE_FALLBACK}
                        stroke="hsl(var(--background))"
                        strokeWidth={2}
                      />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="inside"
                      stroke="none"
                      fontSize={13}
                      fontWeight={600}
                      fill="#ffffff"
                      formatter={(v: number) => (v > 0 ? v.toString() : "")}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>
              {/* Legenda customizada */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ backgroundColor: STATUS_PIE_COLORS[entry.name] ?? PIE_FALLBACK }}
                    />
                    <span className="text-muted-foreground">
                      {entry.name} <span className="font-medium text-foreground">({entry.value})</span>
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Message preview */}
      {campaign.message_body && (
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Mensagem</CardTitle>
            <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={openPreview}>
              <Eye className="w-3.5 h-3.5" />
              Pré-visualizar
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm bg-muted p-3 rounded-lg max-h-40 overflow-auto">
              {campaign.message_body}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* W2.2 — Diálogo de pré-visualização (estilo bolha de chat) */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Pré-visualização da mensagem
            </DialogTitle>
            <DialogDescription>
              Como ficará a mensagem no WhatsApp do destinatário escolhido.
            </DialogDescription>
          </DialogHeader>

          {previewLoading ? (
            <div className="text-center py-8 text-sm text-muted-foreground">Carregando…</div>
          ) : (
            <div className="space-y-3">
              {previewRecipient && (
                <div className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>
                    Destinatário: <span className="font-medium text-foreground">{previewRecipient.recipient_name}</span> · {previewRecipient.phone}
                  </span>
                  {previewSource === "snapshot" ? (
                    <Badge variant="secondary" className="text-[10px]">snapshot real</Badge>
                  ) : previewSource === "template" ? (
                    <Badge variant="outline" className="text-[10px]">simulado</Badge>
                  ) : null}
                </div>
              )}

              {/* Bolha estilo WhatsApp (verde claro, à direita) */}
              <div className="rounded-lg bg-muted/40 p-4 min-h-[120px] flex">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-green-100 dark:bg-green-900/40 px-3 py-2 shadow-sm">
                  <p className="text-sm whitespace-pre-wrap text-foreground">{previewRendered}</p>
                  <p className="text-[10px] text-muted-foreground text-right mt-1">
                    {format(new Date(), "HH:mm")} ✓✓
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between sm:justify-between">
            <Button variant="outline" size="sm" onClick={loadPreview} disabled={previewLoading} className="gap-1.5">
              <Shuffle className="w-3.5 h-3.5" />
              Sortear outro
            </Button>
            <Button size="sm" onClick={() => setPreviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
