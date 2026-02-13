import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, MessageCircle, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { format } from "date-fns";

interface SearchResult {
  id: string;
  conversation_id: string;
  content: string;
  created_at: string;
  direction: string;
  remote_name: string;
  remote_phone: string;
}

interface GlobalSearchProps {
  onNavigate: (conversationId: string) => void;
}

const GlobalSearch = ({ onNavigate }: GlobalSearchProps) => {
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim() || !tenant?.id) return;
    setLoading(true);

    // Search in messages
    const { data: msgData } = await supabase
      .from("chat_messages" as any)
      .select("id, conversation_id, content, created_at, direction")
      .eq("tenant_id", tenant.id)
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!msgData || msgData.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    // Get conversation info for each result
    const convIds = [...new Set((msgData as any[]).map((m: any) => m.conversation_id))];
    const { data: convData } = await supabase
      .from("conversations" as any)
      .select("id, remote_name, remote_phone")
      .in("id", convIds);

    const convMap = new Map((convData as any[] || []).map((c: any) => [c.id, c]));

    const enriched: SearchResult[] = (msgData as any[]).map((m: any) => {
      const conv = convMap.get(m.conversation_id) || {};
      return {
        ...m,
        remote_name: (conv as any).remote_name || "",
        remote_phone: (conv as any).remote_phone || "",
      };
    });

    setResults(enriched);
    setLoading(false);
  };

  const handleSelect = (conversationId: string) => {
    onNavigate(conversationId);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Search className="w-3.5 h-3.5" />
          Buscar mensagens
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">Busca Global de Mensagens</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar em todas as mensagens..."
            className="h-9 text-sm"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <Button size="sm" onClick={handleSearch} disabled={loading || !query.trim()}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="max-h-[400px]">
          {results.length === 0 && !loading && query && (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum resultado encontrado</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.conversation_id)}
              className="w-full text-left p-2.5 border-b border-border/50 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{r.remote_name || r.remote_phone}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {format(new Date(r.created_at), "dd/MM HH:mm")}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <MessageCircle className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {r.direction === "outbound" ? "Você: " : ""}
                  {r.content}
                </p>
              </div>
            </button>
          ))}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default GlobalSearch;
