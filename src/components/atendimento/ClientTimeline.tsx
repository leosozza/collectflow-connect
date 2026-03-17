import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { Clock, PenLine, Save, Inbox, Phone, Play, Pause, User, Bot, Zap, Handshake, CreditCard } from "lucide-react";

interface TimelineItem {
  id: string;
  date: string;
  type: "disposition" | "agreement" | "message" | "payment" | "note" | "call";
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
  message:     { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  payment:     { border: "border-teal-200", bg: "bg-teal-50/50", dot: "border-teal-400" },
  system:      { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  ai:          { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  agreement: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  payment: <CreditCard className="w-3.5 h-3.5 text-teal-500" />,
  message: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  system: <Bot className="w-3.5 h-3.5 text-slate-500" />,
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

const ClientTimeline = ({ dispositions, agreements, callLogs = [] }: ClientTimelineProps) => {
  const [showAll, setShowAll] = useState(false);

  const items: TimelineItem[] = [];

  dispositions.forEach((d) => {
    const label = DISPOSITION_TYPES[d.disposition_type as keyof typeof DISPOSITION_TYPES] || d.disposition_type;
    items.push({
      id: `d-${d.id}`,
      date: d.created_at,
      type: d.disposition_type === "note" ? "note" : "disposition",
      title: label,
      detail: d.notes || undefined,
      operator: d.operator_name || undefined,
    });
  });

  agreements.forEach((a: any) => {
    items.push({
      id: `a-${a.id}`,
      date: a.created_at,
      type: "agreement",
      title: `Acordo ${a.status === "approved" ? "Aprovado" : a.status === "pending" ? "Pendente" : a.status}`,
      detail: `${formatCurrency(Number(a.original_total))} → ${formatCurrency(Number(a.proposed_total))} (${a.new_installments}x)`,
      operator: a.creator_name || undefined,
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
                return (
                  <div key={item.id} className="relative">
                    <div className={`absolute -left-6 top-3 w-[14px] h-[14px] rounded-full border-2 bg-card ${colors.dot}`} />
                    <div className={`border rounded-lg p-3 ${colors.border} ${colors.bg}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {TYPE_ICON[item.type]}
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
                      {item.detail && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{item.detail}"</p>
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
