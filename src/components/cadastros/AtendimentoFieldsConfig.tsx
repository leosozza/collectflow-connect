import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { atendimentoFieldsService, type FieldConfig } from "@/services/atendimentoFieldsService";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

const AtendimentoFieldsConfig = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const { data: fields, isLoading, refetch } = useQuery({
    queryKey: ["atendimento-field-config", tenantId],
    queryFn: () => atendimentoFieldsService.fetchFieldConfig(tenantId!),
    enabled: !!tenantId,
  });

  // Auto-seed default fields if none exist
  useEffect(() => {
    if (fields && fields.length === 0 && tenantId) {
      atendimentoFieldsService.seedDefaultFields(tenantId).then(() => refetch());
    }
  }, [fields, tenantId, refetch]);

  const toggleMutation = useMutation({
    mutationFn: ({ id, visible }: { id: string; visible: boolean }) =>
      atendimentoFieldsService.toggleFieldVisibility(id, visible),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-field-config", tenantId] });
      toast.success("Campo atualizado");
    },
    onError: () => toast.error("Erro ao atualizar campo"),
  });

  const visibleCount = fields?.filter((f) => f.visible).length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campos visíveis no Atendimento</CardTitle>
        <CardDescription>
          Configure quais informações do devedor o operador pode ver ao expandir o cabeçalho na tela de atendimento.
          {fields && fields.length > 0 && (
            <span className="ml-2 text-xs font-medium text-primary">
              {visibleCount} de {fields.length} visíveis
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors"
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
      </CardContent>
    </Card>
  );
};

export default AtendimentoFieldsConfig;
