import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, User, AlertTriangle, Clock, Tag, Users, Trash2, EyeOff, Link2Off, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  ContextMenuLabel,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Conversation, ConversationFilters } from "@/services/conversationService";

interface ConversationTag {
  id: string;
  name: string;
  color: string;
}

interface TagAssignment {
  conversation_id: string;
  tag_id: string;
}

interface DispositionAssignment {
  conversation_id: string;
  disposition_type_id: string;
}

interface DispositionType {
  id: string;
  label: string;
  color: string;
  key: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
  onStatusChange?: (convId: string, status: string) => void;
  onDelete?: (convId: string) => void;
  instances: { id: string; name: string; provider_category?: string }[];
  tags?: ConversationTag[];
  tagAssignments?: TagAssignment[];
  operators?: { id: string; name: string }[];
  isAdmin?: boolean;
  dispositionAssignments?: DispositionAssignment[];
  dispositionTypes?: DispositionType[];
  statusCounts: { open: number; waiting: number; closed: number; unread: number };
  onFiltersChange: (filters: ConversationFilters) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
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
  const isUnlinked = !conv.client_id;

  const borderClass = isUnlinked ? "ring-2 ring-yellow-500" : "";

  if (displayName && !isSystemName) {
    const initials = getInitials(displayName);
    const colorClass = stringToColor(displayName);
    return (
      <div className="relative shrink-0">
        <div className={`w-[49px] h-[49px] rounded-full ${colorClass} ${borderClass} flex items-center justify-center`}>
          <span className="text-white font-semibold text-[15px]">{initials}</span>
        </div>
        {isUnlinked && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                  <Link2Off className="w-3 h-3 text-white" />
                </div>
              </TooltipTrigger>
              <TooltipContent><p>Cliente não vinculado</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div className={`w-[49px] h-[49px] rounded-full bg-muted ${borderClass} flex items-center justify-center`}>
        <User className="w-6 h-6 text-muted-foreground" />
      </div>
      {isUnlinked && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                <Link2Off className="w-3 h-3 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent><p>Cliente não vinculado</p></TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

const statusLabels: Record<string, string> = {
  open: "Aberta",
  waiting: "Aguardando",
  closed: "Fechada",
};

const ConversationList = ({
  conversations,
  selectedId,
  onSelect,
  onStatusChange,
  onDelete,
  instances,
  tags = [],
  tagAssignments = [],
  operators = [],
  isAdmin = false,
  dispositionAssignments = [],
  dispositionTypes = [],
  statusCounts,
  onFiltersChange,
  onLoadMore,
  hasMore,
  isLoadingMore,
}: ConversationListProps) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [instanceFilter, setInstanceFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [operatorFilter, setOperatorFilter] = useState<string>("all");
  const [handlerFilter, setHandlerFilter] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Propagate filter changes to parent (server-side)
  useEffect(() => {
    onFiltersChange({
      statusFilter,
      instanceFilter,
      operatorFilter,
      search,
      unreadOnly,
      handlerFilter,
    });
  }, [statusFilter, instanceFilter, operatorFilter, search, unreadOnly, handlerFilter]);

  // Debounced search
  const handleSearchChange = useCallback((value: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      setSearch(value);
    }, 300);
  }, []);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoadingMore) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, onLoadMore]);

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

  const handleConfirmDelete = () => {
    if (deleteTarget && onDelete) {
      onDelete(deleteTarget);
    }
    setDeleteTarget(null);
  };

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
                <SelectItem value="all">Operadores</SelectItem>
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
            defaultValue=""
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-8 text-sm bg-card rounded-lg"
          />
        </div>

