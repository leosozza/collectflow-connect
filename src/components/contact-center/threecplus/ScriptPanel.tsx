import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { fetchScriptForClient, resolveScriptVariables } from "@/services/scriptAbordagemService";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface ScriptPanelProps {
  clientPhone?: string;
}

const ScriptPanel = ({ clientPhone }: ScriptPanelProps) => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  // Find client by phone number to get context
  const { data: client } = useQuery({
    queryKey: ["script-client-by-phone", clientPhone],
    queryFn: async () => {
      if (!clientPhone) return null;
      const clean = clientPhone.replace(/\D/g, "");
      const { data } = await supabase
        .from("clients")
        .select("nome_completo, credor, data_vencimento, total_parcelas, valor_parcela, tipo_devedor_id")
        .ilike("phone", `%${clean.slice(-8)}%`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!clientPhone,
  });

  const { data: script, isLoading } = useQuery({
    queryKey: ["active-script", client?.credor, client?.tipo_devedor_id, tenant?.id],
    queryFn: () =>
      fetchScriptForClient({
        credorNome: client?.credor || "",
        tipoDevedorId: client?.tipo_devedor_id,
        canal: "telefone",
        tenantId: tenant!.id,
      }),
    enabled: !!tenant?.id,
  });

  const resolvedContent = script
    ? resolveScriptVariables(script.conteudo, {
        nome: client?.nome_completo,
        valor: client ? client.valor_parcela * client.total_parcelas : undefined,
        credor: client?.credor,
        vencimento: client?.data_vencimento,
        parcelas: client?.total_parcelas,
        operador: (profile as any)?.full_name,
      })
    : null;

  const handleCopy = () => {
    if (!resolvedContent) return;
    navigator.clipboard.writeText(resolvedContent);
    setCopied(true);
    toast.success("Script copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-border overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Script de Abordagem</span>
          {script && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {script.titulo || "Script ativo"}
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="p-4 space-y-3">
          {isLoading ? (
            <p className="text-xs text-muted-foreground animate-pulse">Buscando script...</p>
          ) : !script ? (
            <div className="text-center py-4">
              <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                Nenhum script configurado para este credor/perfil.
              </p>
            </div>
          ) : (
            <>
              {/* Context info */}
              {client && (
                <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                  <div className="bg-muted/40 rounded px-2 py-1">
                    <span className="text-muted-foreground">Cliente: </span>
                    <span className="font-medium text-foreground">{client.nome_completo}</span>
                  </div>
                  <div className="bg-muted/40 rounded px-2 py-1">
                    <span className="text-muted-foreground">Credor: </span>
                    <span className="font-medium text-foreground">{client.credor}</span>
                  </div>
                </div>
              )}

              {/* Script content */}
              <ScrollArea className="h-48 rounded-md border border-border bg-muted/20 p-3">
                <pre className="text-xs text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {resolvedContent}
                </pre>
              </ScrollArea>

              <Button
                size="sm"
                variant="outline"
                onClick={handleCopy}
                className="w-full gap-2 h-8 text-xs"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-primary" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                {copied ? "Copiado!" : "Copiar Script"}
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
};

export default ScriptPanel;
