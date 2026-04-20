import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Conversation } from "@/services/conversationService";

/**
 * Lazy fetch of WhatsApp profile pictures for visible conversations.
 * - Skips conversations already attempted (remote_avatar_fetched_at !== null).
 * - Batches up to 5 ids per call, debounce 400ms.
 * - On success, mutates the local conversations array in place via the provided onUpdate callback.
 */
export function useConversationAvatars(
  conversations: Conversation[],
  onUpdate?: (id: string, url: string | null) => void
) {
  const requestedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversations || conversations.length === 0) return;

    const pending = conversations
      .filter((c: any) => !c.remote_avatar_url && !c.remote_avatar_fetched_at && !requestedRef.current.has(c.id))
      .slice(0, 30); // cap per render cycle

    if (pending.length === 0) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const batchSize = 5;
      for (let i = 0; i < pending.length; i += batchSize) {
        const batch = pending.slice(i, i + batchSize);
        const ids = batch.map((c) => c.id);
        ids.forEach((id) => requestedRef.current.add(id));
        try {
          const { data, error } = await supabase.functions.invoke("whatsapp-fetch-avatar", {
            body: { conversation_ids: ids },
          });
          if (error) {
            console.warn("[useConversationAvatars] invoke error", error);
            continue;
          }
          const results = (data as any)?.results || {};
          for (const id of Object.keys(results)) {
            const url = results[id]?.url ?? null;
            if (url && onUpdate) onUpdate(id, url);
          }
        } catch (err) {
          console.warn("[useConversationAvatars] error", err);
        }
      }
    }, 400);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [conversations, onUpdate]);
}