        {/* Row 3: Status pills */}
        <div className="flex gap-1 mb-2 overflow-hidden">
          {statusPills.map((pill) => (
            <button
              key={pill.key}
              onClick={() => setStatusFilter(statusFilter === pill.key ? "all" : pill.key)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all flex-1 justify-center whitespace-nowrap min-w-0 ${
                statusFilter === pill.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${pill.color}`} />
              <span className="truncate">{pill.label}</span>
              <span className={`font-bold shrink-0 ${statusFilter === pill.key ? "text-primary-foreground" : "text-foreground"}`}>
                {pill.count}
              </span>
            </button>
          ))}
          <button
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium transition-all justify-center whitespace-nowrap shrink-0 ${
              unreadOnly
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            }`}
          >
            <EyeOff className="w-3 h-3 shrink-0" />
            <span className={`font-bold ${unreadOnly ? "text-white" : "text-foreground"}`}>
              {statusCounts.unread}
            </span>
          </button>
        </div>

        {/* Row 4: Link + Instance filters */}
        <div className="flex gap-1.5">
          <Select value={handlerFilter} onValueChange={setHandlerFilter}>
            <SelectTrigger className="h-7 text-[11px] flex-1 bg-card">
              <Bot className="w-3 h-3 mr-1 shrink-0" />
              <SelectValue placeholder="Atendente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ai">Com IA</SelectItem>
              <SelectItem value="human">Com Humano</SelectItem>
            </SelectContent>
          </Select>
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
                <SelectItem value="all">Instâncias</SelectItem>
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
      <ScrollArea className="flex-1 [&>div>div[style]]:!block [&>div>div[style]]:!min-w-0">
        {conversations.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          conversations.map((conv) => {
            const displayName = conv.client_name || (conv.remote_name?.toLowerCase() !== SYSTEM_NAME ? conv.remote_name : null) || conv.remote_phone;
            return (
              <ContextMenu key={conv.id}>
                <ContextMenuTrigger asChild>
                  <button
                    onClick={() => onSelect(conv)}
                    className={`w-full text-left px-3 py-[10px] border-b border-border/30 hover:bg-[#f5f6f6] dark:hover:bg-[#202c33] transition-colors overflow-hidden min-w-0 ${
                      selectedId === conv.id ? "bg-[#f0f2f5] dark:bg-[#2a3942]" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <ConversationAvatar conv={conv} />
                      
                      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5">
                        {/* Row 1: Name + Unread Badge + Time */}
                        <div className="flex items-center w-full min-w-0 gap-1">
                          <span className="font-semibold text-[15px] text-foreground truncate min-w-0 flex-1">
                            {displayName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {conv.unread_count > 0 && (
                              <div className="flex items-center justify-center h-[18px] min-w-[18px] px-1 rounded-full bg-[#25d366] text-white text-[11px] font-bold leading-none">
                                {conv.unread_count}
                              </div>
                            )}
                            <span className={`text-[12px] whitespace-nowrap ${conv.unread_count > 0 ? "text-[#25d366] font-medium" : "text-muted-foreground"}`}>
                              {conv.last_message_at ? formatCompactTime(conv.last_message_at) : ""}
                            </span>
                          </div>
                        </div>

                        {/* Row 2: Message preview + SLA */}
                        <div className="flex items-center w-full min-w-0 gap-2 mt-[2px]">
                          <span className="text-[13px] truncate flex-1 min-w-0 text-muted-foreground">
                            {conv.last_message_direction !== "inbound" && conv.last_message_content ? "✓ " : ""}
                            {conv.last_message_content
                              ? (conv.last_message_type !== "text"
                                ? `📎 ${conv.last_message_type === "audio" ? "Áudio" : conv.last_message_type === "image" ? "Imagem" : conv.last_message_type === "video" ? "Vídeo" : conv.last_message_type === "document" ? "Documento" : conv.last_message_type === "sticker" ? "Sticker" : "Mídia"}`
                                : conv.last_message_content)
                              : conv.remote_phone}
                          </span>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {/* SLA Clock */}
                            {(() => {
                              const deadline = (conv as any).sla_deadline_at;
                              const inst = instances.find(i => i.id === conv.instance_id);
                              const isOfficial = inst?.provider_category === "official_meta" || inst?.provider_category === "official";
                              if (!deadline || !isOfficial) return null;
                              const deadlineDate = new Date(deadline);
                              const now = new Date();
                              const remainingMs = deadlineDate.getTime() - now.getTime();
                              const remainingHours = remainingMs / 3600000;

                              let colorClass = "text-green-500";
                              let label = "";

                              if (remainingMs <= 0) {
                                colorClass = "text-red-500";
                                label = `SLA expirado em ${deadlineDate.toLocaleString("pt-BR")}`;
                              } else if (remainingHours <= 1) {
                                colorClass = "text-orange-500";
                                const mins = Math.round(remainingMs / 60000);
                                label = `SLA expira em ${mins > 0 ? `${mins} min` : "instantes"}`;
                              } else {
                                const hrs = Math.floor(remainingHours);
                                const mins = Math.round((remainingMs % 3600000) / 60000);
                                label = `SLA em ${hrs}h${mins > 0 ? `${mins}min` : ""}`;
                              }

                              return (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Clock className={`w-3.5 h-3.5 shrink-0 ${colorClass}`} />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>{label}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                          </div>
                        </div>

                        {/* Row 3: Disposition badges (if any) */}
                        {(() => {
                          const convDisps = dispositionAssignments.filter((a) => a.conversation_id === conv.id);
                          if (convDisps.length === 0) return null;
                          return (
                            <div className="flex flex-wrap gap-1 mt-1.5 overflow-hidden">
                              {convDisps.map((a) => {
                                const dt = dispositionTypes.find((d) => d.id === a.disposition_type_id);
                                if (!dt) return null;
                                return (
                                  <span
                                    key={dt.id}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-white truncate max-w-[120px]"
                                    style={{ backgroundColor: dt.color || "hsl(var(--primary))" }}
                                  >
                                    {dt.label}
                                  </span>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-52">
                  <ContextMenuLabel className="text-xs text-muted-foreground">Alterar status</ContextMenuLabel>
                  {(["open", "waiting", "closed"] as const).map((s) => (
                    <ContextMenuItem
                      key={s}
                      disabled={conv.status === s}
                      onClick={() => onStatusChange?.(conv.id, s)}
                      className="gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full ${statusColors[s]}`} />
                      {statusLabels[s]}
                      {conv.status === s && <span className="ml-auto text-[10px] text-muted-foreground">atual</span>}
                    </ContextMenuItem>
                  ))}
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    disabled={conv.status === "closed"}
                    onClick={() => onStatusChange?.(conv.id, "closed")}
                    className="gap-2"
                  >
                    <EyeOff className="w-4 h-4" />
                    Ignorar conversa
                  </ContextMenuItem>
                  {isAdmin && onDelete && (
                    <>
                      <ContextMenuItem
                        onClick={() => setDeleteTarget(conv.id)}
                        className="text-destructive focus:text-destructive gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir conversa
                      </ContextMenuItem>
                    </>
                  )}
                </ContextMenuContent>
              </ContextMenu>
            );
          })
        )}
        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-8 flex items-center justify-center">
          {isLoadingMore && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </ScrollArea>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conversa</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta conversa? Todas as mensagens serão removidas permanentemente. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ConversationList;
