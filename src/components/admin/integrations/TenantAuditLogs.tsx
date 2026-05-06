import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertCircle, Clock, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface TenantAuditLogsProps {
  tenantId: string;
}

export const TenantAuditLogs = ({ tenantId }: TenantAuditLogsProps) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("entity_type", "integration_error")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      setLogs(data || []);
    } catch (err) {
      console.error("[AuditLogs] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) loadLogs();
  }, [tenantId]);

  if (loading) return <p className="text-xs text-muted-foreground animate-pulse">Carregando logs...</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logs de Erros de Integração</h4>
        <button onClick={loadLogs} className="text-[10px] text-primary hover:underline flex items-center gap-1">
          <Clock className="w-3 h-3" /> Atualizar
        </button>
      </div>

      <ScrollArea className="h-[200px] rounded-md border border-border bg-muted/30 p-2">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">Nenhum erro registrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="p-2 rounded border border-destructive/10 bg-destructive/5 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-destructive font-medium text-[11px]">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {log.action.replace("negociarie_error_", "").toUpperCase()}
                  </div>
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {new Date(log.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>
                <p className="text-[10px] text-foreground leading-relaxed">
                  {log.details?.message}
                </p>
                {log.details?.params && (
                  <details className="mt-1">
                    <summary className="text-[9px] text-muted-foreground cursor-pointer hover:text-foreground">Ver Payload</summary>
                    <pre className="mt-1 p-1 bg-background rounded text-[9px] overflow-x-auto border border-border">
                      {log.details.params}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
