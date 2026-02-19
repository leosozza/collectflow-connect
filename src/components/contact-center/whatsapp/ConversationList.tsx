import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, AlertTriangle, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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

// Generate a stable color from a string
function stringToColor(str: string): string {
  const colors = [
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500",
    "bg-pink-500", "bg-teal-500", "bg-indigo-500", "bg-red-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

const SYSTEM_NAME = "temis connect pay";

function ConversationAvatar({ conv }: { conv: Conversation }) {
  const displayName = conv.client_name || conv.remote_name;
  const isSystemName = displayName?.toLowerCase() === SYSTEM_NAME;

  if (displayName && !isSystemName) {
    const initials = getInitials(displayName);
    const colorClass = stringToColor(displayName);
    return (
      <div className={`w-[49px] h-[49px] rounded-full ${colorClass} flex items-center justify-center shrink-0`}>
        <span className="text-white font-semibold text-[15px]">{initials}</span>
      </div>
    );
  }

  return (
    <div className="w-[49px] h-[49px] rounded-full bg-[#dfe5e7] dark:bg-[#6b7c85] flex items-center justify-center shrink-0">
      <User className="w-6 h-6 text-[#cfd7db] dark:text-[#aebac1]" />
    </div>
  );
}

const ConversationList = ({ conversations, selectedId, onSelect, instances }: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");

  const filtered = conversations.filter((c) => {
    const displayName = c.client_name || c.remote_name;
    const matchSearch =
      !search ||
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.remote_phone.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchInstance = instanceFilter === "all" || c.instance_id === instanceFilter;
    return matchSearch && matchStatus && matchInstance;
  });

  const statusColors: Record<string, string> = {
    open: "bg-[#25d366]",
    waiting: "bg-yellow-500",
    closed: "bg-muted-foreground",
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
        <h2 className="font-semibold text-base text-foreground mb-2">Conversas</h2>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card rounded-lg"
          />
        </div>
        <div className="flex gap-1.5">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-7 text-[11px] flex-1 bg-card">
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
              <SelectTrigger className="h-7 text-[11px] flex-1 bg-card">
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
          filtered.map((conv) => {
            const displayName = conv.client_name || (conv.remote_name?.toLowerCase() !== SYSTEM_NAME ? conv.remote_name : null) || conv.remote_phone;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={`w-full text-left px-3 py-[10px] border-b border-border/30 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors overflow-hidden ${
                  selectedId === conv.id ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""
                }`}
              >
                <div className="flex items-center gap-3 w-full min-w-0">
                  <ConversationAvatar conv={conv} />
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-normal text-[15px] text-foreground truncate flex-1 min-w-0">
                        {displayName}
                      </span>
                      <span className="text-[12px] text-muted-foreground whitespace-nowrap shrink-0">
                        {conv.last_message_at
                          ? formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: false,
                              locale: ptBR,
                            })
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-[2px] gap-1">
                      <span className="text-[13px] text-muted-foreground truncate flex-1 min-w-0">
                        {conv.remote_phone}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {(() => {
                          const deadline = (conv as any).sla_deadline_at;
                          if (!deadline) return null;
                          const deadlineDate = new Date(deadline);
                          const now = new Date();
                          if (deadlineDate < now) {
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <AlertTriangle className="w-3 h-3 text-destructive" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>SLA expirado em {deadlineDate.toLocaleString("pt-BR")}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }
                          const createdAt = new Date(conv.created_at);
                          const totalMs = deadlineDate.getTime() - createdAt.getTime();
                          const remainingMs = deadlineDate.getTime() - now.getTime();
                          if (totalMs > 0 && remainingMs < totalMs * 0.25) {
                            const mins = Math.round(remainingMs / 60000);
                            return (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Clock className="w-3 h-3 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>SLA expira em {mins > 0 ? `${mins} min` : "instantes"} ({deadlineDate.toLocaleString("pt-BR")})</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }
                          return null;
                        })()}
                        <span className={`w-2.5 h-2.5 rounded-full ${statusColors[conv.status] || "bg-muted"}`} />
                        {conv.unread_count > 0 && (
                          <Badge className="h-[20px] min-w-[20px] text-[11px] px-1.5 rounded-full bg-[#25d366] text-white border-0 hover:bg-[#25d366]">
                            {conv.unread_count}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </ScrollArea>
    </div>
  );
};

export default ConversationList;
