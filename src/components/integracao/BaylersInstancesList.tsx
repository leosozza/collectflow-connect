import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateTenant } from "@/services/tenantService";
import {
  fetchWhatsAppInstances,
  createWhatsAppInstance,
  updateWhatsAppInstance,
  deleteWhatsAppInstance,
  setDefaultInstance,
  WhatsAppInstance,
} from "@/services/whatsappInstanceService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Star, Pencil, Trash2, Radio } from "lucide-react";
import BaylersInstanceForm from "./BaylersInstanceForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BaylersInstancesList = () => {
  const { tenant, refetch: refetchTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const activeProvider = settings.whatsapp_provider || "";

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppInstance | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppInstance | null>(null);

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", tenant?.id],
    queryFn: () => fetchWhatsAppInstances(tenant!.id),
    enabled: !!tenant?.id,
  });

  const handleSave = async (data: { name: string; instance_url: string; api_key: string; instance_name: string }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      if (editing) {
        await updateWhatsAppInstance(editing.id, data);
        toast({ title: "Instância atualizada!" });
      } else {
        const isFirst = instances.length === 0;
        await createWhatsAppInstance({
          ...data,
          tenant_id: tenant.id,
          is_default: isFirst,
          status: "active",
        });
        if (isFirst) {
          await updateTenant(tenant.id, {
            settings: { ...settings, whatsapp_provider: "baylers" },
          });
          await refetchTenant();
        }
        toast({ title: "Instância adicionada!" });
      }
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      setFormOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSetDefault = async (inst: WhatsAppInstance) => {
    if (!tenant) return;
    try {
      await setDefaultInstance(inst.id, tenant.id);
      await updateTenant(tenant.id, {
        settings: { ...settings, whatsapp_provider: "baylers" },
      });
      await refetchTenant();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      toast({ title: `"${inst.name || inst.instance_name}" definida como padrão` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenant) return;
    try {
      await deleteWhatsAppInstance(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      toast({ title: "Instância removida" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <>
      <Card className={activeProvider === "baylers" ? "ring-2 ring-primary" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5" />
              Baylers
            </CardTitle>
            <div className="flex items-center gap-2">
              {instances.length > 0 && (
                <Badge variant="secondary" className="text-green-700 bg-green-100">
                  {instances.length} instância{instances.length > 1 ? "s" : ""}
                </Badge>
              )}
              {activeProvider === "baylers" && (
                <Badge><Radio className="w-3 h-3 mr-1" />Ativo</Badge>
              )}
            </div>
          </div>
          <CardDescription>Conexão não-oficial via instância própria</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma instância configurada
            </p>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between rounded-lg border p-3 gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">
                        {inst.name || inst.instance_name}
                      </span>
                      {inst.is_default && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Star className="w-3 h-3 fill-current" />Padrão
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{inst.instance_url}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!inst.is_default && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(inst)} title="Definir como padrão">
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(inst); setFormOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(inst)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            <Plus className="w-4 h-4" /> Nova Instância
          </Button>
        </CardContent>
      </Card>

      <BaylersInstanceForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSave={handleSave}
        saving={saving}
        instance={editing}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância?</AlertDialogTitle>
            <AlertDialogDescription>
              A instância "{deleteTarget?.name || deleteTarget?.instance_name}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default BaylersInstancesList;
