import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markNotificationRead, markAllNotificationsRead, Notification } from "@/services/notificationService";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, Info, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const typeIcons: Record<string, React.ElementType> = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  action: Zap,
};

const typeColors: Record<string, string> = {
  info: "text-blue-500",
  warning: "text-warning",
  success: "text-success",
  action: "text-primary",
};

interface Props {
  notifications: Notification[];
  onClose: () => void;
}

const NotificationList = ({ notifications, onClose }: Props) => {
  const queryClient = useQueryClient();

  const readMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
        {unread > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7"
            onClick={() => readAllMutation.mutate()}
            disabled={readAllMutation.isPending}
          >
            <CheckCheck className="w-3.5 h-3.5 mr-1" />
            Marcar todas
          </Button>
        )}
      </div>

      <ScrollArea className="max-h-[320px]">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Nenhuma notificação
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.slice(0, 20).map((n) => {
              const Icon = typeIcons[n.type] || Info;
              const color = typeColors[n.type] || "text-muted-foreground";
              return (
                <div
                  key={n.id}
                  className={`px-4 py-3 flex gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                    !n.is_read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!n.is_read) readMutation.mutate(n.id);
                  }}
                >
                  <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default NotificationList;
