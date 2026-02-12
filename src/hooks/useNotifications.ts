import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications, Notification } from "@/services/notificationService";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export const useNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [celebrationNotification, setCelebrationNotification] = useState<Notification | null>(null);

  const { data: notifications = [], ...rest } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => fetchNotifications(),
    enabled: !!user,
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const dismissCelebration = useCallback(() => {
    setCelebrationNotification(null);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification;

          // Agreement celebration popup
          if (
            newNotification.reference_type === "agreement" &&
            newNotification.type === "success"
          ) {
            setCelebrationNotification(newNotification);
          }

          // Payment toast
          if (
            newNotification.reference_type === "payment" &&
            newNotification.type === "success"
          ) {
            toast.success(newNotification.title, {
              description: newNotification.message,
              duration: 6000,
            });
          }

          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
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

  return {
    notifications,
    unreadCount,
    celebrationNotification,
    dismissCelebration,
    ...rest,
  };
};
