import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications, Notification } from "@/services/notificationService";
import { useAuth } from "@/hooks/useAuth";

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], ...rest } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return { notifications, unreadCount, ...rest };
};
