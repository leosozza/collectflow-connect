import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Loader2, Copy, Check, Rocket } from "lucide-react";
import { getSystemSetting } from "@/services/systemSettingsService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CheckItem {
  label: string;
  status: "loading" | "pass" | "fail";
  detail?: string;
}

const GoLiveChecklist = () => {
  const [checks, setChecks] = useState<CheckItem[]>([]);
  const [running, setRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const runChecks = async () => {
    setRunning(true);
    const results: CheckItem[] = [
      { label: "Ambiente Asaas", status: "loading" },
      { label: "Planos ativos", status: "loading" },
      { label: "Tenants cadastrados", status: "loading" },
      { label: "Webhook configurável", status: "loading" },
    ];
    setChecks([...results]);

    // Check 1: Asaas environment
    try {
      const env = await getSystemSetting("asaas_environment");
      results[0] = {
        label: "Ambiente Asaas",
        status: env === "production" ? "pass" : "fail",
        detail: env === "production" ? "Produção ativo" : `Ambiente: ${env || "não configurado"}`,
      };
    } catch {
      results[0] = { label: "Ambiente Asaas", status: "fail", detail: "Erro ao verificar" };
    }
    setChecks([...results]);

    // Check 2: Active plans
    try {
      const { count } = await supabase.from("plans").select("*", { count: "exact", head: true }).eq("is_active", true);
      results[1] = {
        label: "Planos ativos",
        status: (count || 0) > 0 ? "pass" : "fail",
        detail: `${count || 0} plano(s) ativo(s)`,
      };
    } catch {
      results[1] = { label: "Planos ativos", status: "fail", detail: "Erro ao verificar" };
    }
    setChecks([...results]);

    // Check 3: Tenants
    try {
      const { count } = await supabase.from("tenants").select("*", { count: "exact", head: true });
      results[2] = {
        label: "Tenants cadastrados",
        status: (count || 0) > 0 ? "pass" : "fail",
        detail: `${count || 0} tenant(s)`,
      };
    } catch {
      results[2] = { label: "Tenants cadastrados", status: "fail", detail: "Erro ao verificar" };
    }
    setChecks([...results]);

    // Check 4: Webhook URL
    results[3] = {
      label: "Webhook configurável",
      status: "pass",
      detail: "URL pronta para cadastro no Asaas",
    };
    setChecks([...results]);

    setRunning(false);
  };

  useEffect(() => {
    runChecks();
  }, []);

  const allPass = checks.length > 0 && checks.every((c) => c.status === "pass");

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Rocket className="w-4 h-4 text-primary" />
          Checklist Go-Live
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Verificações necessárias antes de aceitar tenants reais
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {checks.map((check, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30">
              <div className="flex items-center gap-2">
                {check.status === "loading" && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {check.status === "pass" && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                {check.status === "fail" && <XCircle className="w-4 h-4 text-destructive" />}
                <span className="text-sm text-foreground">{check.label}</span>
              </div>
              {check.detail && (
                <span className="text-xs text-muted-foreground">{check.detail}</span>
              )}
            </div>
          ))}
        </div>

        {/* Webhook URL */}
        <div className="space-y-1.5 pt-2 border-t border-border">
          <Label className="text-xs font-medium">URL do Webhook Asaas</Label>
          <div className="flex gap-2">
            <Input value={webhookUrl} readOnly className="text-xs font-mono" />
            <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Cadastre esta URL no painel do Asaas em Configurações → Webhooks</p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <Badge
            variant="outline"
            className={allPass
              ? "bg-green-500/10 text-green-600 border-green-200"
              : "bg-amber-500/10 text-amber-600 border-amber-200"
            }
          >
            {allPass ? "✅ Pronto para Go-Live" : "⚠️ Pendências encontradas"}
          </Badge>
          <Button variant="outline" size="sm" onClick={runChecks} disabled={running}>
            {running ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Reverificar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoLiveChecklist;
