import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useHasRivoAgreement } from "@/hooks/useHasRivoAgreement";

interface DispositionType {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
}

interface CloseConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  tenantId: string;
  onConfirm: () => Promise<void> | void;
}

const CPC_CPE_KEYS = ["cpc", "cpe"];
const EM_DIA_KEYS = ["em_dia", "wa_em_dia"];
const EM_DIA_BLOCKED_TITLE =
  "Cliente possui acordo no Rivo — esta tabulação é apenas para clientes em dia com pagamentos originais";

const CloseConversationDialog = ({
  open,
  onOpenChange,
  conversationId,
  tenantId,
  onConfirm,
}: CloseConversationDialogProps) => {
  const { profile } = useAuth();
  const [dispositions, setDispositions] = useState<DispositionType[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientCpf, setClientCpf] = useState<string | null>(null);
  const { data: hasAgreement = false } = useHasRivoAgreement(clientCpf, tenantId);

  const loadDispositions = useCallback(async () => {
    const { data } = await supabase
      .from("call_disposition_types")
      .select("id, key, label, color, sort_order")
      .eq("tenant_id", tenantId)
      .eq("channel", "whatsapp")
      .eq("active", true)
      .order("sort_order");
    setDispositions((data as DispositionType[]) || []);
  }, [tenantId]);

  const loadAssignments = useCallback(async () => {
    const { data } = await supabase
      .from("conversation_disposition_assignments" as any)
      .select("disposition_type_id")
      .eq("conversation_id", conversationId);
    setAssignedIds(new Set((data || []).map((d: any) => d.disposition_type_id as string)));
  }, [conversationId]);

  useEffect(() => {
    if (!open || !tenantId) return;
    loadDispositions();
    loadAssignments();
  }, [open, tenantId, loadDispositions, loadAssignments]);

  const isCpcCpe = (d: DispositionType) => CPC_CPE_KEYS.includes(d.key);

  const handleToggle = async (d: DispositionType) => {
    setLoading(true);
    try {
      const isAssigned = assignedIds.has(d.id);
      if (isAssigned) {
        await supabase
          .from("conversation_disposition_assignments" as any)
          .delete()
          .eq("conversation_id", conversationId)
          .eq("disposition_type_id", d.id);
      } else {
        if (isCpcCpe(d)) {
          const otherKey = d.key === "cpc" ? "cpe" : "cpc";
          const other = dispositions.find((x) => x.key === otherKey);
          if (other && assignedIds.has(other.id)) {
            await supabase
              .from("conversation_disposition_assignments" as any)
              .delete()
              .eq("conversation_id", conversationId)
              .eq("disposition_type_id", other.id);
          }
        }
        await supabase
          .from("conversation_disposition_assignments" as any)
          .insert({
            conversation_id: conversationId,
            disposition_type_id: d.id,
            assigned_by: profile?.user_id || profile?.id,
          } as any);
      }
      await loadAssignments();
    } catch (e: any) {
      if (!e?.message?.includes("duplicate")) toast.error("Erro ao atualizar tabulação");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (assignedIds.size === 0) {
      toast.warning("Selecione pelo menos uma tabulação para fechar a conversa");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao fechar conversa");
    } finally {
      setSubmitting(false);
    }
  };

  const cpcCpe = dispositions.filter(isCpcCpe);
  const others = dispositions.filter((d) => !isCpcCpe(d));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 justify-center">
            <ClipboardCheck className="w-4 h-4" />
            Tabular antes de fechar
          </DialogTitle>
          <DialogDescription>
            Selecione ao menos uma tabulação. O motivo será registrado no histórico do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto">
          {dispositions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma tabulação configurada para este tenant.
            </p>
          )}

          {cpcCpe.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Identificação do Contato
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {cpcCpe.map((d) => {
                  const active = assignedIds.has(d.id);
                  return (
                    <button key={d.id} disabled={loading} onClick={() => handleToggle(d)}>
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="text-xs cursor-pointer hover:opacity-80"
                        style={
                          active
                            ? { backgroundColor: d.color, color: "#fff", borderColor: d.color }
                            : { borderColor: d.color, color: d.color }
                        }
                      >
                        {d.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {others.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">Status</div>
              <div className="flex gap-1.5 flex-wrap">
                {others.map((d) => {
                  const active = assignedIds.has(d.id);
                  return (
                    <button key={d.id} disabled={loading} onClick={() => handleToggle(d)}>
                      <Badge
                        variant={active ? "default" : "outline"}
                        className="text-xs cursor-pointer hover:opacity-80"
                        style={
                          active
                            ? { backgroundColor: d.color, color: "#fff", borderColor: d.color }
                            : { borderColor: d.color, color: d.color }
                        }
                      >
                        {d.label}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={submitting || assignedIds.size === 0}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Fechar conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CloseConversationDialog;
