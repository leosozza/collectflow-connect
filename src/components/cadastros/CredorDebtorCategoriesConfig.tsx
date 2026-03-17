import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface Props {
  credorId?: string;
}

const COLORS = ["#6B7280", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"];

const CredorDebtorCategoriesConfig = ({ credorId }: Props) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6B7280");

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["debtor-categories", credorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtor_categories" as any)
        .select("*")
        .eq("credor_id", credorId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!credorId,
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("debtor_categories" as any).insert({
        tenant_id: tenant!.id,
        credor_id: credorId!,
        nome: newName.trim(),
        cor: newColor,
        sort_order: categories.length,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtor-categories", credorId] });
      setNewName("");
      toast.success("Categoria adicionada");
    },
    onError: () => toast.error("Erro ao adicionar categoria"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("debtor_categories" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["debtor-categories", credorId] });
      toast.success("Categoria removida");
    },
    onError: () => toast.error("Erro ao remover categoria"),
  });

  if (!credorId) {
    return <p className="text-sm text-muted-foreground">Salve o credor primeiro para configurar categorias.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">Nome da Categoria</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ex: Devedor contumaz"
            className="h-9 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Cor</Label>
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => addMutation.mutate()}
          disabled={!newName.trim() || addMutation.isPending}
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : categories.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma categoria cadastrada.</p>
      ) : (
        <div className="space-y-1.5">
          {categories.map((cat: any) => (
            <div key={cat.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
              <GripVertical className="w-4 h-4 text-muted-foreground/40" />
              <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
              <span className="text-sm flex-1">{cat.nome}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(cat.id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CredorDebtorCategoriesConfig;
