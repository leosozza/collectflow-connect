import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Zap, Play, Eye, EyeOff, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CreditorIntegrationsVaultProps {
  tenantId: string;
  creditorId: string;
}

interface VaultStatus {
  configured: boolean;
  has_credentials: boolean;
  uses_global_fallback: boolean;
  client_id_masked: string;
  is_active: boolean;
  last_test_at: string | null;
  last_test_ok: boolean | null;
  last_test_message: string | null;
  tenant_fallback_active?: boolean;
  tenant_uses_global_fallback?: boolean;
}

export const CreditorIntegrationsVault = ({ tenantId, creditorId }: CreditorIntegrationsVaultProps) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [form, setForm] = useState({ client_id: "", client_secret: "" });

  const loadStatus = async () => {
    if (!creditorId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "get_status", tenant_id: tenantId, creditor_id: creditorId },
      });
      if (error) throw error;
      setStatus(data as VaultStatus);
      setForm({ client_id: "", client_secret: "" });
    } catch (err: any) {
      console.error("[CreditorVault] Error loading:", err);
      toast.error("Erro ao carregar cofre: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creditorId, tenantId]);

  const handleSave = async () => {
    if (!form.client_id) {
      toast.error("Client ID é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: {
          action: "save",
          tenant_id: tenantId,
          creditor_id: creditorId,
          client_id: form.client_id,
          client_secret: form.client_secret,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Credenciais validadas e salvas no cofre!");
      await loadStatus();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "test", tenant_id: tenantId, creditor_id: creditorId },
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast.success((data as any).message || "Conexão OK");
      } else {
        throw new Error((data as any)?.message || (data as any)?.error || "Falha");
      }
      await loadStatus();
    } catch (err: any) {
      toast.error("Falha no teste: " + err.message);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remover credenciais Negociarie deste credor?")) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "delete", tenant_id: tenantId, creditor_id: creditorId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Credenciais removidas");
      await loadStatus();
    } catch (err: any) {
      toast.error("Erro ao remover: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/20 bg-primary/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">Configuração Negociarie</h4>
              <p className="text-[10px] text-muted-foreground">Credenciais exclusivas para este credor</p>
            </div>
          </div>
          {status?.has_credentials ? (
            <Badge variant="outline" className="bg-background text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3 text-green-500" /> Cofre Ativo
            </Badge>
          ) : status?.tenant_fallback_active ? (
            <Badge variant="outline" className="bg-background text-[10px] gap-1">
              <ShieldCheck className="w-3 h-3 text-blue-500" />
              Usando cofre do tenant{status?.tenant_uses_global_fallback ? " (fallback global)" : ""}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Não configurado</Badge>
          )}
        </div>

        {!status?.has_credentials && status?.tenant_fallback_active && (
          <p className="text-[11px] text-muted-foreground mb-3 leading-snug">
            Este credor não possui credenciais próprias. As cobranças usam as credenciais configuradas no nível do tenant.
            Configure abaixo apenas se este credor tiver Client ID/Secret próprios na Negociarie.
          </p>
        )}
        {!status?.has_credentials && !status?.tenant_fallback_active && (
          <p className="text-[11px] text-destructive/90 mb-3 leading-snug">
            Sem credenciais — boletos deste credor falharão até configurar aqui ou no nível do tenant.
          </p>
        )}

        <div className="space-y-3">
          {status?.client_id_masked && (
            <p className="text-[10px] text-muted-foreground font-mono">
              Atual: {status.client_id_masked}
            </p>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground ml-1">
              Client ID {status?.has_credentials && "(deixe vazio para manter)"}
            </label>
            <Input
              placeholder={status?.has_credentials ? "Manter atual" : "Insira o Client ID do Credor"}
              value={form.client_id}
              onChange={(e) => setForm(prev => ({ ...prev, client_id: e.target.value }))}
              className="bg-background border-primary/10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground ml-1">
              Client Secret {status?.has_credentials && "(deixe vazio para manter)"}
            </label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                placeholder="Insira o Client Secret"
                value={form.client_secret}
                onChange={(e) => setForm(prev => ({ ...prev, client_secret: e.target.value }))}
                className="bg-background border-primary/10 pr-10"
              />
              <button
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors"
                type="button"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              className="flex-1 gap-2"
              onClick={handleSave}
              disabled={saving || loading || !form.client_id}
            >
              <Save className="w-4 h-4" />
              {saving ? "Salvando..." : "Salvar no Cofre"}
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-primary/20 hover:bg-primary/10"
              onClick={handleTest}
              disabled={testing || !status?.has_credentials}
            >
              {testing ? (
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="w-4 h-4 text-primary fill-primary" />
              )}
              Testar
            </Button>
            {status?.has_credentials && (
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleDelete}
                disabled={saving}
                title="Remover"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>

          {status?.last_test_at && (
            <p className="text-[10px] text-muted-foreground italic">
              Último teste: {new Date(status.last_test_at).toLocaleString("pt-BR")} —{" "}
              {status.last_test_ok ? "✓" : "✗"} {status.last_test_message}
            </p>
          )}
        </div>
      </Card>

      <p className="text-[10px] text-muted-foreground px-1 italic">
        * As credenciais são validadas na Negociarie antes de serem armazenadas, criptografadas e isoladas por Tenant e Credor.
      </p>
    </div>
  );
};
