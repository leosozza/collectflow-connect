import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Wifi, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { LucideIcon } from "lucide-react";

export type LogEntry = {
  time: string;
  status: "success" | "error" | "info";
  message: string;
};

interface IntegrationTestCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  secrets: { label: string; configured: boolean }[];
  onTest: (addLog: (status: LogEntry["status"], message: string) => void) => Promise<void>;
  children?: React.ReactNode;
}

const IntegrationTestCard = ({ icon: Icon, title, description, secrets, onTest, children }: IntegrationTestCardProps) => {
  const [testing, setTesting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (status: LogEntry["status"], message: string) => {
    setLogs((prev) => [
      { time: new Date().toLocaleTimeString("pt-BR"), status, message },
      ...prev,
    ]);
  };

  const handleTest = async () => {
    setTesting(true);
    setLogs([]);
    try {
      await onTest(addLog);
    } catch (err: any) {
      addLog("error", `Erro inesperado: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  const allConfigured = secrets.every((s) => s.configured);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" />
          {title}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Secrets status */}
        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Credenciais do Sistema</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {secrets.map((s) => (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                {s.configured ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                )}
                <span className="text-foreground font-mono">{s.label}</span>
                <Badge variant="outline" className={s.configured ? "bg-green-500/10 text-green-600 border-green-200 text-[10px]" : "bg-destructive/10 text-destructive border-destructive/20 text-[10px]"}>
                  {s.configured ? "Configurado" : "Não configurado"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {children}

        {/* Test button */}
        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing || !allConfigured} className="gap-2">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
            {testing ? "Testando..." : "Testar Conexão"}
          </Button>
          {!allConfigured && (
            <span className="text-xs text-muted-foreground">Configure todas as credenciais antes de testar</span>
          )}
          {logs.length > 0 && !testing && (
            <Badge
              variant="outline"
              className={
                logs[0]?.status === "success"
                  ? "bg-green-500/10 text-green-600 border-green-200"
                  : logs[0]?.status === "error"
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-muted text-muted-foreground"
              }
            >
              {logs[0]?.status === "success" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : logs[0]?.status === "error" ? <XCircle className="w-3 h-3 mr-1" /> : null}
              {logs[0]?.status === "success" ? "Conectado" : "Falha"}
            </Badge>
          )}
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <ScrollArea className="h-[180px] rounded-md border border-border bg-muted/30 p-3">
            <div className="space-y-1.5 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-muted-foreground shrink-0">[{log.time}]</span>
                  {log.status === "success" && <CheckCircle2 className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />}
                  {log.status === "error" && <XCircle className="w-3 h-3 text-destructive mt-0.5 shrink-0" />}
                  {log.status === "info" && <Wifi className="w-3 h-3 text-primary mt-0.5 shrink-0" />}
                  <span className={log.status === "success" ? "text-green-600 dark:text-green-400" : log.status === "error" ? "text-destructive" : "text-foreground"}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default IntegrationTestCard;
