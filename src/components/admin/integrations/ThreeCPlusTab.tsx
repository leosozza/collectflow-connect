import { Phone, ArrowLeftRight, ArrowRight, RefreshCw, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import IntegrationTestCard from "./IntegrationTestCard";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { extractList } from "@/lib/threecplusUtils";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";

type SyncMatched = { name: string; email: string; extension: string; previous: string | null };
type SyncResult = {
  matched: SyncMatched[];
  unmatched: { name: string; email: string }[];
  alreadyCorrect: number;
  failed: { email: string; error: string }[];
};

const ThreeCPlusTab = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";
  const [webhookActive, setWebhookActive] = useState<boolean | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    checkBidirectionalStatus();
  }, []);

  const checkBidirectionalStatus = async () => {
    try {
      // Check if we have recent call_logs from webhook source (last 7 days)
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .gte("called_at", since);
      setWebhookActive((count ?? 0) > 0);
    } catch {
      setWebhookActive(false);
    }
  };

  const handleTest = async (addLog: (status: "success" | "error" | "info", msg: string) => void) => {
    addLog("info", "Iniciando teste de conexão com 3CPlus...");
    addLog("info", "3CPlus usa credenciais por tenant (domínio + token)");

    try {
      if (!domain?.trim() || !apiToken?.trim()) {
        addLog("error", "Credenciais 3CPLUS não configuradas para este tenant");
        return;
      }

      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_agents", domain: domain.trim(), api_token: apiToken.trim() },
      });

      if (error) {
        addLog("error", `Erro na edge function: ${error.message}`);
        return;
      }

      if (data?.error) {
        addLog("info", `Resposta: ${data.error}`);
        addLog("success", "Edge function threecplus-proxy está acessível");
      } else {
        addLog("success", `Resposta: ${JSON.stringify(data).slice(0, 200)}`);
      }

      // Test webhook endpoint
      addLog("info", "Verificando endpoint de webhook bidirecional...");
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/threecplus-webhook`;
      addLog("success", `Webhook URL: ${webhookUrl}`);
      addLog("info", `Status bidirecional: ${webhookActive ? "ATIVO ✅" : "INATIVO — ative webhooks nas campanhas"}`);

      addLog("success", "✅ Teste concluído");
    } catch (err: any) {
      addLog("error", `Erro: ${err.message}`);
    }
  };

  const handleSyncUsers = async () => {
    setSyncing(true);
    try {
      if (!domain?.trim() || !apiToken?.trim()) {
        toast.error("Credenciais 3CPLUS não configuradas", {
          description: "Configure domínio e token antes de sincronizar usuários.",
        });
        return;
      }

      const { data: tcResp, error: tcErr } = await supabase.functions.invoke("threecplus-proxy", {
        body: { action: "list_users", domain: domain.trim(), api_token: apiToken.trim() },
      });
      if (tcErr) {
        toast.error("Falha ao buscar usuários da 3CPlus", { description: tcErr.message });
        return;
      }
      const agents = extractList(tcResp);
      if (agents.length === 0) {
        toast.warning("Nenhum agente encontrado na 3CPlus", {
          description: "Verifique as credenciais na aba Telefonia.",
        });
        return;
      }

      const [{ data: profiles, error: pErr }, { data: emails, error: eErr }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, threecplus_extension, user_id"),
        supabase.rpc("get_user_emails"),
      ]);
      if (pErr) {
        toast.error("Falha ao carregar usuários do RIVO", { description: pErr.message });
        return;
      }
      if (eErr) {
        toast.error("Falha ao carregar e-mails", { description: eErr.message });
        return;
      }

      const emailByUserId = new Map<string, string>();
      for (const e of (emails || []) as { user_id: string; email: string }[]) {
        if (e.email) emailByUserId.set(e.user_id, e.email.toLowerCase().trim());
      }

      const agentByEmail = new Map<string, any>();
      for (const a of agents) {
        const em = (a.email || "").toString().toLowerCase().trim();
        if (em) agentByEmail.set(em, a);
      }

      const result: SyncResult = { matched: [], unmatched: [], alreadyCorrect: 0, failed: [] };

      for (const p of (profiles || []) as any[]) {
        const email = emailByUserId.get(p.user_id);
        if (!email) continue;
        const agent = agentByEmail.get(email);
        if (!agent) {
          result.unmatched.push({ name: p.full_name || "(sem nome)", email });
          continue;
        }
        const newExt = (agent.extension ?? "").toString().trim();
        if (!newExt) {
          result.unmatched.push({ name: p.full_name || "(sem nome)", email });
          continue;
        }
        const currentExt = (p.threecplus_extension || "").toString().trim();
        if (currentExt === newExt) {
          result.alreadyCorrect++;
          continue;
        }
        const { error: updErr } = await supabase
          .from("profiles")
          .update({ threecplus_extension: newExt } as any)
          .eq("id", p.id);
        if (updErr) {
          result.failed.push({ email, error: updErr.message });
        } else {
          result.matched.push({
            name: p.full_name || "(sem nome)",
            email,
            extension: newExt,
            previous: currentExt || null,
          });
        }
      }

      setSyncResult(result);
      setResultOpen(true);
      toast.success("Sincronização concluída", {
        description: `${result.matched.length} atualizados · ${result.alreadyCorrect} já corretos · ${result.unmatched.length} sem match`,
      });
    } catch (err: any) {
      toast.error("Erro na sincronização", { description: err.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
      <IntegrationTestCard
        icon={Phone}
        title="3CPlus — Telefonia / Discador"
        description="Click2call, tabulação e gerenciamento de campanhas de discagem. Credenciais por tenant."
        secrets={[]}
        onTest={handleTest}
      >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Modo de integração:</span>
            {webhookActive === null ? (
              <Badge variant="outline" className="text-xs">Verificando...</Badge>
            ) : webhookActive ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                <ArrowLeftRight className="w-3 h-3" />
                Bidirecional
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs gap-1 text-amber-600 border-amber-500/30 bg-amber-500/10">
                <ArrowRight className="w-3 h-3" />
                Unidirecional
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            {webhookActive
              ? "✅ Webhooks ativos — chamadas, qualificações e status são registrados automaticamente no RIVO."
              : "ℹ️ Ative webhooks nas campanhas (aba Telefonia → Campanhas) para receber eventos em tempo real da 3CPlus."}
          </p>

          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Button variant="outline" size="sm" onClick={handleSyncUsers} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              {syncing ? "Sincronizando..." : "Sincronizar usuários 3CPlus"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Preenche o ramal SIP dos operadores via match por e-mail.
            </span>
          </div>
        </div>
      </IntegrationTestCard>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resultado da sincronização</DialogTitle>
            <DialogDescription>
              Mapeamento de usuários do RIVO com agentes da 3CPlus por e-mail.
            </DialogDescription>
          </DialogHeader>

          {syncResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-border bg-emerald-500/10 p-3">
                  <div className="text-2xl font-bold text-emerald-600">{syncResult.matched.length}</div>
                  <div className="text-xs text-muted-foreground">Atualizados</div>
                </div>
                <div className="rounded-md border border-border bg-muted/50 p-3">
                  <div className="text-2xl font-bold text-foreground">{syncResult.alreadyCorrect}</div>
                  <div className="text-xs text-muted-foreground">Já corretos</div>
                </div>
                <div className="rounded-md border border-border bg-amber-500/10 p-3">
                  <div className="text-2xl font-bold text-amber-600">{syncResult.unmatched.length}</div>
                  <div className="text-xs text-muted-foreground">Sem match</div>
                </div>
              </div>

              <ScrollArea className="h-[280px] rounded-md border border-border p-3">
                <div className="space-y-3 text-sm">
                  {syncResult.matched.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-emerald-600 mb-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Sincronizados
                      </div>
                      <ul className="space-y-1">
                        {syncResult.matched.map((m) => (
                          <li key={m.email} className="text-xs flex justify-between gap-2 border-b border-border/50 pb-1">
                            <span className="truncate">
                              <span className="font-medium">{m.name}</span>{" "}
                              <span className="text-muted-foreground">· {m.email}</span>
                            </span>
                            <span className="font-mono text-foreground shrink-0">
                              {m.previous ? `${m.previous} → ` : ""}
                              <span className="text-emerald-600 font-semibold">{m.extension}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {syncResult.unmatched.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-amber-600 mb-1.5">
                        <AlertTriangle className="w-4 h-4" /> Sem correspondência na 3CPlus
                      </div>
                      <ul className="space-y-1">
                        {syncResult.unmatched.map((u) => (
                          <li key={u.email} className="text-xs text-muted-foreground border-b border-border/50 pb-1">
                            <span className="font-medium text-foreground">{u.name}</span> · {u.email}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {syncResult.failed.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 font-medium text-destructive mb-1.5">
                        <AlertTriangle className="w-4 h-4" /> Falhas
                      </div>
                      <ul className="space-y-1">
                        {syncResult.failed.map((f) => (
                          <li key={f.email} className="text-xs text-destructive">
                            {f.email}: {f.error}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {syncResult.matched.length === 0 &&
                    syncResult.unmatched.length === 0 &&
                    syncResult.failed.length === 0 && (
                      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                        <Info className="w-4 h-4" /> Todos os operadores já estavam com o ramal correto.
                      </div>
                    )}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setResultOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ThreeCPlusTab;
