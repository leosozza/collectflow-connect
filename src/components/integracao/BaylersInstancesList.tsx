import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateTenant } from "@/services/tenantService";
import {
  fetchWhatsAppInstances,
  createWhatsAppInstance,
  deleteWhatsAppInstance,
  setDefaultInstance,
  createEvolutionInstance,
  connectEvolutionInstance,
  getEvolutionInstanceStatus,
  deleteEvolutionInstance,
  WhatsAppInstance,
} from "@/services/whatsappInstanceService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Star, Trash2, Radio, QrCode, Wifi, WifiOff, Loader2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const BaylersInstancesList = () => {
  const { tenant, refetch: refetchTenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const activeProvider = settings.whatsapp_provider || "";

  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppInstance | null>(null);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [statusMap, setStatusMap] = useState<Record<string, string>>({});
  const [loadingStatus, setLoadingStatus] = useState<Record<string, boolean>>({});

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", tenant?.id],
    queryFn: () => fetchWhatsAppInstances(tenant!.id),
    enabled: !!tenant?.id,
  });

  const handleCreate = async (data: { name: string }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      const instanceName = `${tenant.name} - ${data.name}`;
      const result = await createEvolutionInstance(instanceName);

      const hash = result?.hash?.apikey || "";
      const isFirst = instances.length === 0;

      await createWhatsAppInstance({
        name: data.name,
        instance_name: instanceName,
        instance_url: "",
        api_key: hash,
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

      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      setFormOpen(false);
      toast({ title: "Instância criada!" });

      // Show QR code if available
      const qr = result?.qrcode?.base64 || result?.base64;
      if (qr) {
        setQrCodeData(qr);
        setQrDialogOpen(true);
      }
    } catch (err: any) {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (inst: WhatsAppInstance) => {
    try {
      const result = await connectEvolutionInstance(inst.instance_name);
      const qr = result?.base64 || result?.qrcode?.base64;
      if (qr) {
        setQrCodeData(qr);
        setQrDialogOpen(true);
      } else {
        toast({ title: "Instância já conectada ou QR indisponível" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleCheckStatus = async (inst: WhatsAppInstance) => {
    setLoadingStatus((prev) => ({ ...prev, [inst.id]: true }));
    try {
      const result = await getEvolutionInstanceStatus(inst.instance_name);
      const state = result?.instance?.state || result?.state || "unknown";
      setStatusMap((prev) => ({ ...prev, [inst.id]: state }));
    } catch {
      setStatusMap((prev) => ({ ...prev, [inst.id]: "error" }));
    } finally {
      setLoadingStatus((prev) => ({ ...prev, [inst.id]: false }));
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
      // Delete from Evolution API first (best effort)
      try {
        await deleteEvolutionInstance(deleteTarget.instance_name);
      } catch {
        // Ignore Evolution API errors on delete
      }
      await deleteWhatsAppInstance(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      toast({ title: "Instância removida" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const getStatusBadge = (instId: string) => {
    const state = statusMap[instId];
    if (!state) return null;
    if (state === "open") return <Badge className="bg-green-100 text-green-700 text-xs gap-1"><Wifi className="w-3 h-3" />Conectado</Badge>;
    if (state === "connecting") return <Badge className="bg-yellow-100 text-yellow-700 text-xs">Conectando...</Badge>;
    return <Badge variant="outline" className="text-xs gap-1"><WifiOff className="w-3 h-3" />Desconectado</Badge>;
  };

  return (
    <>
      <Card className={activeProvider === "baylers" ? "ring-2 ring-primary" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5" />
              Baylers (Evolution API)
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
          <CardDescription>Conexão via Evolution API — apenas informe o nome da instância</CardDescription>
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
                <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {inst.name || inst.instance_name}
                      </span>
                      {inst.is_default && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Star className="w-3 h-3 fill-current" />Padrão
                        </Badge>
                      )}
                      {getStatusBadge(inst.id)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{inst.instance_name}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleConnect(inst)}
                      title="QR Code / Conectar"
                    >
                      <QrCode className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleCheckStatus(inst)}
                      title="Verificar status"
                      disabled={loadingStatus[inst.id]}
                    >
                      {loadingStatus[inst.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                    </Button>
                    {!inst.is_default && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(inst)} title="Definir como padrão">
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
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
            onClick={() => setFormOpen(true)}
          >
            <Plus className="w-4 h-4" /> Nova Instância
          </Button>
        </CardContent>
      </Card>

      <BaylersInstanceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
        saving={saving}
        tenantName={tenant?.name || ""}
      />

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center p-4">
            {qrCodeData ? (
              <img
                src={qrCodeData.startsWith("data:") ? qrCodeData : `data:image/png;base64,${qrCodeData}`}
                alt="QR Code WhatsApp"
                className="w-64 h-64 object-contain"
              />
            ) : (
              <p className="text-muted-foreground">QR Code indisponível</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância?</AlertDialogTitle>
            <AlertDialogDescription>
              A instância "{deleteTarget?.name || deleteTarget?.instance_name}" será removida do sistema e da Evolution API.
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
