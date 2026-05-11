import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, UserCog } from "lucide-react";
import { toast } from "sonner";
import { logAction } from "@/services/auditService";

interface AssignClientOperatorDialogProps {
  open: boolean;
  onClose: () => void;
  cpf: string;
  credor: string;
  clientName?: string;
}

const AssignClientOperatorDialog = ({
  open,
  onClose,
  cpf,
  credor,
  clientName,
}: AssignClientOperatorDialogProps) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [applyToConversation, setApplyToConversation] = useState(true);
  const [saving, setSaving] = useState(false);

  // Operadores do tenant
  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id && open,
  });

  // Estado atual: operator_id do cliente + assigned_to da conversa
  const { data: currentState, refetch: refetchState } = useQuery({
    queryKey: ["client-operator-state", tenant?.id, cpf, credor],
    queryFn: async () => {
      const { data: clientsRows } = await supabase
        .from("clients")
        .select("id, operator_id")
        .eq("tenant_id", tenant!.id)
        .eq("cpf", cpf)
        .eq("credor", credor);
      const clientIds = (clientsRows || []).map((c: any) => c.id);
      const operatorIds = Array.from(
        new Set((clientsRows || []).map((c: any) => c.operator_id).filter(Boolean))
      );

      let conversations: any[] = [];
      if (clientIds.length > 0) {
        const { data: convs } = await supabase
          .from("conversations")
          .select("id, assigned_to")
          .eq("tenant_id", tenant!.id)
          .in("client_id", clientIds);
        conversations = convs || [];
      }
      return { clientsRows: clientsRows || [], operatorIds, conversations };
    },
    enabled: !!tenant?.id && open && !!cpf && !!credor,
  });

  useEffect(() => {
    if (open) {
      setSelectedOperator("");
      setApplyToConversation(true);
    }
  }, [open]);

  const operatorMap = new Map(operators.map((o: any) => [o.id, o.full_name]));
  const carteiraOwnerLabel =
    currentState?.operatorIds.length
      ? currentState.operatorIds.map((id) => operatorMap.get(id) || "—").join(", ")
      : "Sem dono";
  const conversationOwnerIds = Array.from(
    new Set((currentState?.conversations || []).map((c: any) => c.assigned_to).filter(Boolean))
  );
  const conversationOwnerLabel =
    (currentState?.conversations.length || 0) === 0
      ? "Sem conversa"
      : conversationOwnerIds.length
        ? conversationOwnerIds.map((id) => operatorMap.get(id) || "—").join(", ")
        : "Sem dono";

  const hasConversation = (currentState?.conversations.length || 0) > 0;

  const handleSave = async () => {
    if (!selectedOperator || !tenant?.id) return;
    setSaving(true);
    try {
      // 1) Atualiza clients (todas as parcelas do CPF + credor no tenant)
      const { error: clientsErr } = await supabase
        .from("clients")
        .update({ operator_id: selectedOperator })
        .eq("tenant_id", tenant.id)
        .eq("cpf", cpf)
        .eq("credor", credor);
      if (clientsErr) throw clientsErr;

      // 2) Atualiza conversations (opcional)
      let convsUpdated = 0;
      if (applyToConversation && hasConversation) {
        const ids = (currentState?.conversations || []).map((c: any) => c.id);
        const { error: convErr } = await supabase
          .from("conversations")
          .update({ assigned_to: selectedOperator })
          .in("id", ids);
        if (convErr) throw convErr;
        convsUpdated = ids.length;
      }

      // 3) Audit
      await logAction({
        action: "client_reassigned",
        entity_type: "client",
        entity_id: currentState?.clientsRows?.[0]?.id,
        details: {
          cpf,
          credor,
          new_operator_id: selectedOperator,
          new_operator_name: operatorMap.get(selectedOperator) || null,
          previous_operator_ids: currentState?.operatorIds || [],
          conversations_updated: convsUpdated,
          parcelas_updated: currentState?.clientsRows?.length || 0,
        },
      });

      const opName = operatorMap.get(selectedOperator) || "operador";
      toast.success(`Cliente atribuído(a) a ${opName}`, {
        description: convsUpdated > 0 ? `Conversa de WhatsApp também atualizada.` : undefined,
      });
      await queryClient.invalidateQueries();
      await refetchState();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atribuir operador");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !saving) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5 text-primary" />
            Atribuir operador
          </DialogTitle>
          <DialogDescription>
            {clientName ? `Reatribuir ${clientName} a outro operador.` : "Reatribuir cliente a outro operador."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">Dono na Carteira</span>
              <span className="font-medium text-right">{carteiraOwnerLabel}</span>
            </div>
            <div className="flex items-start justify-between gap-3">
              <span className="text-muted-foreground">Dono da conversa WhatsApp</span>
              <span className="font-medium text-right">{conversationOwnerLabel}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Novo operador</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op: any) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {hasConversation && (
            <div className="flex items-start gap-2">
              <Checkbox
                id="apply-conversation"
                checked={applyToConversation}
                onCheckedChange={(v) => setApplyToConversation(!!v)}
              />
              <Label htmlFor="apply-conversation" className="text-sm font-normal leading-snug">
                Aplicar também à conversa de WhatsApp vinculada
              </Label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!selectedOperator || saving} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCog className="w-4 h-4" />}
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignClientOperatorDialog;
