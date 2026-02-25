import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Send, Plus, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Message {
  id: string;
  content: string;
  is_staff: boolean;
  sender_id: string;
  created_at: string;
}

const statusLabels: Record<string, string> = {
  open: "Aberto",
  in_progress: "Em Andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-muted text-muted-foreground",
};

const SupportChatTab = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [newSubject, setNewSubject] = useState("");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Ticket[];
    },
    enabled: !!user,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!selectedTicket,
    refetchInterval: 5000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!selectedTicket) return;
    const channel = supabase
      .channel(`support-messages-${selectedTicket.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `ticket_id=eq.${selectedTicket.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedTicket?.id]);

  const createTicket = useMutation({
    mutationFn: async () => {
      if (!newSubject.trim() || !user || !tenant) return;
      const { error } = await supabase.from("support_tickets").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        subject: newSubject.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewSubject("");
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      toast({ title: "Ticket criado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar ticket", variant: "destructive" }),
  });

  const sendMessage = useMutation({
    mutationFn: async () => {
      if (!message.trim() || !selectedTicket || !user) return;
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicket.id,
        sender_id: user.id,
        content: message.trim(),
        is_staff: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", selectedTicket?.id] });
    },
    onError: () => toast({ title: "Erro ao enviar mensagem", variant: "destructive" }),
  });

  // Chat view
  if (selectedTicket) {
    return (
      <div className="flex flex-col h-[60vh]">
        <div className="flex items-center gap-2 pb-3 border-b">
          <button onClick={() => setSelectedTicket(null)}>
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{selectedTicket.subject}</p>
            <Badge variant="outline" className={cn("text-[10px]", statusColors[selectedTicket.status])}>
              {statusLabels[selectedTicket.status] || selectedTicket.status}
            </Badge>
          </div>
        </div>
        <div className="flex-1 overflow-auto py-3 space-y-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Envie uma mensagem para iniciar o atendimento.</p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn("flex", msg.is_staff ? "justify-start" : "justify-end")}>
              <div className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-xs",
                msg.is_staff
                  ? "bg-muted text-foreground"
                  : "bg-primary text-primary-foreground"
              )}>
                {msg.is_staff && <p className="text-[10px] font-semibold mb-0.5 opacity-70">Suporte</p>}
                <p>{msg.content}</p>
                <p className="text-[9px] opacity-60 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Input
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage.mutate()}
            className="h-9 text-xs"
          />
          <Button size="sm" onClick={() => sendMessage.mutate()} disabled={!message.trim()}>
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Ticket list
  return (
    <div className="space-y-3">
      {creating ? (
        <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
          <Input
            placeholder="Assunto do ticket..."
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="h-8 text-xs"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => createTicket.mutate()} disabled={!newSubject.trim()} className="text-xs h-7">
              Criar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCreating(false)} className="text-xs h-7">
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" onClick={() => setCreating(true)} className="w-full gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" /> Novo Ticket
        </Button>
      )}

      {isLoading && <p className="text-xs text-muted-foreground text-center py-4">Carregando...</p>}

      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => setSelectedTicket(ticket)}
          className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors space-y-1"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium truncate">{ticket.subject}</p>
            <Badge variant="outline" className={cn("text-[10px] shrink-0", statusColors[ticket.status])}>
              {statusLabels[ticket.status] || ticket.status}
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {new Date(ticket.created_at).toLocaleDateString("pt-BR")}
          </p>
        </button>
      ))}

      {!isLoading && tickets.length === 0 && !creating && (
        <p className="text-xs text-muted-foreground text-center py-8">Nenhum ticket aberto. Crie um novo para obter ajuda.</p>
      )}
    </div>
  );
};

export default SupportChatTab;
