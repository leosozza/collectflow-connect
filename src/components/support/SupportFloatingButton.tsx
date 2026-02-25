import { useState, useEffect, useRef } from "react";
import { LifeBuoy, X, Send, ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Ticket {
  id: string;
  subject: string;
  status: string;
}

interface Message {
  id: string;
  content: string;
  is_staff: boolean;
  sender_id: string;
  created_at: string;
}

const SupportFloatingButton = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load or find open ticket
  const { data: openTicket } = useQuery({
    queryKey: ["support-open-ticket"],
    queryFn: async () => {
      const { data } = await supabase
        .from("support_tickets")
        .select("id, subject, status")
        .in("status", ["open", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return data as Ticket | null;
    },
    enabled: !!user && open,
  });

  useEffect(() => {
    if (openTicket) setTicketId(openTicket.id);
  }, [openTicket]);

  // Messages
  const { data: messages = [] } = useQuery({
    queryKey: ["support-messages", ticketId],
    queryFn: async () => {
      if (!ticketId) return [];
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      return (data || []) as Message[];
    },
    enabled: !!ticketId,
    refetchInterval: 5000,
  });

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime
  useEffect(() => {
    if (!ticketId) return;
    const channel = supabase
      .channel(`support-chat-${ticketId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${ticketId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [ticketId, queryClient]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  // Create ticket + send first message
  const createTicketAndSend = async (content: string) => {
    if (!user || !tenant) return;
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({ tenant_id: tenant.id, user_id: user.id, subject: "Chat de Suporte" })
      .select("id")
      .single();
    if (error || !ticket) throw error;
    setTicketId(ticket.id);
    queryClient.invalidateQueries({ queryKey: ["support-open-ticket"] });

    const { error: msgErr } = await supabase.from("support_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      content,
      is_staff: false,
    });
    if (msgErr) throw msgErr;
  };

  const sendMessage = useMutation({
    mutationFn: async () => {
      const trimmed = message.trim();
      if (!trimmed || !user) return;

      if (!ticketId) {
        await createTicketAndSend(trimmed);
      } else {
        const { error } = await supabase.from("support_messages").insert({
          ticket_id: ticketId,
          sender_id: user.id,
          content: trimmed,
          is_staff: false,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
    },
    onError: () => toast({ title: "Erro ao enviar mensagem", variant: "destructive" }),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (message.trim()) sendMessage.mutate();
    }
  };

  return (
    <>
      {/* Chat Widget */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl overflow-hidden"
            style={{ height: 500 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold text-sm">RIVO Suporte</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
                onClick={() => setOpen(false)}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-4 py-3">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Olá! 👋</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                    Como posso te ajudar? Pergunte sobre qualquer funcionalidade do sistema.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex mb-3", msg.is_staff ? "justify-start" : "justify-end")}>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                    msg.is_staff
                      ? "bg-muted text-foreground rounded-bl-sm"
                      : "bg-primary text-primary-foreground rounded-br-sm"
                  )}>
                    {msg.is_staff && (
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-semibold text-primary">RIVO Suporte</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className={cn(
                      "text-[9px] mt-1.5",
                      msg.is_staff ? "text-muted-foreground" : "text-primary-foreground/60"
                    )}>
                      {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input */}
            <div className="border-t px-3 py-2.5">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder="Pergunte algo ao RIVO..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-9 text-xs rounded-full border-muted bg-muted/50"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  onClick={() => message.trim() && sendMessage.mutate()}
                  disabled={!message.trim() || sendMessage.isPending}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <p className="text-[9px] text-muted-foreground text-center mt-1.5">
                O RIVO pode cometer erros. Verifique informações importantes.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <Button
        onClick={() => setOpen((prev) => !prev)}
        size="icon"
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg transition-all duration-200",
          open
            ? "bg-muted text-muted-foreground hover:bg-muted/80"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {open ? <X className="w-6 h-6" /> : <LifeBuoy className="w-6 h-6" />}
      </Button>
    </>
  );
};

export default SupportFloatingButton;
