import { useState, useEffect, useRef, useCallback } from "react";
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
  WhatsAppInstance,
} from "@/services/whatsappInstanceService";
import {
  connectWuzapiInstance,
  getWuzapiQrCode,
  getWuzapiStatus,
  disconnectWuzapiInstance,
  setWuzapiWebhook,
} from "@/services/wuzapiService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Server, Plus, Star, Trash2, Radio, QrCode, Wifi, WifiOff, Loader2, Pencil, Check, X, Webhook } from "lucide-react";
import { Input } from "@/components/ui/input";
import WuzApiInstanceForm from "./WuzApiInstanceForm";
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

const WuzApiInstancesList = () => {
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
  const [qrConnected, setQrConnected] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Filter only wuzapi instances
  const { data: allInstances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances", tenant?.id],
    queryFn: () => fetchWhatsAppInstances(tenant!.id),
    enabled: !!tenant?.id,
  });

  const instances = allInstances.filter((i: any) => (i as any).provider === "wuzapi");

  // Auto-fetch status on load
  useEffect(() => {
    if (instances.length === 0) return;
    instances.forEach((inst) => {
      if (!statusMap[inst.id] && !loadingStatus[inst.id]) {
        handleCheckStatus(inst);
      }
    });
  }, [instances.length]);

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

  const handleCreate = async (data: { name: string; serverUrl: string; userToken: string }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      await createWhatsAppInstance({
        name: data.name,
        instance_name: data.name,
        instance_url: data.serverUrl,
        api_key: data.userToken,
        tenant_id: tenant.id,
        is_default: instances.length === 0,
        status: "active",
        phone_number: null,
      } as any);

      if (instances.length === 0) {
        await updateTenant(tenant.id, {
          settings: { ...settings, whatsapp_provider: "wuzapi" },
        });
        await refetchTenant();
      }

      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      setFormOpen(false);
      toast({ title: "Instância WuzAPI criada!" });
    } catch (err: any) {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((inst: WhatsAppInstance) => {
    stopPolling();
    setQrConnected(false);
    let elapsed = 0;
    pollingRef.current = setInterval(async () => {
      elapsed += 5000;
      if (elapsed > 120000) {
        stopPolling();
        toast({ title: "Tempo esgotado", description: "Tente conectar novamente.", variant: "destructive" });
        return;
      }
      try {
        const result = await getWuzapiStatus(inst.id);
        const state = result?.Connected ? "open" : "disconnected";
        setStatusMap((prev) => ({ ...prev, [inst.id]: state }));
        if (state === "open") {
          stopPolling();
          setQrConnected(true);
          toast({ title: "WhatsApp conectado com sucesso! ✅" });
          setTimeout(() => {
            setQrDialogOpen(false);
            setQrConnected(false);
          }, 2000);
        }
      } catch {
        // ignore polling errors
      }
    }, 5000);
  }, [stopPolling, toast]);

  useEffect(() => {
    if (!qrDialogOpen) {
      stopPolling();
      setQrConnected(false);
    }
  }, [qrDialogOpen, stopPolling]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleConnect = async (inst: WhatsAppInstance) => {
    setLoadingQr((prev) => ({ ...prev, [inst.id]: true }));
    try {
      await connectWuzapiInstance(inst.id);
      // Get QR code
      const qrResult = await getWuzapiQrCode(inst.id);
      const qr = qrResult?.QRCode || qrResult?.qrcode || qrResult?.code;
      if (qr) {
        setQrCodeData(qr);
        setQrDialogOpen(true);
        startPolling(inst);
      } else {
        toast({ title: "QR Code não disponível", description: "Verifique se a instância está configurada corretamente." });
      }
      // Auto webhook
      try {
        await setWuzapiWebhook(inst.id);
      } catch { /* silent */ }
    } catch (err: any) {
      toast({ title: "Erro ao conectar", description: err.message, variant: "destructive" });
    } finally {
      setLoadingQr((prev) => ({ ...prev, [inst.id]: false }));
    }
  };

  const handleCheckStatus = async (inst: WhatsAppInstance) => {
    setLoadingStatus((prev) => ({ ...prev, [inst.id]: true }));
    try {
      const result = await getWuzapiStatus(inst.id);
      const state = result?.Connected ? "open" : "disconnected";
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
        settings: { ...settings, whatsapp_provider: "wuzapi" },
      });
      await refetchTenant();
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      toast({ title: `"${inst.name}" definida como padrão` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenant) return;
    try {
      try {
        await disconnectWuzapiInstance(deleteTarget.id);
      } catch { /* ignore */ }
      await deleteWhatsAppInstance(deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances", tenant.id] });
      toast({ title: "Instância removida" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleSetWebhook = async (inst: WhatsAppInstance) => {
    try {
      await setWuzapiWebhook(inst.id);
      toast({ title: "Webhook configurado com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao configurar webhook", description: err.message, variant: "destructive" });
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
    return <Badge variant="outline" className="text-xs gap-1"><WifiOff className="w-3 h-3" />Desconectado</Badge>;
  };

  return (
    <>
      <Card className={activeProvider === "wuzapi" ? "ring-2 ring-primary" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Server className="w-5 h-5" />
              WuzAPI
            </CardTitle>
            <div className="flex items-center gap-2">
              {instances.length > 0 && (
                <Badge variant="secondary" className="text-green-700 bg-green-100">
                  {instances.length} instância{instances.length > 1 ? "s" : ""}
                </Badge>
              )}
              {activeProvider === "wuzapi" && (
                <Badge><Radio className="w-3 h-3 mr-1" />Ativo</Badge>
              )}
            </div>
          </div>
          <CardDescription>WhatsApp via WuzAPI (whatsmeow/Go) — self-hosted</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma instância WuzAPI configurada
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
                        ? `📱 ${inst.phone_number}`
                        : inst.instance_url || inst.instance_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleStartEdit(inst)} title="Editar nome">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleConnect(inst)} title="QR Code / Conectar" disabled={loadingQr[inst.id]}>
                      {loadingQr[inst.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCheckStatus(inst)} title="Verificar status" disabled={loadingStatus[inst.id]}>
                      {loadingStatus[inst.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetWebhook(inst)} title="Configurar Webhook">
                      <Webhook className="w-4 h-4" />
                    </Button>
                    {!inst.is_default && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(inst)} title="Definir como padrão">
                        <Star className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(inst)} title="Remover">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" className="w-full gap-2" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4" />
            Adicionar instância WuzAPI
          </Button>
        </CardContent>
      </Card>

      <WuzApiInstanceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleCreate}
        saving={saving}
      />

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneie o QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrConnected ? (
              <div className="flex flex-col items-center gap-2">
                <Check className="w-16 h-16 text-green-500" />
                <p className="text-green-600 font-medium">Conectado!</p>
              </div>
            ) : qrCodeData ? (
              qrCodeData.startsWith("data:") ? (
                <img src={qrCodeData} alt="QR Code" className="w-64 h-64" />
              ) : (
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(qrCodeData)}`}
                  alt="QR Code"
                  className="w-64 h-64"
                />
              )
            ) : (
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            )}
            {!qrConnected && (
              <p className="text-xs text-muted-foreground text-center">
                Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar um aparelho
              </p>
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
              A instância "{deleteTarget?.name || deleteTarget?.instance_name}" será removida.
              {(conversationCounts[deleteTarget?.id || ""] || 0) > 0 && (
                <span className="block mt-2 font-medium text-amber-600">
                  ⚠️ {conversationCounts[deleteTarget?.id || ""]} conversa(s) ativa(s) serão desvinculadas.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default WuzApiInstancesList;
