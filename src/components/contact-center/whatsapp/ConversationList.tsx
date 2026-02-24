import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, AlertTriangle, Clock, Tag, Users } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Conversation } from "@/services/conversationService";

interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

interface TagAssignment {
  conversation_id: string;
  tag_id: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  instances: { id: string; name: string }[];
  tags?: ConversationTag[];
  tagAssignments?: TagAssignment[];
  operators?: { id: string; name: string }[];
  isAdmin?: boolean;
}

function formatCompactTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  if (diff < 0) return "agora";
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}sem`;
}

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
    <div className="w-[49px] h-[49px] rounded-full bg-muted flex items-center justify-center shrink-0">
      <User className="w-6 h-6 text-muted-foreground" />
    </div>
  );
}

const ConversationList = ({ conversations, selectedId, onSelect, instances, tags = [], tagAssignments = [], operators = [], isAdmin = false }: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [operatorFilter, setOperatorFilter] = useState<string>("all");

  // Build a set of conversation IDs that have the selected tag
  const taggedConvIds = useMemo(() => {
    if (tagFilter === "all") return null;
    return new Set(tagAssignments.filter((a) => a.tag_id === tagFilter).map((a) => a.conversation_id));
  }, [tagFilter, tagAssignments]);

  // Status counts
  const statusCounts = useMemo(() => {
    const counts = { open: 0, waiting: 0, closed: 0 };
    for (const c of conversations) {
      if (c.status === "open") counts.open++;
      else if (c.status === "waiting") counts.waiting++;
      else if (c.status === "closed") counts.closed++;
    }
    return counts;
  }, [conversations]);

  const filtered = conversations.filter((c) => {
    const displayName = c.client_name || c.remote_name;
    const matchSearch =
      !search ||
      displayName.toLowerCase().includes(search.toLowerCase()) ||
      c.remote_phone.includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchInstance = instanceFilter === "all" || c.instance_id === instanceFilter;
    const matchTag = !taggedConvIds || taggedConvIds.has(c.id);
    const matchOperator = operatorFilter === "all" || c.assigned_to === operatorFilter;
    return matchSearch && matchStatus && matchInstance && matchTag && matchOperator;
  });

  const statusColors: Record<string, string> = {
    open: "bg-[#25d366]",
    waiting: "bg-yellow-500",
    closed: "bg-muted-foreground",
  };

  const statusPills = [
    { key: "open", label: "Aberta", count: statusCounts.open, color: "bg-[#25d366]" },
    { key: "waiting", label: "Aguardando", count: statusCounts.waiting, color: "bg-yellow-500" },
    { key: "closed", label: "Fechada", count: statusCounts.closed, color: "bg-muted-foreground" },
  ];

  return (
    <div className="flex flex-col h-full border-r border-border bg-card">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-border bg-[#f0f2f5] dark:bg-[#202c33]">
        {/* Row 1: Title + Operator filter (admin only) */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-base text-foreground">Conversas</h2>
          {isAdmin && operators.length > 0 && (
            <Select value={operatorFilter} onValueChange={setOperatorFilter}>
              <SelectTrigger className="h-7 text-[11px] w-[140px] bg-card">
                <Users className="w-3 h-3 mr-1 shrink-0" />
                <SelectValue placeholder="Operador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Row 2: Search */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm bg-card rounded-lg"
          />
        </div>

        {/* Row 3: Status pills */}
        <div className="flex gap-1 mb-2">
          {statusPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(statusFilter === pill.key ? "all" : pill.key)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all flex-1 justify-center ${
                statusFilter === pill.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${pill.color}`} />
              {pill.label}
              <span className={`font-bold ${statusFilter === pill.key ? "text-primary-foreground" : "text-foreground"}`}>
                {pill.count}
              </span>
            </button>
          ))}
        </div>

        {/* Row 4: Tag + Instance filters */}
        <div className="flex gap-1.5">
          {tags.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="h-7 text-[11px] flex-1 bg-card">
                <Tag className="w-3 h-3 mr-1 shrink-0" />
                <SelectValue placeholder="Etiqueta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas etiquetas</SelectItem>
                {tags.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
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
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {conv.last_message_at ? formatCompactTime(conv.last_message_at) : ""}
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
