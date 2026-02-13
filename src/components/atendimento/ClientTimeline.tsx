import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { PhoneCall, Handshake, MessageSquare, DollarSign } from "lucide-react";

interface TimelineItem {
  id: string;
  date: string;
  type: "disposition" | "agreement" | "message" | "payment";
  title: string;
  detail?: string;
}

interface ClientTimelineProps {
  dispositions: CallDisposition[];
  agreements: any[];
  messages: any[];
}

const typeIcons = {
  disposition: PhoneCall,
  agreement: Handshake,
  message: MessageSquare,
  payment: DollarSign,
};

const typeColors = {
  disposition: "bg-muted text-muted-foreground",
  agreement: "bg-primary/10 text-primary",
  message: "bg-success/10 text-success",
  payment: "bg-warning/10 text-warning",
};

const ClientTimeline = ({ dispositions, agreements, messages }: ClientTimelineProps) => {
  const items: TimelineItem[] = [];

  dispositions.forEach((d) => {
    const label = DISPOSITION_TYPES[d.disposition_type as keyof typeof DISPOSITION_TYPES] || d.disposition_type;
    items.push({
      id: `d-${d.id}`,
      date: d.created_at,
      type: "disposition",
      title: label,
      detail: d.notes || undefined,
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

  messages.forEach((m: any) => {
    items.push({
      id: `m-${m.id}`,
      date: m.created_at,
      type: "message",
      title: `WhatsApp - ${m.status}`,
      detail: m.message_body?.slice(0, 80) || undefined,
    });
  });

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = typeIcons[item.type];
              return (
                <div key={item.id} className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${typeColors[item.type]}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.date).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {item.detail && (
                      <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTimeline;
