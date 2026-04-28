import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  CreditCard,
  AlertTriangle,
  Wifi,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ShieldAlert,
  Info,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import {
  getActivePlatformAccount,
  updatePlatformAccount,
  upsertPlatformAccount,
  testPlatformConnection,
  type PlatformBillingAccount,
} from "@/services/platformBillingService";

const AsaasPlatformTab = () => {
  const [account, setAccount] = useState<PlatformBillingAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showProdConfirm, setShowProdConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<"url" | "token" | null>(null);

  // form state
  const [label, setLabel] = useState("");
  const [walletId, setWalletId] = useState("");
  const [notes, setNotes] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const acc = await getActivePlatformAccount("asaas");
      setAccount(acc);
      if (acc) {
        setLabel(acc.account_label || "");
        setWalletId(acc.wallet_id || "");
        setNotes(acc.notes || "");
      }
    } catch (e: any) {
      toast.error("Erro ao carregar conta da plataforma: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const isProduction = account?.environment === "production";
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const webhookUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/asaas-webhook` : "";

  const copyField = (field: "url" | "token", value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success("Copiado");
    setTimeout(() => setCopiedField(null), 1800);
  };

  const switchEnv = async (toProd: boolean) => {
    if (!account) return;
    setSaving(true);
    try {
      // Cria/ativa a conta do novo ambiente; desativa a outra
      const target = toProd ? "production" : "sandbox";
      await upsertPlatformAccount({
        provider: "asaas",
        environment: target,
        account_label: label || `Asaas Plataforma (${target})`,
        wallet_id: walletId || null,
        notes: notes || null,
        is_active: true,
      });
      toast.success(`Ambiente alterado para ${toProd ? "Produção" : "Sandbox"}`);
      await load();
    } catch (e: any) {
      toast.error("Erro ao alterar ambiente: " + e.message);
    } finally {
      setSaving(false);
      setShowProdConfirm(false);
    }
  };

  const handleSave = async () => {
    if (!account) return;
    setSaving(true);
    try {
      await updatePlatformAccount(account.id, {
        account_label: label,
        wallet_id: walletId || null,
        notes: notes || null,
      });
      toast.success("Configurações salvas");
      await load();
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await testPlatformConnection();
      if (result.ok) {
        toast.success(`Conexão OK (${result.environment})`);
      } else {
        toast.error(`Falha: ${result.message}`);
      }
      await load();
    } catch (e: any) {
      toast.error("Erro no teste: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Aviso de isolamento */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-foreground">Conta Asaas da Plataforma</p>
            <p className="text-muted-foreground mt-1">
              Esta é a conta usada pelo Super Admin para <strong>cobrar mensalidades dos tenants</strong>.
              Está totalmente isolada das integrações Asaas / boletos que cada tenant configura no seu próprio painel.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Card principal */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" />
            Gateway Asaas — Cobrança da Plataforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Ambiente */}
          <div className="flex items-center justify-between p-3 rounded-md border border-border">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Ambiente:</span>
              <Badge
                className={
                  isProduction
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-amber-500 hover:bg-amber-600 text-white"
                }
              >
                {isProduction ? "🟢 Produção" : "🟡 Sandbox"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Sandbox</span>
              <Switch
                checked={isProduction}
                onCheckedChange={(v) => (v ? setShowProdConfirm(true) : switchEnv(false))}
                disabled={saving}
              />
              <span className="text-xs text-muted-foreground">Produção</span>
            </div>
          </div>

          {isProduction && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                Ambiente de produção ativo. Todas as cobranças aos tenants serão reais.
              </p>
            </div>
          )}

          {/* Campos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="label">Rótulo da conta</Label>
              <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Asaas Plataforma" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet" className="flex items-center gap-1">
                Wallet ID <span className="text-xs text-muted-foreground">(opcional, para split)</span>
              </Label>
              <Input id="wallet" value={walletId} onChange={(e) => setWalletId(e.target.value)} placeholder="UUID da carteira Asaas" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Observações sobre essa conta..." />
          </div>

          {/* Secrets info */}
          <div className="p-3 rounded-md border border-border bg-muted/30 text-xs space-y-1.5">
            <p className="font-medium flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Configuração das chaves
            </p>
            <p className="text-muted-foreground">
              As chaves de API ficam armazenadas como secrets no backend (separadas das chaves dos tenants):
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-0.5 ml-1">
              <li><code className="text-foreground">ASAAS_PLATFORM_API_KEY_SANDBOX</code></li>
              <li><code className="text-foreground">ASAAS_PLATFORM_API_KEY_PRODUCTION</code></li>
            </ul>
            <a
              href="https://docs.asaas.com/reference/comece-por-aqui"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1 mt-1"
            >
              Documentação Asaas <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-3 rounded-md border border-border bg-muted/30 text-xs space-y-2">
            <p className="font-medium">Webhook de cobranças</p>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="h-8 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={!webhookUrl}
                onClick={() => copyField("url", webhookUrl)}
              >
                {copiedField === "url" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input value={account?.webhook_token || ""} readOnly className="h-8 font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={!account?.webhook_token}
                onClick={() => account?.webhook_token && copyField("token", account.webhook_token)}
              >
                {copiedField === "token" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
            </div>
          </div>

          {/* Status do último teste */}
          {account?.last_test_at && (
            <div className="flex items-center gap-2 text-xs">
              {account.last_test_status === "success" ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-destructive" />
              )}
              <span className="text-muted-foreground">
                Último teste: {new Date(account.last_test_at).toLocaleString("pt-BR")} —{" "}
                <span className={account.last_test_status === "success" ? "text-green-600" : "text-destructive"}>
                  {account.last_test_message || account.last_test_status}
                </span>
              </span>
            </div>
          )}

          {/* Ações */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button onClick={handleSave} disabled={saving} size="sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showProdConfirm} onOpenChange={setShowProdConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Ativar Produção?
            </AlertDialogTitle>
            <AlertDialogDescription>
              A partir de agora todas as cobranças geradas para os tenants serão processadas como reais pelo Asaas.
              Confirme que a chave <code>ASAAS_PLATFORM_API_KEY_PRODUCTION</code> está cadastrada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => switchEnv(true)}
              disabled={saving}
              className="bg-destructive hover:bg-destructive/90"
            >
              {saving ? "Salvando..." : "Sim, ativar Produção"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AsaasPlatformTab;
