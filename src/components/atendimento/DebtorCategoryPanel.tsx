import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tags } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clientId: string;
  credorName: string;
  currentCategoryId?: string | null;
  tenantId?: string;
  clientCpf?: string;
  disabled?: boolean;
}

const DebtorCategoryPanel = ({ clientId, credorName, currentCategoryId, tenantId, clientCpf }: Props) => {
  const queryClient = useQueryClient();

  const { data: credor } = useQuery({
    queryKey: ["credor-by-name", credorName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credores" as any)
        .select("id")
        .eq("razao_social", credorName)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!credorName,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["debtor-categories", credor?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debtor_categories" as any)
        .select("*")
        .eq("credor_id", credor!.id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!credor?.id,
  });

  const mutation = useMutation({
    mutationFn: async (categoryId: string | null) => {
      // Update client
      const { error } = await supabase
        .from("clients")
        .update({ debtor_category_id: categoryId } as any)
        .eq("id", clientId);
      if (error) throw error;

      // Log to client_events
      if (tenantId && clientCpf) {
        const selectedCat = categories.find((c: any) => c.id === categoryId);
        const { error: eventError } = await supabase
          .from("client_events")
          .insert({
            tenant_id: tenantId,
            client_id: clientId,
            client_cpf: clientCpf,
            event_type: "debtor_category",
            event_source: "operator",
            event_channel: null,
            event_value: selectedCat ? selectedCat.nome : "removed",
            metadata: {
              category_id: categoryId,
              category_name: selectedCat?.nome || null,
              category_color: selectedCat?.cor || null,
              previous_category_id: currentCategoryId || null,
            },
          });
        if (eventError) console.error("Error logging debtor_category event:", eventError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-client", clientId] });
      toast.success("Categoria do devedor atualizada");
    },
    onError: () => toast.error("Erro ao atualizar categoria"),
  });

  if (!categories.length) return null;

  const handleSelect = (catId: string) => {
    const newVal = catId === currentCategoryId ? null : catId;
    mutation.mutate(newVal);
  };

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Tags className="w-4 h-4" />
          Categorização do Devedor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {categories.map((cat: any) => {
            const isActive = currentCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                disabled={mutation.isPending}
                onClick={() => handleSelect(cat.id)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all disabled:opacity-50
                  ${isActive
                    ? "border-primary bg-primary/5 text-primary"
                    : "bg-card border-border text-foreground hover:bg-muted/50"
                  }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.cor }} />
                <span className="truncate">{cat.nome}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default DebtorCategoryPanel;
