import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface AssignOperatorDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClientIds: string[];
  onSuccess: () => void;
}

const AssignOperatorDialog = ({ open, onClose, selectedClientIds, onSuccess }: AssignOperatorDialogProps) => {
  const { tenant } = useTenant();
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [assigning, setAssigning] = useState(false);

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

  const handleAssign = async () => {
    if (!selectedOperator || selectedClientIds.length === 0) return;
    setAssigning(true);
    try {
      const batchSize = 100;
      for (let i = 0; i < selectedClientIds.length; i += batchSize) {
        const batch = selectedClientIds.slice(i, i + batchSize);
        const { error } = await supabase
          .from("clients")
          .update({ operator_id: selectedOperator })
          .in("id", batch);
        if (error) throw error;
      }
      const opName = operators.find(o => o.id === selectedOperator)?.full_name || "operador";
      toast.success(`${selectedClientIds.length} cliente(s) atribuído(s) a ${opName}`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atribuir clientes");
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Atribuir {selectedClientIds.length} cliente(s)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Selecione o operador que receberá os clientes selecionados.
          </p>
          <div className="space-y-2">
            <Label>Operador</Label>
            <Select value={selectedOperator} onValueChange={setSelectedOperator}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um operador" />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name || "Sem nome"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={assigning}>
            Cancelar
          </Button>
          <Button onClick={handleAssign} disabled={!selectedOperator || assigning} className="gap-1.5">
            {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {assigning ? "Atribuindo..." : "Atribuir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssignOperatorDialog;
