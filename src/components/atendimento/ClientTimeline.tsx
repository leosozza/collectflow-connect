import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { Clock, PenLine, Save, Inbox, Phone, Play, Pause, User, Bot, Zap, Handshake, CreditCard, Tags, FileEdit, Shield, MessageSquare, Signature } from "lucide-react";

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  title: string;
  detail?: string;
  operator?: string;
  recordingUrl?: string;
  durationSeconds?: number;
}

interface CallLog {
  id: string;
  phone?: string;
  agent_name?: string;
  status?: string;
  duration_seconds?: number;
  recording_url?: string | null;
  campaign_name?: string;
  called_at: string;
}

interface ClientTimelineProps {
  dispositions: (CallDisposition & { operator_name?: string })[];
  agreements: any[];
  callLogs?: CallLog[];
  clientCpf?: string;
}

interface ClientObservationsProps {
  observacoes?: string | null;
  onSaveNote?: (note: string) => Promise<void>;
  savingNote?: boolean;
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string }> = {
  disposition: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  note:        { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  call:        { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  agreement:   { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_created:  { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_approved: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_cancelled:{ border: "border-red-200", bg: "bg-red-50/50", dot: "border-red-400" },
  agreement_overdue:  { border: "border-orange-200", bg: "bg-orange-50/50", dot: "border-orange-400" },
  agreement_signed:   { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  message:     { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  message_sent:{ border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  whatsapp_inbound: { border: "border-green-200", bg: "bg-green-50/50", dot: "border-green-400" },
  whatsapp_outbound:{ border: "border-green-200", bg: "bg-green-50/50", dot: "border-green-400" },
  payment:     { border: "border-teal-200", bg: "bg-teal-50/50", dot: "border-teal-400" },
  system:      { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  ai:          { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  debtor_category: { border: "border-pink-200", bg: "bg-pink-50/50", dot: "border-pink-400" },
  field_update:{ border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  disposition: "Disposição",
  call: "Ligação",
  agreement_created: "Acordo Criado",
  agreement_approved: "Acordo Aprovado",
  agreement_cancelled: "Acordo Cancelado",
  agreement_overdue: "Acordo Vencido",
  agreement_signed: "Acordo Assinado",
  whatsapp_inbound: "WhatsApp Recebido",
  whatsapp_outbound: "WhatsApp Enviado",
  message_sent: "Mensagem de Prevenção",
  field_update: "Alteração de Dados",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  agreement: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_created: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_approved: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_cancelled: <Handshake className="w-3.5 h-3.5 text-red-500" />,
  agreement_overdue: <Handshake className="w-3.5 h-3.5 text-orange-500" />,
  agreement_signed: <Signature className="w-3.5 h-3.5 text-emerald-500" />,
  payment: <CreditCard className="w-3.5 h-3.5 text-teal-500" />,
  message: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  message_sent: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  whatsapp_inbound: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  whatsapp_outbound: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  system: <Bot className="w-3.5 h-3.5 text-slate-500" />,
  debtor_category: <Tags className="w-3.5 h-3.5 text-pink-500" />,
  field_update: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  disposition: <Phone className="w-3.5 h-3.5 text-amber-500" />,
};

const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome", cpf: "CPF", phone: "Telefone 1", phone2: "Telefone 2",
  phone3: "Telefone 3", email: "E-mail", credor: "Credor", valor_parcela: "Valor Parcela",
  valor_pago: "Valor Pago", status: "Status", data_vencimento: "Vencimento",
  data_pagamento: "Pagamento", endereco: "Endereço", cidade: "Cidade", uf: "UF",
  cep: "CEP", status_cobranca_id: "Status Cobrança", observacoes: "Observações",
};

const SOURCE_LABELS: Record<string, string> = {
  import: "Importação", api: "API", maxlist: "MaxList", manual: "Edição Manual",
  regua: "Régua", whatsapp_auto: "WhatsApp Auto", system: "Sistema", workflow: "Workflow",
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const InlineAudioPlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <button
        onClick={toggle}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        title={playing ? "Pausar" : "Ouvir gravação"}
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />
    </span>
  );
};

const ResponsibleLabel = ({ operator, type }: { operator?: string; type: string }) => {
  if (operator) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
        <User className="w-3 h-3" /> por {operator}
      </span>
    );
  }
  if (type === "system") {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
        <Bot className="w-3 h-3" /> Sistema
      </span>
    );
  }
  return null;
};

/** Render field_update changes inline */
const FieldUpdateDetail = ({ metadata }: { metadata: any }) => {
  const changes = metadata?.changes;
  if (!changes || typeof changes !== "object") return null;
  const fields = Object.keys(changes);
  if (fields.length === 0) return null;
  return (
    <div className="space-y-0.5 mt-1">
      {fields.map((field) => {
        const change = changes[field];
        const oldVal = change?.old ?? "—";
        const newVal = change?.new ?? "—";
        return (
          <p key={field} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{FIELD_LABELS[field] || field}:</span>{" "}
            <span className="line-through">{String(oldVal)}</span> → <span className="font-medium text-foreground">{String(newVal)}</span>
          </p>
        );
      })}
    </div>
  );
};

const ClientTimeline = ({ dispositions, agreements, callLogs = [], clientCpf }: ClientTimelineProps) => {
  const [showAll, setShowAll] = useState(false);

  // Fetch client_events when clientCpf is available
  const { data: clientEvents = [] } = useQuery({
    queryKey: ["client-events-timeline", clientCpf],
    queryFn: async () => {
      const rawCpf = (clientCpf || "").replace(/\D/g, "");
      if (!rawCpf) return [];
      const { data, error } = await supabase
        .from("client_events")
        .select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${clientCpf}`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientCpf,
  });

  // Resolve operator names from metadata
  const { data: profileMap = {} } = useQuery({
    queryKey: ["timeline-profiles", clientCpf, clientEvents.length],
    queryFn: async () => {
      const userIds = new Set<string>();
      clientEvents.forEach((e: any) => {
        const meta = e.metadata as any;
        if (meta?.created_by) userIds.add(meta.created_by);
        if (meta?.updated_by) userIds.add(meta.updated_by);
        if (meta?.operator_id) userIds.add(meta.operator_id);
        if (meta?.agent_name) return; // already has name
      });
      // Also from props
      dispositions.forEach((d) => { if (d.operator_id) userIds.add(d.operator_id); });

      const ids = [...userIds].filter(Boolean);
      if (ids.length === 0) return {};
      
      // Try profiles by user_id first, then by id
      const { data: byUserId } = await supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .in("user_id", ids);
      const { data: byId } = await supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .in("id", ids);

      const map: Record<string, string> = {};
      (byUserId || []).forEach((p) => { if (p.user_id && p.full_name) map[p.user_id] = p.full_name; });
      (byId || []).forEach((p) => { if (p.id && p.full_name) map[p.id] = p.full_name; if (p.user_id && p.full_name) map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: clientEvents.length > 0 || dispositions.length > 0,
  });

  // Build unified items
  const items: TimelineItem[] = [];
  const usedEventIds = new Set<string>();

  // If we have client_events, use them as primary source
  if (clientEvents.length > 0) {
    clientEvents.forEach((e: any) => {
      const meta = (e.metadata || {}) as any;
      const eventType = e.event_type || "system";
      const label = eventType === "disposition"
        ? (DISPOSITION_TYPES[e.event_value as keyof typeof DISPOSITION_TYPES] || e.event_value || "Disposição")
        : (EVENT_TYPE_LABELS[eventType] || DISPOSITION_TYPES[e.event_value as keyof typeof DISPOSITION_TYPES] || eventType);
      
      let detail = "";
      let operator = "";

      // Resolve operator name
      if (meta.operator_id && profileMap[meta.operator_id]) {
        operator = profileMap[meta.operator_id];
      } else if (meta.created_by && profileMap[meta.created_by]) {
        operator = profileMap[meta.created_by];
      } else if (meta.updated_by && profileMap[meta.updated_by]) {
        operator = profileMap[meta.updated_by];
      } else if (meta.agent_name) {
        operator = meta.agent_name;
      }

      // Build detail based on type
      if (eventType === "disposition") {
        detail = meta.notes || "";
      } else if (eventType.startsWith("agreement_")) {
        if (meta.original_total && meta.proposed_total) {
          detail = `${formatCurrency(Number(meta.original_total))} → ${formatCurrency(Number(meta.proposed_total))}`;
          if (meta.new_installments) detail += ` (${meta.new_installments}x)`;
        }
        if (meta.credor) detail = `${meta.credor} — ${detail}`;
      } else if (eventType === "call") {
        if (meta.duration_seconds) detail = `Duração: ${formatDuration(meta.duration_seconds)}`;
        if (meta.campaign_name) detail = detail ? `${detail} — ${meta.campaign_name}` : meta.campaign_name;
      } else if (eventType === "message_sent") {
        detail = `Canal: ${meta.channel || "whatsapp"}`;
      } else if (eventType === "field_update") {
        const source = SOURCE_LABELS[e.event_value] || e.event_value || "manual";
        detail = `Fonte: ${source}`;
      } else if (eventType === "whatsapp_inbound" || eventType === "whatsapp_outbound") {
        detail = e.event_value || "";
      }

      items.push({
        id: `ev-${e.id}`,
        date: e.created_at,
        type: eventType,
        title: label,
        detail: detail || undefined,
        operator: operator || undefined,
        durationSeconds: eventType === "call" ? meta.duration_seconds : undefined,
      });
      usedEventIds.add(e.id);
    });
  } else {
    // Fallback: use props when no client_events
    dispositions.forEach((d) => {
      const label = DISPOSITION_TYPES[d.disposition_type as keyof typeof DISPOSITION_TYPES] || d.disposition_type;
      items.push({
        id: `d-${d.id}`,
        date: d.created_at,
        type: d.disposition_type === "note" ? "note" : "disposition",
        title: label,
        detail: d.notes || undefined,
        operator: d.operator_name || (d.operator_id && profileMap[d.operator_id]) || undefined,
      });
    });

    agreements.forEach((a: any) => {
      items.push({
        id: `a-${a.id}`,
        date: a.created_at,
        type: "agreement",
        title: `Acordo ${a.status === "approved" ? "Aprovado" : a.status === "pending" ? "Pendente" : a.status}`,
        detail: `${formatCurrency(Number(a.original_total))} → ${formatCurrency(Number(a.proposed_total))} (${a.new_installments}x)`,
        operator: a.creator_name || (a.created_by && profileMap[a.created_by]) || undefined,
      });
    });

    callLogs.forEach((c) => {
      items.push({
        id: `call-${c.id}`,
        date: c.called_at,
        type: "call",
        title: `Ligação — ${c.status || "realizada"}`,
        detail: c.phone ? `Tel: ${c.phone}` : undefined,
        operator: c.agent_name || undefined,
        recordingUrl: c.recording_url || undefined,
        durationSeconds: c.duration_seconds || 0,
      });
    });
  }

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleItems = showAll ? items : items.slice(0, 5);

  const getColors = (type: string) => COLOR_MAP[type] || COLOR_MAP.disposition;

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Histórico de Atendimento
        </CardTitle>
        {items.length > 5 && (
          <button
            className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? "Mostrar menos" : "Ver tudo"}
          </button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum registro de atendimento</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Os eventos aparecerão aqui conforme o atendimento avança.</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const colors = getColors(item.type);
                const meta = item.type === "field_update" ? clientEvents.find((e: any) => `ev-${e.id}` === item.id)?.metadata : null;
                return (
                  <div key={item.id} className="relative">
                    <div className={`absolute -left-6 top-3 w-[14px] h-[14px] rounded-full border-2 bg-card ${colors.dot}`} />
                    <div className={`border rounded-lg p-3 ${colors.border} ${colors.bg}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {TYPE_ICON[item.type] || TYPE_ICON.system}
                          {item.title}
                          {item.type === "call" && item.durationSeconds !== undefined && item.durationSeconds > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">({formatDuration(item.durationSeconds)})</span>
                          )}
                        </span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString("pt-BR")} — {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <ResponsibleLabel operator={item.operator} type={item.type} />
                      {item.type === "field_update" && meta ? (
                        <FieldUpdateDetail metadata={meta} />
                      ) : (
                        item.detail && <p className="text-xs text-muted-foreground mt-1 italic">"{item.detail}"</p>
                      )}
                      {item.type === "call" && item.recordingUrl && (
                        <div className="mt-1.5 flex items-center">
                          <span className="text-xs text-blue-600 font-medium">Gravação</span>
                          <InlineAudioPlayer url={item.recordingUrl} />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ClientObservations = ({ observacoes, onSaveNote, savingNote }: ClientObservationsProps) => {
  const [noteText, setNoteText] = useState("");

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await onSaveNote?.(noteText.trim());
    setNoteText("");
  };

  const parsedNotes = (() => {
    if (!observacoes) return [];
    return observacoes.split("\n---\n").filter(Boolean).map((block, i) => {
      const lines = block.trim().split("\n");
      const header = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      const match = header.match(/^(.+?)\s*\|\s*(.+)$/);
      const datetime = match ? match[1].trim() : header;
      const operator = match ? match[2].trim() : "";
      return { id: `note-${i}`, datetime, operator, body };
    });
  })();

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          Observações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {onSaveNote && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione uma observação sobre este atendimento..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote || !noteText.trim()}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Save className="w-4 h-4" />
                Salvar Nota
              </Button>
            </div>
          </div>
        )}

        {parsedNotes.length > 0 ? (
          <div className="space-y-3">
            {parsedNotes.map((note) => (
              <div key={note.id} className="border-l-4 border-amber-400 bg-muted/30 rounded-r-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-muted-foreground">{note.datetime}</span>
                  {note.operator && (
                    <span className="text-[11px] font-semibold text-foreground">{note.operator}</span>
                  )}
                </div>
                {note.body && <p className="text-sm text-foreground italic">"{note.body}"</p>}
              </div>
            ))}
          </div>
        ) : (
          !onSaveNote && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PenLine className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma observação</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTimeline;
export { ClientObservations };
