import { useEffect, useState, useCallback } from "react";
import { negociarieService } from "@/services/negociarieService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Wifi,
  Loader2,
  CheckCircle2,
  XCircle,
  Link2,
  Send,
  KeyRound,
  Copy,
  Trash2,
  ShieldCheck,
} from "lucide-react";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

interface StatusRow {
  provider: string;
  creditor_id: string | null;
  is_active: boolean;
  has_credentials: boolean;
  uses_global_fallback: boolean;
  client_id_masked: string | null;
  callback_url: string | null;
  callback_registered_at: string | null;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
}

const NegociarieTab = () => {
  const meta = INTEGRATIONS.negociarie;
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<StatusRow | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [settingCallback, setSettingCallback] = useState(false);

  const callbackUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback`;

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_my_integrations_status");
    if (!error && data) {
      const row = (data as StatusRow[]).find(
        (r) => r.provider === "negociarie" && !r.creditor_id,
      );
      setStatus(row || null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const callCredentials = async (action: "save" | "test" | "delete", payload: any = {}) => {
    const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
      body: { action, ...payload },
    });
    if (error) throw new Error(error.message);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const handleSave = async () => {
    if (!clientId.trim()) {
      toast({ title: "Client ID obrigatório", variant: "destructive" });
      return;
    }
    if (!status?.has_credentials && !clientSecret.trim()) {
      toast({ title: "Client Secret obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await callCredentials("save", {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      });
      toast({ title: "Conectado!", description: res.message || "Credenciais validadas e salvas" });
      setClientSecret("");
      setClientId("");
      await reload();
    } catch (e: any) {
      toast({ title: "Falha ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await callCredentials("test");
      toast({ title: "Conexão OK", description: res.message });
      await reload();
    } catch (e: any) {
      toast({ title: "Falha na conexão", description: e.message, variant: "destructive" });
      await reload();
    } finally {
      setTesting(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    try {
      await callCredentials("delete");
      toast({ title: "Credenciais removidas" });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setRemoving(false);
    }
  };

  const handleSetCallback = async () => {
    setSettingCallback(true);
    try {
      await negociarieService.atualizarCallback({ url: callbackUrl });
      toast({ title: "Callback registrado!", description: "URL configurada na Negociarie" });
      await reload();
    } catch (e: any) {
      toast({ title: "Erro no callback", description: e.message, variant: "destructive" });
    } finally {
      setSettingCallback(false);
    }
  };

  const copyCallback = async () => {
    await navigator.clipboard.writeText(callbackUrl);
    toast({ title: "URL copiada" });
  };

  const isConnected = !!status?.is_active && (status.has_credentials || status.uses_global_fallback);
  const layoutStatus = isConnected ? "connected" : "not_configured";

  const renderLastTest = () => {
    if (!status?.last_test_at) return null;
    const when = new Date(status.last_test_at).toLocaleString("pt-BR");
    return (
      <div className="flex items-center gap-2 text-xs">
        {status.last_test_ok ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-muted-foreground">Última verificação: {when} — OK</span>
          </>
        ) : (
          <>
            <XCircle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-destructive">
              {when} — {status.last_test_message || "falha"}
            </span>
          </>
        )}
      </div>
    );
  };

  return (
    <IntegrationDetailLayout
      name={meta.name}
      category={meta.category}
      logoUrl={meta.logoUrl}
      fallbackIcon={meta.fallbackIcon}
      brandColor={meta.brandColor}
      description={meta.description}
      status={layoutStatus}
      requirements={meta.requirements}
    >
      {/* Bloco 1 — Status */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm text-foreground">Status da integração</h3>
            </div>
            <div className="flex items-center gap-2">
              {status?.uses_global_fallback && (
                <Badge variant="secondary" className="text-[10px]">
                  Cofre global
                </Badge>
              )}
              {isConnected ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  Conectado
                </Badge>
              ) : (
                <Badge variant="outline">Não configurado</Badge>
              )}
            </div>
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground">Carregando status...</p>
          ) : (
            <>
              {status?.client_id_masked && !status.uses_global_fallback && (
                <p className="text-xs text-muted-foreground">
                  Client ID:{" "}
                  <span className="font-mono text-foreground">{status.client_id_masked}</span>
                </p>
              )}
              {status?.uses_global_fallback && (
                <p className="text-xs text-muted-foreground">
                  Esta tenant usa as credenciais globais da plataforma. Para usar credenciais
                  próprias, preencha o formulário abaixo.
                </p>
              )}
              {renderLastTest()}
            </>
          )}
        </CardContent>
      </Card>

      {/* Bloco 2 — Credenciais */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Credenciais Negociarie</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Encontre o <strong>Client ID</strong> e o <strong>Client Secret</strong> no painel
            Negociarie em <em>Configurações → API</em>. As credenciais são validadas com a
            Negociarie antes de serem salvas — se o teste falhar, nada é gravado.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="negociarie-client-id" className="text-xs text-muted-foreground">
                Client ID
              </Label>
              <Input
                id="negociarie-client-id"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder={status?.client_id_masked || "Cole o Client ID"}
                className="bg-background/50 font-mono text-xs"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="negociarie-client-secret" className="text-xs text-muted-foreground">
                Client Secret
              </Label>
              <Input
                id="negociarie-client-secret"
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={
                  status?.has_credentials ? "Deixe em branco para manter o atual" : "Cole o Client Secret"
                }
                className="bg-background/50 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              {saving ? "Validando..." : "Salvar e testar"}
            </Button>
            <Button
              variant="secondary"
              onClick={handleTest}
              disabled={testing || (!status?.has_credentials && !status?.uses_global_fallback)}
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Wifi className="w-4 h-4 mr-2" />
              )}
              Testar conexão
            </Button>
            {status?.has_credentials && !status.uses_global_fallback && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remover credenciais
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover credenciais Negociarie?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A integração será desativada e novas cobranças não poderão ser geradas até que
                      novas credenciais sejam cadastradas. Cobranças existentes não são afetadas.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleRemove}
                      disabled={removing}
                      className="bg-destructive hover:bg-destructive/90"
                    >
                      {removing ? "Removendo..." : "Sim, remover"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3 — Callback */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Webhook de baixa</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Esta URL recebe notificações de pagamento da Negociarie e gera baixa automática nos
            acordos. Registre uma única vez — não precisa repetir a cada cobrança.
          </p>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">URL do callback</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={callbackUrl}
                className="bg-background/50 font-mono text-xs"
              />
              <Button variant="outline" size="icon" onClick={copyCallback} title="Copiar URL">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Button
              onClick={handleSetCallback}
              disabled={settingCallback || !isConnected}
              variant="secondary"
            >
              {settingCallback ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Registrar callback na Negociarie
            </Button>
            {status?.callback_registered_at && (
              <span className="text-xs text-muted-foreground">
                Último registro: {new Date(status.callback_registered_at).toLocaleString("pt-BR")}
              </span>
            )}
          </div>
          {!isConnected && (
            <p className="text-xs text-muted-foreground italic">
              Configure as credenciais antes de registrar o callback.
            </p>
          )}
        </CardContent>
      </Card>
    </IntegrationDetailLayout>
  );
};

export default NegociarieTab;
