import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { transferConversation } from "@/services/conversationService";
import { toast } from "sonner";

interface TransferConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  onTransferred?: () => void;
}

interface OperatorOption {
  user_id: string;
  full_name: string;
}

const TransferConversationDialog = ({
  open,
  onOpenChange,
  conversationId,
  onTransferred,
}: TransferConversationDialogProps) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const [operators, setOperators] = useState<OperatorOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toUserId, setToUserId] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    if (!open || !tenant?.id) return;
    setLoading(true);
    (async () => {
      try {
        const { data: tu, error } = await supabase
          .from("tenant_users")
          .select("user_id, profiles!inner(id, full_name, user_id)")
          .eq("tenant_id", tenant.id);
        if (error) throw error;
        const opts = (tu || [])
          .map((row: any) => ({
            user_id: row.user_id,
            full_name: row.profiles?.full_name || "Sem nome",
          }))
          .filter((o) => o.user_id !== user?.id);
        setOperators(opts);
      } catch (e) {
        console.error("[TransferDialog] load operators error:", e);
        toast.error("Erro ao carregar operadores");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, tenant?.id, user?.id]);

  const handleSubmit = async () => {
    if (!toUserId) {
      toast.warning("Selecione um operador destino");
      return;
    }
    setSubmitting(true);
    try {
      await transferConversation(conversationId, toUserId, reason.trim() || undefined);
      toast.success("Conversa transferida com sucesso");
      setReason("");
      setToUserId("");
      onOpenChange(false);
      onTransferred?.();
    } catch (e: any) {
      console.error("[TransferDialog] submit error:", e);
      toast.error(e?.message || "Erro ao transferir conversa");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir conversa</DialogTitle>
          <DialogDescription>
            Escolha o operador que assumirá esta conversa. Ele será notificado e a transferência ficará registrada no histórico.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Operador destino</Label>
            <Select value={toUserId} onValueChange={setToUserId} disabled={loading || submitting}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? "Carregando..." : "Selecione um operador"} />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.user_id} value={op.user_id}>
                    {op.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Motivo (opcional)</Label>
            <Textarea
              placeholder="Ex: cliente solicitou supervisor, fora do meu turno..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !toUserId}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TransferConversationDialog;
