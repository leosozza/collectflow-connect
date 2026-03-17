import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { atendimentoFieldsService, type FieldConfig } from "@/services/atendimentoFieldsService";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

interface Props {
  credorId: string;
}

const AtendimentoFieldsConfig = ({ credorId }: Props) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const { data: fields, isLoading, refetch } = useQuery({
    queryKey: ["atendimento-field-config", credorId],
    queryFn: () => atendimentoFieldsService.fetchFieldConfig(credorId),
    enabled: !!credorId,
  });

  // Auto-seed default fields if none exist
  useEffect(() => {
    if (fields && fields.length === 0 && tenantId && credorId) {
      atendimentoFieldsService.seedDefaultFields(tenantId, credorId).then(() => refetch());
    }
  }, [fields, tenantId, credorId, refetch]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      atendimentoFieldsService.toggleFieldVisibility(id, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-field-config", credorId] });
      toast.success("Campo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar campo"),
  });

  const visibleCount = fields?.filter((f) => f.visible).length ?? 0;

  if (!credorId) {
    return <p className="text-sm text-muted-foreground">Salve o credor primeiro para configurar os campos do atendimento.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-foreground">Campos Visíveis no Atendimento</p>
          <p className="text-xs text-muted-foreground">
            Configure quais informações o operador vê ao expandir o cabeçalho.
            {fields && fields.length > 0 && (
              <span className="ml-1 font-medium text-primary">
                {visibleCount} de {fields.length} visíveis
              </span>
            )}
          </p>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {(fields || []).map((field) => (
            <div
              key={field.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {field.visible ? (
                  <Eye className="w-4 h-4 text-primary" />
                ) : (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                )}
                <span className={`text-sm font-medium ${field.visible ? "text-foreground" : "text-muted-foreground"}`}>
                  {field.label}
                </span>
              </div>
              <Switch
                checked={field.visible}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ id: field.id, visible: checked })
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AtendimentoFieldsConfig;
