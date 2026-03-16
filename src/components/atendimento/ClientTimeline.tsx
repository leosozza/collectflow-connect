import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { PhoneCall, Handshake, MessageSquare, DollarSign, Save, StickyNote } from "lucide-react";

interface TimelineItem {
  id: string;
  date: string;
  type: "disposition" | "agreement" | "message" | "payment" | "note";
  title: string;
  detail?: string;
  operator?: string;
}

interface ClientTimelineProps {
  dispositions: CallDisposition[];
  agreements: any[];
  observacoes?: string | null;
  onSaveNote?: (note: string) => Promise<void>;
  savingNote?: boolean;
  operatorName?: string;
}

const typeIcons = {
  disposition: PhoneCall,
  agreement: Handshake,
  message: MessageSquare,
  payment: DollarSign,
  note: StickyNote,
};

const typeColors = {
  disposition: "bg-blue-500",
  agreement: "bg-primary",
  message: "bg-emerald-500",
  payment: "bg-amber-500",
  note: "bg-muted-foreground",
};

const ClientTimeline = ({ dispositions, agreements, observacoes, onSaveNote, savingNote, operatorName }: ClientTimelineProps) => {
  const [showAll, setShowAll] = useState(false);
  const [noteText, setNoteText] = useState("");

  const items: TimelineItem[] = [];

  dispositions.forEach((d) => {
    const label = DISPOSITION_TYPES[d.disposition_type as keyof typeof DISPOSITION_TYPES] || d.disposition_type;
    items.push({
      id: `d-${d.id}`,
      date: d.created_at,
      type: d.disposition_type === "note" ? "note" : "disposition",
      title: label,
      detail: d.notes || undefined,
      operator: (d as any).operator_name || undefined,
    });
  });

  agreements.forEach((a: any) => {
    items.push({
      id: `a-${a.id}`,
      date: a.created_at,
      type: "agreement",
      title: `Acordo ${a.status === "approved" ? "Aprovado" : a.status === "pending" ? "Pendente" : a.status}`,
      detail: `${formatCurrency(Number(a.original_total))} → ${formatCurrency(Number(a.proposed_total))} (${a.new_installments}x)`,
    });
  });

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const visibleItems = showAll ? items : items.slice(0, 5);

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await onSaveNote?.(noteText.trim());
    setNoteText("");
  };

  // Parse observacoes into entries (format: "DD/MM/YYYY - HH:MM | Operator\nText")
  const parsedNotes = (() => {
    if (!observacoes) return [];
    return observacoes.split("\n---\n").filter(Boolean).map((block, i) => {
      const lines = block.trim().split("\n");
      const header = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      return { id: `note-${i}`, header, body };
    });
  })();

  return (
    <div className="space-y-4">
      {/* Histórico */}
      <Card className="border-border">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <PhoneCall className="w-4 h-4" />
            Histórico de Atendimento
          </CardTitle>
          {items.length > 5 && (
            <Button variant="link" size="sm" className="text-xs" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Mostrar menos" : "Ver tudo"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum registro</p>
          ) : (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {visibleItems.map((item) => {
                  const Icon = typeIcons[item.type];
                  const dotColor = typeColors[item.type];
                  return (
                    <div key={item.id} className="relative flex items-start gap-3">
                      {/* Dot */}
                      <div className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full flex items-center justify-center ${dotColor}`}>
                        <Icon className="w-2.5 h-2.5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{item.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.date).toLocaleDateString("pt-BR")} - {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {item.operator && (
                          <p className="text-xs text-muted-foreground">Operador: {item.operator}</p>
                        )}
                        {item.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">"{item.detail}"</p>
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

      {/* Observações */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <StickyNote className="w-4 h-4" />
            Observações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {onSaveNote && (
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar observação..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="text-sm flex-1"
              />
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote || !noteText.trim()}
                className="self-end gap-1.5"
              >
                <Save className="w-4 h-4" />
                Salvar
              </Button>
            </div>
          )}

          {parsedNotes.length > 0 ? (
            <div className="space-y-3">
              {parsedNotes.map((note) => (
                <div key={note.id} className="bg-muted/50 rounded-lg p-3 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">{note.header}</p>
                  {note.body && <p className="text-sm text-foreground">"{note.body}"</p>}
                </div>
              ))}
            </div>
          ) : (
            !onSaveNote && <p className="text-sm text-muted-foreground">Nenhuma observação</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientTimeline;
