import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, Ticket, CalendarDays, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface SupportTicket {
  id: string;
  tenant_id: string;
  user_id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
}

interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  is_staff: boolean;
  created_at: string;
}

interface ScheduleRequest {
  id: string;
  tenant_id: string;
  user_id: string;
  preferred_date: string;
  subject: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
  pending: "Pendente",
  confirmed: "Confirmado",
  done: "Realizado",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-muted text-muted-foreground",
  pending: "bg-blue-100 text-blue-800",
  confirmed: "bg-green-100 text-green-800",
  done: "bg-muted text-muted-foreground",
};

const SupportAdminPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter],
    queryFn: async () => {
      let q = supabase.from("support_tickets").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data as SupportTicket[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["admin-support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as SupportMessage[];
    },
    enabled: !!selectedTicket,
    refetchInterval: 5000,
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["admin-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_schedule_requests")
        .select("*")
        .order("preferred_date", { ascending: true });
      if (error) throw error;
      return data as ScheduleRequest[];
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendReply = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !selectedTicket || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        content: message.trim(),
        is_staff: true,
      });
      if (error) throw error;
      // Update ticket status to in_progress if open
      if (selectedTicket.status === "open") {
        await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", selectedTicket.id);
        queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      }
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["admin-support-messages", selectedTicket?.id] });
    },
  });

  const updateTicketStatus = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!selectedTicket) return;
      const { error } = await supabase.from("support_tickets").update({ status: newStatus }).eq("id", selectedTicket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      toast({ title: "Status atualizado!" });
    },
  });

  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Painel de Suporte</h1>
        <p className="text-sm text-muted-foreground">Gerencie tickets e agendamentos de suporte.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
          <p className="text-xs text-muted-foreground">Total de Tickets</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-blue-600">{openCount}</p>
          <p className="text-xs text-muted-foreground">Abertos</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-600">{inProgressCount}</p>
          <p className="text-xs text-muted-foreground">Em Andamento</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{schedules.filter((s) => s.status === "pending").length}</p>
          <p className="text-xs text-muted-foreground">Reuniões Pendentes</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="tickets">
        <TabsList>
          <TabsTrigger value="tickets" className="gap-1.5"><Ticket className="w-3.5 h-3.5" /> Tickets</TabsTrigger>
          <TabsTrigger value="schedules" className="gap-1.5"><CalendarDays className="w-3.5 h-3.5" /> Agendamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Ticket list */}
            <div className="space-y-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Abertos</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvidos</SelectItem>
                  <SelectItem value="closed">Fechados</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2 max-h-[60vh] overflow-auto">
                {tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors space-y-1",
                      selectedTicket?.id === ticket.id ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{ticket.subject}</p>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ticket.status])}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(ticket.created_at).toLocaleDateString("pt-BR")} · {ticket.priority}
                    </p>
                  </button>
                ))}
                {tickets.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket encontrado.</p>
                )}
              </div>
            </div>

            {/* Chat */}
            <div className="lg:col-span-2">
              {selectedTicket ? (
                <Card className="flex flex-col h-[60vh]">
                  <CardHeader className="py-3 px-4 border-b flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm">{selectedTicket.subject}</CardTitle>
                      <p className="text-[10px] text-muted-foreground">Criado em {new Date(selectedTicket.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                    <Select value={selectedTicket.status} onValueChange={(v) => { updateTicketStatus.mutate(v); setSelectedTicket({ ...selectedTicket, status: v }); }}>
                      <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="in_progress">Em Andamento</SelectItem>
                        <SelectItem value="resolved">Resolvido</SelectItem>
                        <SelectItem value="closed">Fechado</SelectItem>
                      </SelectContent>
                    </Select>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-auto p-4 space-y-2">
                    {messages.map((msg) => (
                      <div key={msg.id} className={cn("flex", msg.is_staff ? "justify-end" : "justify-start")}>
                        <div className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-xs",
                          msg.is_staff ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                        )}>
                          {!msg.is_staff && <p className="text-[10px] font-semibold mb-0.5 opacity-70">Cliente</p>}
                          <p>{msg.content}</p>
                          <p className="text-[9px] opacity-60 mt-1">
                            {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </CardContent>
                  <div className="flex gap-2 p-3 border-t">
                    <Input
                      placeholder="Responder ao cliente..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendReply.mutate()}
                      className="h-9 text-xs"
                    />
                    <Button size="sm" onClick={() => sendReply.mutate()} disabled={!message.trim()}>
                      <Send className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </Card>
              ) : (
                <Card className="flex items-center justify-center h-[60vh]">
                  <p className="text-sm text-muted-foreground">Selecione um ticket para ver a conversa.</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <div className="space-y-3">
            {schedules.map((s) => (
              <Card key={s.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{s.subject}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {new Date(s.preferred_date).toLocaleString("pt-BR")}
                    </div>
                    {s.notes && <p className="text-xs text-muted-foreground">{s.notes}</p>}
                  </div>
                  <Badge variant="outline" className={cn("text-xs", statusColors[s.status])}>
                    {statusLabels[s.status] || s.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            {schedules.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">Nenhum agendamento encontrado.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SupportAdminPage;
