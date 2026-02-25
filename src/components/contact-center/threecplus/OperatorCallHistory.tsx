import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Phone } from "lucide-react";
import { DISPOSITION_TYPES } from "@/services/dispositionService";
import { useMemo } from "react";

interface OperatorCallHistoryProps {
  onClickToCall?: (phone: string) => void;
}

const OperatorCallHistory = ({ onClickToCall }: OperatorCallHistoryProps) => {
  const { profile } = useAuth();

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }, []);

  const { data: dispositions = [], isLoading } = useQuery({
    queryKey: ["operator-call-history", profile?.id, todayStart],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from("call_dispositions")
        .select("id, disposition_type, notes, created_at, client_id")
        .eq("operator_id", profile.id)
        .gte("created_at", todayStart)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  });

  // Fetch client data for the dispositions
  const clientIds = useMemo(() => [...new Set(dispositions.map((d: any) => d.client_id).filter(Boolean))], [dispositions]);

  const { data: clients = [] } = useQuery({
    queryKey: ["operator-call-clients", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from("clients")
        .select("id, nome_completo, phone, cpf")
        .in("id", clientIds);
      if (error) throw error;
      return data || [];
    },
    enabled: clientIds.length > 0,
  });

  const clientMap = useMemo(() => {
    const map: Record<string, any> = {};
    for (const c of clients) map[c.id] = c;
    return map;
  }, [clients]);

  const dispositionLabel = (type: string) =>
    (DISPOSITION_TYPES as Record<string, string>)[type] || type;

  const dispositionColor = (type: string) => {
    const colors: Record<string, string> = {
      voicemail: "bg-red-500/10 text-red-700",
      interrupted: "bg-amber-500/10 text-amber-700",
      wrong_contact: "bg-muted text-muted-foreground",
      callback: "bg-blue-500/10 text-blue-700",
      negotiated: "bg-emerald-500/10 text-emerald-700",
      no_answer: "bg-orange-500/10 text-orange-700",
      promise: "bg-emerald-500/10 text-emerald-700",
    };
    return colors[type] || "bg-muted text-muted-foreground";
  };

  if (isLoading) return null;
  if (dispositions.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Nenhuma ligação registrada hoje.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Últimas Ligações</h3>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Telefone</TableHead>
            <TableHead className="text-xs">Identificador</TableHead>
            <TableHead className="text-xs">Protocolo</TableHead>
            <TableHead className="text-xs">Qualificação</TableHead>
            <TableHead className="text-xs">Data / Hora</TableHead>
            <TableHead className="text-xs w-16">Ligar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {dispositions.map((d: any) => {
            const client = clientMap[d.client_id];
            const phone = client?.phone || "—";
            const name = client?.nome_completo || "—";
            const protocol = d.id?.substring(0, 8).toUpperCase() || "—";
            const time = new Date(d.created_at).toLocaleString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            });

            return (
              <TableRow key={d.id} className="text-xs">
                <TableCell className="font-mono">{phone}</TableCell>
                <TableCell className="truncate max-w-[150px]">{name}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{protocol}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${dispositionColor(d.disposition_type)}`}>
                    {dispositionLabel(d.disposition_type)}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">{time}</TableCell>
                <TableCell>
                  {phone !== "—" && onClickToCall && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onClickToCall(phone)}
                    >
                      <Phone className="w-3.5 h-3.5 text-emerald-600" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default OperatorCallHistory;
