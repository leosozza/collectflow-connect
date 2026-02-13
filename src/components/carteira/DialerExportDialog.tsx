import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Phone, Users } from "lucide-react";
import { toast } from "sonner";

interface DialerExportDialogProps {
  open: boolean;
  onClose: () => void;
  selectedClients: Client[];
}

const DialerExportDialog = ({ open, onClose, selectedClients }: DialerExportDialogProps) => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  const loadCampaigns = async () => {
    if (!domain || !apiToken) {
      toast.error("Configure as credenciais 3CPlus na página de Integrações");
      return;
    }
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_campaigns", domain, api_token: apiToken },
      });
      if (error) throw error;
      setCampaigns(data?.data || []);
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const handleOpen = () => {
    if (campaigns.length === 0) loadCampaigns();
  };

  const handleSend = async () => {
    if (!selectedCampaign) {
      toast.error("Selecione uma campanha");
      return;
    }
    setSending(true);
    try {
      // 1. Create a new list
      const { data: listData, error: listError } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "create_list", domain, api_token: apiToken, campaign_id: selectedCampaign },
      });
      if (listError) throw listError;

      const listId = listData?.data?.id;
      if (!listId) throw new Error("Não foi possível criar a lista");

      // 2. Format mailings - group unique CPFs with phone numbers
      const uniqueClients = new Map<string, Client>();
      selectedClients.forEach((c) => {
        const cpf = c.cpf.replace(/\D/g, "");
        if (!uniqueClients.has(cpf)) {
          uniqueClients.set(cpf, c);
        }
      });

      const mailings = Array.from(uniqueClients.values()).map((c) => ({
        identifier: c.cpf.replace(/\D/g, ""),
        areacodephone: c.phone?.replace(/\D/g, "") || "",
        Nome: c.nome_completo,
        Extra1: c.credor,
        Extra2: String(c.valor_parcela),
        Extra3: c.id,
      }));

      // 3. Send mailing to 3CPlus
      const { data: sendData, error: sendError } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "send_mailing",
          domain,
          api_token: apiToken,
          campaign_id: selectedCampaign,
          list_id: listId,
          mailings,
        },
      });
      if (sendError) throw sendError;

      toast.success(`${mailings.length} contatos enviados para o discador!`);
      onClose();
    } catch (err: any) {
      toast.error("Erro ao enviar para discador: " + (err.message || ""));
    } finally {
      setSending(false);
    }
  };

  // Load campaigns when dialog opens
  if (open && campaigns.length === 0 && !loadingCampaigns) {
    handleOpen();
  }

  const hasCredentials = !!domain && !!apiToken;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Enviar para Discador 3CPlus
          </DialogTitle>
          <DialogDescription>
            Envie os clientes selecionados como mailing para uma campanha no discador
          </DialogDescription>
        </DialogHeader>

        {!hasCredentials ? (
          <div className="py-4 text-center text-muted-foreground text-sm">
            Configure as credenciais 3CPlus na página de <strong>Integrações</strong> primeiro.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Users className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium">{selectedClients.length} clientes selecionados</span>
            </div>

            <div className="space-y-2">
              <Label>Campanha</Label>
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando campanhas...
                </div>
              ) : (
                <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma campanha" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !selectedCampaign || !hasCredentials}
            className="gap-2"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DialerExportDialog;
