import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageCircle, User, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Conversation } from "@/services/conversationService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  instances: { id: string; name: string }[];
}

const ConversationList = ({ conversations, selectedId, onSelect, instances }: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");

  const filtered = conversations.filter((c) => {
    const matchSearch =
      !search ||
      c.remote_name.toLowerCase().includes(search.toLowerCase()) ||
      c.remote_phone.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchInstance = instanceFilter === "all" || c.instance_id === instanceFilter;
    return matchSearch && matchStatus && matchInstance;
  });

  const statusColors: Record<string, string> = {
    open: "bg-green-500",
    waiting: "bg-yellow-500",
    closed: "bg-muted-foreground",
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">Conversas</span>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <div className="flex gap-1.5">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">Aberta</SelectItem>
              <SelectItem value="waiting">Aguardando</SelectItem>
              <SelectItem value="closed">Fechada</SelectItem>
            </SelectContent>
          </Select>
          {instances.length > 1 && (
            <Select value={instanceFilter} onValueChange={setInstanceFilter}>
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="Instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {instances.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filtered.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv)}
              className={`w-full text-left p-3 border-b border-border/50 hover:bg-accent/30 transition-colors ${
                selectedId === conv.id ? "bg-accent/50" : ""
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">
                      {conv.remote_name || conv.remote_phone}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-1">
                      {conv.last_message_at
                        ? formatDistanceToNow(new Date(conv.last_message_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })
                        : ""}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs text-muted-foreground truncate">
                      {conv.remote_phone}
                    </span>
                    <div className="flex items-center gap-1">
                      {(conv as any).sla_deadline_at && new Date((conv as any).sla_deadline_at) < new Date() && (
                        <AlertTriangle className="w-3 h-3 text-destructive" />
                      )}
                      <span className={`w-2 h-2 rounded-full ${statusColors[conv.status] || "bg-muted"}`} />
                      {conv.unread_count > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1.5 rounded-full">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
