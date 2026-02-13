import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, MessageCircle } from "lucide-react";

interface WhatsAppChatProps {
  messages: any[];
}

const WhatsAppChat = ({ messages }: WhatsAppChatProps) => {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <div className="flex flex-col h-[400px]">
      <ScrollArea className="flex-1 p-3">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 py-12">
            <MessageCircle className="w-8 h-8" />
            <p className="text-sm">Nenhuma conversa registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((msg) => {
              const isSent = msg.channel === "whatsapp" || msg.status === "sent" || msg.status === "delivered";
              return (
                <div
                  key={msg.id}
                  className={`flex ${isSent ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                      isSent
                        ? "bg-success text-success-foreground rounded-br-none"
                        : "bg-muted text-muted-foreground rounded-bl-none"
                    }`}
                  >
                    <p>{msg.message_body || "—"}</p>
                    <span className="text-[10px] opacity-70 block text-right mt-1">
                      {new Date(msg.created_at).toLocaleString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center gap-2 p-3 border-t">
        <Input
          placeholder="Integração em breve..."
          disabled
          className="flex-1"
        />
        <Button size="icon" disabled>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default WhatsAppChat;
