import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { updateTenant } from "@/services/tenantService";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchWhatsAppInstances,
  createWhatsAppInstance,
  updateWhatsAppInstance,
  deleteWhatsAppInstance,
  setDefaultInstance,
  createEvolutionInstance,
  connectEvolutionInstance,
  getEvolutionInstanceStatus,
  deleteEvolutionInstance,
  setEvolutionWebhook,
  WhatsAppInstance,
} from "@/services/whatsappInstanceService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Star, Trash2, Radio, QrCode, Wifi, WifiOff, Loader2, Pencil, Check, X, Webhook } from "lucide-react";
import { Input } from "@/components/ui/input";
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
  const [loadingQr, setLoadingQr] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", tenant?.id],
    queryFn: () => fetchWhatsAppInstances(tenant!.id),
    enabled: !!tenant?.id,
  });

  // Auto-fetch status and phone number for all instances on load
  useEffect(() => {
    if (instances.length === 0) return;
    instances.forEach((inst) => {
      if (!statusMap[inst.id] && !loadingStatus[inst.id]) {
        handleCheckStatus(inst);
      }
    });
  }, [instances]);


  // Count active conversations per instance
  const { data: conversationCounts = {} } = useQuery({
    queryKey: ["conversation-counts-by-instance", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("instance_id")
        .eq("tenant_id", tenant!.id)
        .eq("status", "open");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.instance_id] = (counts[c.instance_id] || 0) + 1;
      });
      return counts;
    },
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
        phone_number: null,
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

      // Auto-configure webhook
      try {
        await setEvolutionWebhook(instanceName);
        toast({ title: "Webhook configurado automaticamente!" });
      } catch {
        toast({ title: "Aviso", description: "Instância criada, mas webhook não pôde ser configurado. Use o botão de webhook manualmente.", variant: "destructive" });
      }

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
    setLoadingQr((prev) => ({ ...prev, [inst.id]: true }));
    try {
      const result = await connectEvolutionInstance(inst.instance_name);
      const qr = result?.base64 || result?.qrcode?.base64 || result?.code;
      if (qr) {
        setQrCodeData(qr);
        setQrDialogOpen(true);
      } else if (result?.not_found) {
        toast({ title: "Instância não encontrada", description: "Remova e recrie esta instância.", variant: "destructive" });
      } else {
        toast({ title: "Instância já conectada ou QR indisponível" });
      }
      // Auto-configure webhook after connect
      try {
        await setEvolutionWebhook(inst.instance_name);
      } catch {
        // silent — user can configure manually
      }
    } catch (err: any) {
      toast({ title: "Erro ao gerar QR Code", description: err.message, variant: "destructive" });
    } finally {
      setLoadingQr((prev) => ({ ...prev, [inst.id]: false }));
    }
  };

  const handleSetWebhook = async (inst: WhatsAppInstance) => {
    try {
      await setEvolutionWebhook(inst.instance_name);
      toast({ title: "Webhook configurado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao configurar webhook", description: err.message, variant: "destructive" });
    }
  };

  const handleCheckStatus = async (inst: WhatsAppInstance) => {
    setLoadingStatus((prev) => ({ ...prev, [inst.id]: true }));
    try {
      const result = await getEvolutionInstanceStatus(inst.instance_name);
      const state = result?.instance?.state || result?.state || "unknown";
      setStatusMap((prev) => ({ ...prev, [inst.id]: state }));

      // Save phone number if returned by the API
      const phone = result?.instance?.owner || result?.owner || null;
      if (phone && phone !== inst.phone_number) {
        await updateWhatsAppInstance(inst.id, { phone_number: phone } as any);
        queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant?.id] });
      }
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

  const handleStartEdit = (inst: WhatsAppInstance) => {
    setEditingId(inst.id);
    setEditName(inst.name || inst.instance_name);
  };

  const handleSaveEdit = async (inst: WhatsAppInstance) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === inst.name) {
      setEditingId(null);
      return;
    }
    try {
      await updateWhatsAppInstance(inst.id, { name: trimmed } as any);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant?.id] });
      toast({ title: "Nome atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setEditingId(null);
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
              WhatsApp QR Code
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
          <CardDescription>Conexão via QR Code — apenas informe o nome da instância</CardDescription>
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
                      {editingId === inst.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(inst);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm w-40"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(inst)}>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="font-medium text-sm truncate cursor-pointer hover:underline"
                          onDoubleClick={() => handleStartEdit(inst)}
                          title="Clique duplo para editar"
                        >
                          {inst.name || inst.instance_name}
                        </span>
                      )}
                      {inst.is_default && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Star className="w-3 h-3 fill-current" />Padrão
                        </Badge>
                      )}
                      {getStatusBadge(inst.id)}
                      {(conversationCounts[inst.id] || 0) > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          💬 {conversationCounts[inst.id]} ativa{conversationCounts[inst.id] > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {inst.phone_number
                        ? `📱 ${inst.phone_number.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, '+$1 ($2) $3-$4')}`
                        : inst.instance_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleStartEdit(inst)}
                      title="Editar nome"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleConnect(inst)}
                      title="QR Code / Conectar"
                      disabled={loadingQr[inst.id]}
                    >
                      {loadingQr[inst.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleSetWebhook(inst)}
                      title="Configurar Webhook"
                    >
                      <Webhook className="w-4 h-4" />
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
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  A instância <strong>"{deleteTarget?.name || deleteTarget?.instance_name}"</strong> será removida do sistema e da Evolution API.
                </p>
                {deleteTarget && (conversationCounts[deleteTarget.id] || 0) > 0 && (
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    ⚠️ Esta instância possui {conversationCounts[deleteTarget.id]} conversa{conversationCounts[deleteTarget.id] > 1 ? "s" : ""} ativa{conversationCounts[deleteTarget.id] > 1 ? "s" : ""}. As conversas serão preservadas, mas desvinculadas da instância.
                  </p>
                )}
              </div>
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
