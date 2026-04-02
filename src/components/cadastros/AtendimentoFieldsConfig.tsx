import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { atendimentoFieldsService, type FieldConfig } from "@/services/atendimentoFieldsService";
import { fetchCustomFields } from "@/services/customFieldsService";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Star, StarOff, Lock, ChevronUp, ChevronDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Props {
  credorId: string;
}

const FIXED_FIELDS = [
  { label: "Nome", icon: "👤" },
  { label: "Status", icon: "🏷️" },
  { label: "CPF", icon: "🔢" },
  { label: "Credor", icon: "🏢" },
];

const AtendimentoFieldsConfig = ({ credorId }: Props) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const { data: customFields } = useQuery({
    queryKey: ["custom-fields", tenantId],
    queryFn: () => fetchCustomFields(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const { data: fields, isLoading, refetch } = useQuery({
    queryKey: ["atendimento-field-config", credorId],
    queryFn: () => atendimentoFieldsService.fetchFieldConfig(credorId),
    enabled: !!credorId,
  });

  useEffect(() => {
    if (fields && fields.length === 0 && tenantId && credorId) {
      const activeCustom = (customFields || []).filter((cf) => cf.is_active);
      atendimentoFieldsService
        .seedDefaultFields(tenantId, credorId, activeCustom)
        .then(() => refetch());
    }
  }, [fields, tenantId, credorId, customFields, refetch]);

  useEffect(() => {
    if (fields && fields.length > 0 && tenantId && credorId && customFields) {
      const activeCustom = customFields.filter((cf) => cf.is_active);
      if (activeCustom.length > 0) {
        atendimentoFieldsService
          .syncCustomFields(tenantId, credorId, activeCustom)
          .then(() => refetch());
      }
    }
  }, [fields?.length, tenantId, credorId, customFields, refetch]);

  const highlightedFields = (fields || []).filter((f) => f.is_highlighted).sort((a, b) => a.sort_order - b.sort_order);
  const availableFields = (fields || []).filter((f) => !f.is_highlighted).sort((a, b) => a.sort_order - b.sort_order);
  const highlightedCount = highlightedFields.length;

  const highlightMutation = useMutation({
    mutationFn: (highlightedIds: string[]) =>
      atendimentoFieldsService.setHighlightedBatch(credorId, highlightedIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-field-config", credorId] });
      toast.success("Campos atualizados");
    },
    onError: () => toast.error("Erro ao atualizar campos"),
  });

  const addHighlight = useCallback((field: FieldConfig) => {
    if (highlightedCount >= 4) {
      toast.error("Máximo de 4 campos extras atingido");
      return;
    }
    const newIds = [...highlightedFields.map((f) => f.id), field.id];
    highlightMutation.mutate(newIds);
  }, [highlightedFields, highlightedCount, highlightMutation]);

  const removeHighlight = useCallback((field: FieldConfig) => {
    const newIds = highlightedFields.filter((f) => f.id !== field.id).map((f) => f.id);
    highlightMutation.mutate(newIds);
  }, [highlightedFields, highlightMutation]);

  const moveHighlighted = useCallback((index: number, direction: "up" | "down") => {
    const arr = [...highlightedFields];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= arr.length) return;
    [arr[index], arr[swapIndex]] = [arr[swapIndex], arr[index]];
    highlightMutation.mutate(arr.map((f) => f.id));
  }, [highlightedFields, highlightMutation]);

  if (!credorId) {
    return <p className="text-sm text-muted-foreground">Salve o credor primeiro para configurar os campos do atendimento.</p>;
  }

  return (
    <div className="space-y-6">
      {/* Block 1: Fixed fields */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Campos sempre visíveis</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Esses campos aparecem sempre no cabeçalho e não podem ser alterados.</p>
        <div className="flex flex-wrap gap-2">
          {FIXED_FIELDS.map((f) => (
            <Badge key={f.label} variant="secondary" className="text-xs py-1.5 px-3 gap-1.5">
              <span>{f.icon}</span>
              {f.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Block 2: Highlighted fields */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            <p className="text-sm font-medium text-foreground">Campos extras visíveis no cabeçalho</p>
          </div>
          <Badge variant={highlightedCount >= 4 ? "destructive" : "outline"} className="text-xs">
            {highlightedCount} de 4 selecionados
          </Badge>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <>
            {/* Currently highlighted */}
            {highlightedFields.length > 0 && (
              <div className="space-y-1 mb-4">
                {highlightedFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-amber-500/10 border border-amber-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <span className="text-sm font-medium text-foreground">{field.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveHighlighted(index, "up")}
                        disabled={index === 0 || highlightMutation.isPending}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveHighlighted(index, "down")}
                        disabled={index === highlightedFields.length - 1 || highlightMutation.isPending}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeHighlight(field)}
                        disabled={highlightMutation.isPending}
                      >
                        <StarOff className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Available fields */}
            <p className="text-xs text-muted-foreground mb-2">Clique na estrela para adicionar ao cabeçalho:</p>
            <div className="space-y-1">
              {availableFields.map((field) => (
                <div
                  key={field.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm text-muted-foreground">{field.label}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-amber-500"
                    onClick={() => addHighlight(field)}
                    disabled={highlightedCount >= 4 || highlightMutation.isPending}
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Explanatory text */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
        <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Os campos não selecionados continuarão visíveis ao expandir "Mais informações do devedor" na ficha de atendimento.
        </p>
      </div>
    </div>
  );
};

export default AtendimentoFieldsConfig;
