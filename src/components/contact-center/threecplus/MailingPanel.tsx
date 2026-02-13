import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Upload, Users } from "lucide-react";
import { toast } from "sonner";

const MailingPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";
  const hasCredentials = !!domain && !!apiToken;

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [lists, setLists] = useState<any[]>([]);
  const [selectedList, setSelectedList] = useState("");
  const [createNewList, setCreateNewList] = useState(true);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [sending, setSending] = useState(false);

  // Manual entry
  const [manualData, setManualData] = useState("");

  const loadCampaigns = async () => {
    if (!hasCredentials) return;
    setLoadingCampaigns(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_campaigns", domain, api_token: apiToken },
      });
      if (error) throw error;
      setCampaigns(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoadingCampaigns(false);
    }
  };

  const loadLists = async (campaignId: string) => {
    setLoadingLists(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "get_campaign_lists", domain, api_token: apiToken, campaign_id: campaignId },
      });
      if (error) throw error;
      setLists(Array.isArray(data) ? data : data?.data || []);
    } catch {
      toast.error("Erro ao carregar listas");
    } finally {
      setLoadingLists(false);
    }
  };

  useEffect(() => {
    if (hasCredentials) loadCampaigns();
  }, [domain, apiToken]);

  useEffect(() => {
    if (selectedCampaign) {
      loadLists(selectedCampaign);
      setSelectedList("");
    }
  }, [selectedCampaign]);

  const parseManualData = (): any[] => {
    // Expected format: one line per contact: CPF;PHONE;NAME
    const lines = manualData.trim().split("\n").filter(Boolean);
    return lines.map((line) => {
      const parts = line.split(";").map((p) => p.trim());
      return {
        identifier: (parts[0] || "").replace(/\D/g, ""),
        areacodephone: (parts[1] || "").replace(/\D/g, ""),
        Nome: parts[2] || "",
        Extra1: parts[3] || "",
        Extra2: parts[4] || "",
        Extra3: parts[5] || "",
      };
    });
  };

  const handleSend = async () => {
    if (!selectedCampaign) {
      toast.error("Selecione uma campanha");
      return;
    }

    const mailings = parseManualData();
    if (mailings.length === 0) {
      toast.error("Adicione contatos para enviar");
      return;
    }

    setSending(true);
    try {
      let listId = selectedList;

      if (createNewList || !listId) {
        const { data: listData, error: listError } = await supabase.functions.invoke("threecplus-proxy", {
          body: { action: "create_list", domain, api_token: apiToken, campaign_id: selectedCampaign },
        });
        if (listError) throw listError;
        listId = listData?.data?.id || listData?.id;
        if (!listId) throw new Error("Não foi possível criar a lista");
      }

      const { error: sendError } = await supabase.functions.invoke("threecplus-proxy", {
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

      toast.success(`${mailings.length} contatos enviados com sucesso!`);
      setManualData("");
    } catch (err: any) {
      toast.error("Erro ao enviar mailing: " + (err.message || ""));
    } finally {
      setSending(false);
    }
  };

  if (!hasCredentials) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Configure as credenciais na aba <strong>Configuração</strong> primeiro.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Send className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Enviar Mailing</CardTitle>
              <CardDescription>
                Envie contatos manualmente para uma campanha 3CPlus. Para enviar da carteira, use o botão "Discador" na página de Carteira.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Campanha</Label>
              {loadingCampaigns ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Carregando...
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

            <div className="space-y-2">
              <Label>Lista</Label>
              <Select
                value={createNewList ? "__new__" : selectedList}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setCreateNewList(true);
                    setSelectedList("");
                  } else {
                    setCreateNewList(false);
                    setSelectedList(v);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Criar nova lista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__new__">➕ Criar nova lista</SelectItem>
                  {lists.map((l: any) => (
                    <SelectItem key={l.id} value={String(l.id)}>
                      {l.name || `Lista ${l.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contatos (um por linha: CPF;TELEFONE;NOME;CREDOR;VALOR;ID)</Label>
            <textarea
              className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"12345678901;11999998888;João Silva;CREDOR;500.00;abc123\n98765432100;21888887777;Maria Santos;CREDOR;300.00;def456"}
              value={manualData}
              onChange={(e) => setManualData(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Formato: CPF;TELEFONE;NOME;EXTRA1;EXTRA2;EXTRA3 — separados por ponto e vírgula
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSend} disabled={sending || !selectedCampaign} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {sending ? "Enviando..." : `Enviar Mailing`}
            </Button>
            {manualData.trim() && (
              <span className="text-sm text-muted-foreground">
                <Users className="w-4 h-4 inline mr-1" />
                {manualData.trim().split("\n").filter(Boolean).length} contatos
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MailingPanel;
