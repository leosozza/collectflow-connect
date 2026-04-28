import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { fetchWhatsAppInstances, WhatsAppInstance } from "@/services/whatsappInstanceService";
import { formatPhone } from "@/lib/formatters";
import { toast } from "sonner";
import { MessageCircle, ShieldCheck, AlertTriangle } from "lucide-react";

interface PhoneOption {
  value: string; // E.164 (digits-only, with 55 prefix)
  raw: string;
  isPrimary?: boolean;
  source?: string;
}

interface ExistingConv {
  id: string;
  instance_id: string | null;
  remote_phone: string;
  status: string;
  last_message_at: string | null;
  updated_at: string | null;
  client_id: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: any;
  allClientPhones?: any[];
}

const normalizeE164 = (raw: string): string => {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("55") ? digits : `55${digits}`;
};

const statusLabel = (s: string) => {
  if (s === "open") return "Aberta";
  if (s === "closed") return "Fechada";
  if (s === "waiting") return "Aguardando";
  return s;
};

const StartWhatsAppConversationDialog = ({
  open,
  onOpenChange,
  client,
  allClientPhones = [],
}: Props) => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { tenant, tenantUser } = useTenant();
  const tenantId = tenant?.id;
  const isAdmin = tenantUser?.role === "admin" || tenantUser?.role === "super_admin";

  // Build phone options: dedupe by E.164
  const phoneOptions: PhoneOption[] = useMemo(() => {
    const map = new Map<string, PhoneOption>();
    const fallback = [
      { raw: client?.phone, isPrimary: true, source: "Telefone 1" },
      { raw: client?.phone2, source: "Telefone 2" },
      { raw: client?.phone3, source: "Telefone 3" },
    ];
    for (const f of fallback) {
      if (!f.raw) continue;
      const e164 = normalizeE164(f.raw);
      if (e164 && !map.has(e164)) map.set(e164, { value: e164, raw: f.raw, isPrimary: f.isPrimary, source: f.source });
    }
    for (const p of allClientPhones) {
      const raw = p?.phone_e164 || p?.phone_number;
      if (!raw) continue;
      const e164 = normalizeE164(raw);
      if (e164 && !map.has(e164)) {
        map.set(e164, { value: e164, raw, source: p?.source || p?.phone_type || "Outro" });
      }
    }
    return Array.from(map.values());
  }, [client, allClientPhones]);

  // Suffixes (last 8 digits) of all known client phone numbers
  const allPhoneSuffixes = useMemo(
    () => Array.from(new Set(phoneOptions.map((p) => p.value.replace(/\D/g, "").slice(-8)).filter(Boolean))),
    [phoneOptions]
  );

  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances-allowed", tenantId, profile?.id, isAdmin],
    queryFn: async (): Promise<WhatsAppInstance[]> => {
      if (!tenantId) return [];
      const all = await fetchWhatsAppInstances(tenantId);
      const active = all.filter((i) => i.status !== "disconnected" || true);
      if (isAdmin) return active;
      if (!profile?.id) return [];
      const { data: assignments } = await supabase
        .from("operator_instances" as any)
        .select("instance_id")
        .eq("profile_id", profile.id)
        .eq("tenant_id", tenantId);
      const allowed = new Set((assignments || []).map((a: any) => a.instance_id));
      return active.filter((i) => allowed.has(i.id));
    },
    enabled: open && !!tenantId,
  });

  const allowedInstanceIds = useMemo(() => instances.map((i) => i.id), [instances]);

  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [selectedInstance, setSelectedInstance] = useState<string>("");

  // Fetch ALL open/waiting conversations across allowed instances for this client.
  // Match by client_id OR by phone suffix (covers conversations not yet linked).
  const { data: existingConvs = [], isLoading: loadingExisting } = useQuery({
    queryKey: ["client-open-convs", tenantId, allowedInstanceIds, client?.id, allPhoneSuffixes.join(",")],
    queryFn: async (): Promise<ExistingConv[]> => {
      if (!tenantId || allowedInstanceIds.length === 0) return [];
      const { data, error } = await supabase
        .from("conversations")
        .select("id, instance_id, remote_phone, status, last_message_at, updated_at, client_id")
        .eq("tenant_id", tenantId)
        .in("instance_id", allowedInstanceIds)
        .in("status", ["open", "waiting"])
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) {
        console.error("Error fetching existing conversations:", error);
        return [];
      }
      return (data || []).filter((c: any) => {
        if (client?.id && c.client_id === client.id) return true;
        const suf = (c.remote_phone || "").replace(/\D/g, "").slice(-8);
        return allPhoneSuffixes.includes(suf);
      }) as ExistingConv[];
    },
    enabled: open && !!tenantId && allowedInstanceIds.length > 0,
  });

  // Group existing conversations by instance — pick the most recent per instance.
  const convsByInstance = useMemo(() => {
    const map = new Map<string, ExistingConv>();
    for (const c of existingConvs) {
      if (!c.instance_id) continue;
      const prev = map.get(c.instance_id);
      const prevTs = prev?.last_message_at ? new Date(prev.last_message_at).getTime() : 0;
      const curTs = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (!prev || curTs > prevTs) map.set(c.instance_id, c);
    }
    return Array.from(map.entries()).map(([instanceId, conv]) => ({
      instance: instances.find((i) => i.id === instanceId),
      conv,
    }));
  }, [existingConvs, instances]);

  const selectedInstanceHasOpen = useMemo(
    () => convsByInstance.some(({ instance }) => instance?.id === selectedInstance),
    [convsByInstance, selectedInstance]
  );

  useEffect(() => {
    if (!open) return;
    if (!selectedPhone && phoneOptions.length > 0) {
      const primary = phoneOptions.find((p) => p.isPrimary) || phoneOptions[0];
      setSelectedPhone(primary.value);
    }
  }, [open, phoneOptions, selectedPhone]);

  useEffect(() => {
    if (!open) return;
    if (!selectedInstance && instances.length > 0) {
      const def = instances.find((i) => i.is_default) || instances[0];
      setSelectedInstance(def.id);
    }
  }, [open, instances, selectedInstance]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setSelectedPhone("");
      setSelectedInstance("");
    }
  }, [open]);

  const handleOpenExisting = (conv: ExistingConv) => {
    onOpenChange(false);
    navigate(`/contact-center/whatsapp?conversationId=${conv.id}`);
  };

  const handleConfirm = () => {
    if (!selectedPhone) {
      toast.error("Selecione um telefone");
      return;
    }
    if (!selectedInstance) {
      toast.error("Selecione uma instância de WhatsApp");
      return;
    }
    onOpenChange(false);
    navigate(
      `/contact-center/whatsapp?phone=${selectedPhone}&instanceId=${selectedInstance}&forceNew=1`
    );
  };

  const noInstances = !loadingInstances && instances.length === 0;

  const isOfficial = (inst?: WhatsAppInstance) =>
    inst?.provider_category === "official_meta" || (inst as any)?.provider_category === "official";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-left">Abrir conversa no WhatsApp</DialogTitle>
          <DialogDescription className="text-left">
            Veja as conversas em andamento ou inicie uma nova por outra instância.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Conversas em andamento (agrupadas por instância) */}
          {loadingExisting ? (
            <div className="text-xs text-muted-foreground">Verificando conversas existentes...</div>
          ) : convsByInstance.length > 0 ? (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Conversas em andamento ({convsByInstance.length})
              </Label>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {convsByInstance.map(({ instance, conv }) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {instance?.name || "Instância desconhecida"}
                        </span>
                        {isOfficial(instance) && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] bg-green-500/20 text-green-700 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                            <ShieldCheck className="w-3 h-3" /> Oficial
                          </span>
                        )}
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {statusLabel(conv.status)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        <div>📞 {formatPhone(conv.remote_phone)}</div>
                        {conv.last_message_at && (
                          <div>Último contato: {new Date(conv.last_message_at).toLocaleString("pt-BR")}</div>
                        )}
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => handleOpenExisting(conv)}>
                      <MessageCircle className="h-3.5 w-3.5 mr-1.5" />
                      Abrir
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Iniciar nova conversa */}
          <div className="space-y-3 pt-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Iniciar nova conversa
            </Label>

            <div className="space-y-2">
              <Label>Telefone do devedor</Label>
              {phoneOptions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum telefone cadastrado para este devedor.</p>
              ) : (
                <Select value={selectedPhone} onValueChange={setSelectedPhone}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar telefone" />
                  </SelectTrigger>
                  <SelectContent>
                    {phoneOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <div className="flex items-center gap-2">
                          <span>{formatPhone(p.raw)}</span>
                          {p.isPrimary && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Principal</Badge>
                          )}
                          {p.source && !p.isPrimary && (
                            <span className="text-xs text-muted-foreground">· {p.source}</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Instância de envio</Label>
              {loadingInstances ? (
                <p className="text-sm text-muted-foreground">Carregando instâncias...</p>
              ) : noInstances ? (
                <p className="text-sm text-destructive">
                  Você não possui nenhuma instância de WhatsApp atribuída. Solicite acesso ao administrador.
                </p>
              ) : (
                <Select value={selectedInstance} onValueChange={setSelectedInstance}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.map((i) => {
                      const hasOpen = convsByInstance.some(({ instance }) => instance?.id === i.id);
                      return (
                        <SelectItem key={i.id} value={i.id}>
                          <div className="flex items-center gap-2">
                            <span>{i.name}</span>
                            <span className="text-xs text-muted-foreground">· {i.provider}</span>
                            {i.is_default && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Padrão</Badge>
                            )}
                            {hasOpen && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">
                                Em conversa
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedInstanceHasOpen && (
              <div className="flex items-start gap-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-2 text-xs text-yellow-800 dark:text-yellow-300">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  Esta instância já tem uma conversa aberta com o cliente. Prosseguir abrirá uma <strong>nova</strong> conversa em paralelo.
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPhone || !selectedInstance || noInstances}
            autoFocus
          >
            Iniciar nova conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StartWhatsAppConversationDialog;
