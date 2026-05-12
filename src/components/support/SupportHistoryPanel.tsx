import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, HeadphonesIcon, DollarSign, MessageSquare, Sparkles } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

interface ConversationRow {
  id: string;
  category: "suporte" | "financeiro";
  title: string;
  messages: { role: "user" | "assistant"; content: string }[];
  created_at: string;
}

interface Props {
  onBack: () => void;
}

const formatRelative = (iso: string) => {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min}min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d atrás`;
  return d.toLocaleDateString("pt-BR");
};

const SupportHistoryPanel = ({ onBack }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [list, setList] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ConversationRow | null>(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("support_ai_conversations")
      .select("id, category, title, messages, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    } else {
      setList((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from("support_ai_conversations").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
      return;
    }
    setList((prev) => prev.filter((c) => c.id !== id));
    if (selected?.id === id) setSelected(null);
  };

  if (selected) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/40">
          <button onClick={() => setSelected(null)} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{selected.title}</p>
            <p className="text-[10px] text-muted-foreground">
              {selected.category === "financeiro" ? "Financeiro" : "Suporte"} · {formatRelative(selected.created_at)}
            </p>
          </div>
        </div>
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-[10px] text-amber-700 dark:text-amber-400 text-center">
            Conversa anterior — somente leitura
          </p>
        </div>
        <ScrollArea className="flex-1 px-4 py-3">
          {selected.messages.map((msg, i) => (
            <div key={i} className={cn("flex mb-3", msg.role === "assistant" ? "justify-start" : "justify-end")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-muted text-foreground rounded-bl-sm"
                    : "bg-primary text-primary-foreground rounded-br-sm"
                )}
              >
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-semibold text-primary">RIVO Suporte</span>
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div className="prose prose-xs prose-neutral dark:prose-invert max-w-none [&_p]:m-0 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))}
        </ScrollArea>
        <div className="px-3 py-2 border-t">
          <button
            onClick={onBack}
            className="w-full text-[11px] text-muted-foreground hover:text-primary transition-colors py-1"
          >
            Voltar ao atendimento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/40">
        <button onClick={onBack} className="p-1 hover:bg-muted rounded">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-xs font-semibold">Histórico (últimas 10)</p>
      </div>
      <ScrollArea className="flex-1 px-3 py-2">
        {loading && (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>
        )}
        {!loading && list.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma conversa anterior.</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Suas conversas encerradas aparecem aqui.
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="w-full text-left p-2.5 rounded-lg border bg-card hover:bg-muted/50 hover:border-primary/40 transition-all group"
            >
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {c.category === "financeiro" ? (
                    <DollarSign className="w-3.5 h-3.5 text-primary" />
                  ) : (
                    <HeadphonesIcon className="w-3.5 h-3.5 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{c.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {c.category === "financeiro" ? "Financeiro" : "Suporte"} · {formatRelative(c.created_at)} · {c.messages.length} msg
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(c.id, e)}
                  className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  title="Remover"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export default SupportHistoryPanel;
