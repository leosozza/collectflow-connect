import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wifi, WifiOff, Loader2, CheckCircle2, XCircle, Link2, Send } from "lucide-react";

const NegociarieTab = () => {
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
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection status */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {connected === null ? (
                <WifiOff className="w-5 h-5 text-muted-foreground" />
              ) : connected ? (
                <Wifi className="w-5 h-5 text-emerald-500" />
              ) : (
                <WifiOff className="w-5 h-5 text-destructive" />
              )}
              Teste de Conexão
            </CardTitle>
            <CardDescription>
              {connected === null
                ? "Clique para testar a conexão com a API Negociarie"
                : connected
                  ? "API Negociarie conectada e pronta para uso"
                  : "Sem conexão com a API. Verifique suas credenciais."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleTestConnection} disabled={testing} className="w-full">
              {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
              {testing ? "Testando..." : "Testar Conexão"}
            </Button>
          </CardContent>
        </Card>

        {/* Callback configuration */}
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="w-5 h-5 text-muted-foreground" />
              URL de Callback
            </CardTitle>
            <CardDescription>
              URL que receberá notificações de pagamento da Negociarie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="callback-url" className="text-xs text-muted-foreground">URL do Webhook</Label>
              <Input
                id="callback-url"
                value={callbackUrl}
                onChange={(e) => setCallbackUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background/50"
              />
            </div>
            <Button onClick={handleSetCallback} disabled={settingCallback} variant="secondary" className="w-full">
              {settingCallback ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {settingCallback ? "Configurando..." : "Configurar Callback"}
            </Button>
            {callbackOk !== null && (
              <div className="flex items-center gap-2 text-sm justify-center pt-2">
                {callbackOk ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span className="text-emerald-600 dark:text-emerald-400">Callback configurado</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-destructive" />
                    <span className="text-destructive">Falha ao configurar callback</span>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NegociarieTab;

