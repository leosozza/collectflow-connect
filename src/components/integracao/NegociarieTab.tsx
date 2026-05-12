import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, Loader2, CheckCircle2, XCircle, Link2, Send, KeyRound } from "lucide-react";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const NegociarieTab = () => {
  const meta = INTEGRATIONS.negociarie;
  const { toast } = useToast();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);
  const [callbackOk, setCallbackOk] = useState<boolean | null>(null);
  const [callbackUrl, setCallbackUrl] = useState(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/negociarie-callback`
  );
  const [settingCallback, setSettingCallback] = useState(false);

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      await negociarieService.testConnection();
      setConnected(true);
      toast({ title: "Conectado!", description: "API Negociarie acessível" });
    } catch (e: any) {
      setConnected(false);
      toast({ title: "Falha na conexão", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleSetCallback = async () => {
    if (!callbackUrl.trim()) {
      toast({ title: "URL vazia", description: "Preencha a URL do callback", variant: "destructive" });
      return;
    }
    setSettingCallback(true);
    try {
      await negociarieService.atualizarCallback({ url: callbackUrl.trim() });
      setCallbackOk(true);
      toast({ title: "Callback configurado!", description: "URL de callback registrada com sucesso" });
    } catch (e: any) {
      setCallbackOk(false);
      toast({ title: "Erro no callback", description: e.message, variant: "destructive" });
    } finally {
      setSettingCallback(false);
    }
  };

  return (
    <IntegrationDetailLayout
      name={meta.name}
      category={meta.category}
      logoUrl={meta.logoUrl}
      fallbackIcon={meta.fallbackIcon}
      brandColor={meta.brandColor}
      description={meta.description}
      status={connected ? "connected" : "not_configured"}
      requirements={meta.requirements}
    >
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Conexão e callback</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" /> Teste de Conexão
              </Label>
              <p className="text-xs text-muted-foreground">
                Valida que o token configurado no cofre tem acesso à API.
              </p>
              <Button onClick={handleTestConnection} disabled={testing} className="w-full">
                {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                {testing ? "Testando..." : "Testar Conexão"}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="callback-url" className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> URL de Callback
              </Label>
              <Input
                id="callback-url"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background/50 font-mono text-xs"
              />
              <Button onClick={handleSetCallback} disabled={settingCallback} variant="secondary" className="w-full">
                {settingCallback ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {settingCallback ? "Configurando..." : "Configurar Callback"}
              </Button>
              {callbackOk !== null && (
                <div className="flex items-center gap-2 text-xs justify-center pt-1">
                  {callbackOk ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-emerald-600 dark:text-emerald-400">Callback configurado</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                      <span className="text-destructive">Falha ao configurar callback</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </IntegrationDetailLayout>
  );
};

export default NegociarieTab;
