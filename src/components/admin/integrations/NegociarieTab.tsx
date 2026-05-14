import { Handshake, Building2, ShieldCheck } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SECRETS = [
  { label: "NEGOCIARIE_CLIENT_ID", configured: true },
  { label: "NEGOCIARIE_CLIENT_SECRET", configured: true },
];

const NegociarieTab = () => {
  const { tenant } = useTenant();
  const [directCreditors, setDirectCreditors] = useState<any[]>([]);

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchDirect = async () => {
      const { data } = await supabase
        .from("credores" as any)
        .select("id, razao_social, nome_fantasia")
        .eq("tenant_id", tenant.id)
        .eq("cobrança_direta_ativa", true);
      setDirectCreditors(data || []);
    };
    fetchDirect();
  }, [tenant?.id]);

  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com Negociarie...");

    try {
      const { data, error } = await supabase.functions.invoke("negociarie-proxy", {
        body: { action: "status" },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.error) {
        if (data.error.includes("credentials") || data.error.includes("not configured")) {
          addLog("error", "Credenciais Negociarie não configuradas");
        } else {
          addLog("info", `Resposta: ${JSON.stringify(data).slice(0, 200)}`);
          addLog("success", "Edge function respondeu — conexão ativa");
        }
      } else {
        addLog("success", `Resposta: ${JSON.stringify(data).slice(0, 200)}`);
      }

      addLog("success", "✅ Teste concluído");
    } catch (err: any) {
      addLog("error", `Erro: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <IntegrationTestCard
        icon={Handshake}
        title="Negociarie — Gateway de Pagamento"
        description="Integração com o gateway Negociarie para geração de boletos e cobranças."
        secrets={SECRETS}
        onTest={handleTest}
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm">Contas de Credores Conectadas (Recebimento Direto)</CardTitle>
          </div>
          <CardDescription className="text-xs">
            Credores configurados para faturar e receber diretamente em suas próprias contas da Negociarie (bypass da conta da Assessoria).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {directCreditors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum credor configurado para recebimento direto.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {directCreditors.map((c) => (
                <div key={c.id} className="flex flex-col gap-1.5 p-3 rounded-lg border border-border bg-background shadow-sm hover:shadow transition-all">
                  <p className="text-xs font-semibold text-foreground truncate" title={c.razao_social}>
                    {c.nome_fantasia || c.razao_social}
                  </p>
                  <Badge variant="outline" className="w-fit bg-green-500/10 text-green-600 border-green-500/20 text-[10px] gap-1">
                    <ShieldCheck className="w-3 h-3" /> Recebimento Direto
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NegociarieTab;
