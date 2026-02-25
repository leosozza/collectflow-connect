import { useState, useEffect, useRef, useCallback } from "react";
import { LifeBuoy, X, Send, ChevronDown, Sparkles, ThumbsUp, ThumbsDown, MessageCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

interface LocalMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  rated?: "up" | "down" | null;
  isStreaming?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/support-ai-chat`;

const SupportFloatingButton = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [humanMode, setHumanMode] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const streamAIResponse = useCallback(async (userMessage: string, history: LocalMessage[]) => {
    setIsLoading(true);
    const assistantId = crypto.randomUUID();
    setMessages(prev => [...prev, { id: assistantId, role: "assistant", content: "", isStreaming: true }]);

    let assistantContent = "";

    try {
      const chatHistory = history
        .filter(m => !m.isStreaming)
        .map(m => ({ role: m.role, content: m.content }));

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ message: userMessage, history: chatHistory }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro ao conectar com IA" }));
        throw new Error(err.error || "Erro ao conectar com IA");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split("\n")) {
          if (!raw) continue;
          if (raw.endsWith("\r")) raw = raw.slice(0, -1);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === "[DONE]") continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages(prev =>
                prev.map(m => m.id === assistantId ? { ...m, content: assistantContent } : m)
              );
            }
          } catch { /* ignore */ }
        }
      }

      setMessages(prev =>
        prev.map(m => m.id === assistantId ? { ...m, isStreaming: false, rated: null } : m)
      );
    } catch (e: any) {
      console.error("AI stream error:", e);
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: "Desculpe, ocorreu um erro. Tente novamente ou fale com um humano.", isStreaming: false, rated: null }
            : m
        )
      );
      toast({ title: e.message || "Erro na IA", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleSend = useCallback(async () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    if (humanMode && ticketId && user) {
      // Human mode: save to DB
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        content: trimmed,
        is_staff: false,
      });
      if (error) {
        toast({ title: "Erro ao enviar", variant: "destructive" });
        return;
      }
      const userMsg: LocalMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
      setMessages(prev => [...prev, userMsg]);
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["support-messages", ticketId] });
      return;
    }

    const userMsg: LocalMessage = { id: crypto.randomUUID(), role: "user", content: trimmed };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setMessage("");
    await streamAIResponse(trimmed, updatedMessages);
  }, [message, isLoading, humanMode, ticketId, user, messages, streamAIResponse, toast, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRate = (msgId: string, rating: "up" | "down") => {
    setMessages(prev =>
      prev.map(m => m.id === msgId ? { ...m, rated: rating } : m)
    );
  };

  const handleTalkToHuman = async () => {
    if (!user || !tenant) return;
    try {
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({ tenant_id: tenant.id, user_id: user.id, subject: "Chat de Suporte" })
        .select("id")
        .single();
      if (error || !ticket) throw error;
      setTicketId(ticket.id);
      setHumanMode(true);

      // Save conversation context as first message
      const context = messages.map(m => `${m.role === "user" ? "Usuário" : "IA"}: ${m.content}`).join("\n");
      if (context) {
        await supabase.from("support_messages").insert({
          ticket_id: ticket.id,
          sender_id: user.id,
          content: `[Contexto do chat com IA]\n${context}`,
          is_staff: false,
        });
      }

      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Você foi conectado ao suporte humano. Um atendente responderá em breve. 🙋‍♂️",
        },
      ]);
      queryClient.invalidateQueries({ queryKey: ["support-open-ticket"] });
      toast({ title: "Ticket criado! Um atendente irá responder." });
    } catch {
      toast({ title: "Erro ao criar ticket", variant: "destructive" });
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl overflow-hidden"
            style={{ height: 600 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                <span className="font-semibold text-sm">RIVO Suporte</span>
                {humanMode && (
                  <span className="text-[10px] bg-primary-foreground/20 px-1.5 py-0.5 rounded-full">Humano</span>
                )}
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
                    Sou o assistente RIVO. Pergunte sobre qualquer funcionalidade do sistema.
                  </p>
                </div>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={cn("flex mb-3", msg.role === "assistant" ? "justify-start" : "justify-end")}>
                  <div className="flex flex-col max-w-[85%]">
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                        msg.role === "assistant"
                          ? "bg-muted text-foreground rounded-bl-sm"
                          : "bg-primary text-primary-foreground rounded-br-sm"
                      )}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex items-center gap-1 mb-1">
                          {humanMode && msg.content.includes("Humano") ? (
                            <User className="w-3 h-3 text-primary" />
                          ) : (
                            <Sparkles className="w-3 h-3 text-primary" />
                          )}
                          <span className="text-[10px] font-semibold text-primary">RIVO Suporte</span>
                        </div>
                      )}
                      {msg.role === "assistant" ? (
                        <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                          <ReactMarkdown>{msg.content || (msg.isStreaming ? "..." : "")}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>

                    {/* Feedback buttons */}
                    {msg.role === "assistant" && !msg.isStreaming && msg.rated !== undefined && (
                      <div className="flex items-center gap-1 mt-1 ml-1">
                        <button
                          onClick={() => handleRate(msg.id, "up")}
                          disabled={msg.rated !== null}
                          className={cn(
                            "p-1 rounded transition-colors",
                            msg.rated === "up"
                              ? "text-primary"
                              : msg.rated === null
                              ? "text-muted-foreground hover:text-primary"
                              : "text-muted-foreground/30"
                          )}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleRate(msg.id, "down")}
                          disabled={msg.rated !== null}
                          className={cn(
                            "p-1 rounded transition-colors",
                            msg.rated === "down"
                              ? "text-destructive"
                              : msg.rated === null
                              ? "text-muted-foreground hover:text-destructive"
                              : "text-muted-foreground/30"
                          )}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && messages[messages.length - 1]?.content === "" && (
                <div className="flex justify-start mb-3">
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-3 py-2.5 space-y-2">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  placeholder={humanMode ? "Mensagem para o atendente..." : "Pergunte algo ao RIVO..."}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-9 text-xs rounded-full border-muted bg-muted/50"
                />
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0"
                  onClick={handleSend}
                  disabled={!message.trim() || isLoading}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              {!humanMode && (
                <button
                  onClick={handleTalkToHuman}
                  className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors py-1"
                >
                  <MessageCircle className="w-3 h-3" />
                  Falar com humano
                </button>
              )}
              <p className="text-[9px] text-muted-foreground text-center">
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
