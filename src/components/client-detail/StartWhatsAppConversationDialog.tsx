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

interface PhoneOption {
  value: string; // E.164 (digits-only, with 55 prefix)
  raw: string;
  isPrimary?: boolean;
  source?: string;
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

  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ["whatsapp-instances-allowed", tenantId, profile?.id, isAdmin],
    queryFn: async (): Promise<WhatsAppInstance[]> => {
      if (!tenantId) return [];
      const all = await fetchWhatsAppInstances(tenantId);
      const active = all.filter((i) => i.status !== "disconnected" || true); // mostrar todas; status ainda exibido
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

  const [selectedPhone, setSelectedPhone] = useState<string>("");
  const [selectedInstance, setSelectedInstance] = useState<string>("");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-left">Abrir conversa no WhatsApp</DialogTitle>
          <DialogDescription className="text-left">
            Escolha o telefone do devedor e a instância pela qual deseja iniciar a conversa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                  {instances.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      <div className="flex items-center gap-2">
                        <span>{i.name}</span>
                        <span className="text-xs text-muted-foreground">· {i.provider}</span>
                        {i.is_default && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Padrão</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedPhone || !selectedInstance || noInstances}
            autoFocus
          >
            Abrir conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StartWhatsAppConversationDialog;
