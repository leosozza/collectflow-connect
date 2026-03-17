import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { Clock, PenLine, Save, Inbox } from "lucide-react";

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
}

interface ClientObservationsProps {
  observacoes?: string | null;
  onSaveNote?: (note: string) => Promise<void>;
  savingNote?: boolean;
}

const ClientTimeline = ({ dispositions, agreements }: ClientTimelineProps) => {
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
              {visibleItems.map((item) => (
                <div key={item.id} className="relative">
                  {/* Hollow dot */}
                  <div className="absolute -left-6 top-3 w-[14px] h-[14px] rounded-full border-2 border-muted-foreground/30 bg-card" />
                  {/* Card */}
                  <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(item.date).toLocaleDateString("pt-BR")} — {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {item.operator && (
                      <p className="text-xs text-muted-foreground mt-0.5">Operador: {item.operator}</p>
                    )}
                    {item.detail && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{item.detail}"</p>
                    )}
                  </div>
                </div>
              ))}
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
      // Try to parse "DD/MM/YYYY - HH:MM | OperatorName"
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
