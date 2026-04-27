import { useState } from "react";
import { Activity, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { SocketStatus } from "@/hooks/useThreeCPlusSocket";

interface Props {
  socketStatus: SocketStatus;
  socketLastEventAt: Date | null;
  socketReconnect: () => void;
}

type ResultState = "ok" | "warn" | "error";

interface TestResult {
  rest: { state: ResultState; message: string };
  socket: { state: ResultState; message: string };
}

export const TestConnectionButton = ({
  socketStatus,
  socketLastEventAt,
  socketReconnect,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runTest = async () => {
    setLoading(true);
    setResult(null);

    // REST test
    const restPromise = (async (): Promise<TestResult["rest"]> => {
      try {
        const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
          body: { action: "list_agents" },
        });

        const combinedMsg = [error?.message, data?.error, data?.detail]
          .filter(Boolean)
          .join(" — ");

        // Missing credentials → tratar como aviso de configuração, não como erro
        if (combinedMsg && /domain and api_token are required/i.test(combinedMsg)) {
          return {
            state: "warn",
            message:
              "Credenciais 3CPLUS não configuradas para este tenant. Configure domínio e API token em Configurações › Integrações › 3CPlus.",
          };
        }

        if (error) {
          return { state: "error", message: `Falha REST: ${error.message}` };
        }
        if (data?.error) {
          return {
            state: "warn",
            message: `Edge function acessível, mas API retornou: ${String(data.error).slice(0, 200)}`,
          };
        }
        return { state: "ok", message: "Edge function threecplus-proxy respondeu com sucesso." };
      } catch (err: any) {
        return { state: "error", message: `Erro inesperado: ${err?.message || String(err)}` };
      }
    })();

    // Socket test
    const socketPromise = (async (): Promise<TestResult["socket"]> => {
      if (socketStatus === "idle") {
        return {
          state: "warn",
          message: "Socket inativo — credenciais 3CPLUS ausentes para o tenant.",
        };
      }
      if (socketStatus === "connected") {
        const ts = socketLastEventAt
          ? ` Último evento: ${socketLastEventAt.toLocaleTimeString("pt-BR")}.`
          : " Aguardando primeiro evento.";
        return { state: "ok", message: `Socket.IO conectado.${ts}` };
      }
      // Trigger reconnect and wait briefly
      try {
        socketReconnect();
      } catch { /* noop */ }
      await wait(5000);
      // Caller will re-check via props after dialog opens; we can only reflect last known state here
      return {
        state: "warn",
        message:
          "Tentativa de reconexão disparada. Aguarde alguns segundos e veja o badge de tempo real.",
      };
    })();

    const [rest, socket] = await Promise.all([restPromise, socketPromise]);
    const final: TestResult = { rest, socket };
    setResult(final);
    setOpen(true);
    setLoading(false);

    const states = [rest.state, socket.state];
    if (states.every((s) => s === "ok")) {
      toast.success("Conexão 3CPLUS validada");
    } else if (states.includes("error")) {
      toast.error("Falha ao validar conexão 3CPLUS");
    } else {
      toast.warning("Conexão 3CPLUS com avisos");
    }
  };

  const renderIcon = (s: ResultState) => {
    if (s === "ok") return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />;
    if (s === "warn") return <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />;
    return <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />;
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={runTest}
        disabled={loading}
        className="gap-1.5 h-8 text-xs"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Activity className="w-3.5 h-3.5" />
        )}
        {loading ? "Testando..." : "Testar conexão"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Resultado do teste de conexão</DialogTitle>
            <DialogDescription>
              Validação dos canais REST e tempo real da integração 3CPLUS.
            </DialogDescription>
          </DialogHeader>

          {result && (
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2 p-3 rounded-md border bg-card">
                {renderIcon(result.rest.state)}
                <div className="min-w-0">
                  <div className="font-medium">REST 3CPLUS (threecplus-proxy)</div>
                  <div className="text-muted-foreground text-xs mt-0.5 break-words">
                    {result.rest.message}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-md border bg-card">
                {renderIcon(result.socket.state)}
                <div className="min-w-0">
                  <div className="font-medium">Tempo real (Socket.IO)</div>
                  <div className="text-muted-foreground text-xs mt-0.5 break-words">
                    {result.socket.message}
                  </div>
                  <div className="text-xs mt-1">
                    Status atual:{" "}
                    <span className="font-mono">{socketStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button size="sm" onClick={runTest} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Activity className="w-3.5 h-3.5" />}
              Testar novamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TestConnectionButton;
