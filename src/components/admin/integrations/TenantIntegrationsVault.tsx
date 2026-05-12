import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Key, ShieldCheck, Loader2, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TenantIntegrationsVaultProps {
  tenantId: string;
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
  callback_registered_at: string | null;
}

export const TenantIntegrationsVault = ({ tenantId }: TenantIntegrationsVaultProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [status, setStatus] = useState<VaultStatus | null>(null);

  const [form, setForm] = useState({ client_id: "", client_secret: "" });

  const loadStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "get_status", tenant_id: tenantId },
      });
      if (error) throw error;
      setStatus(data as VaultStatus);
      setForm({ client_id: "", client_secret: "" });
    } catch (err: any) {
      console.error("[Vault] Error loading:", err);
      toast({ title: "Erro ao carregar cofre", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  const handleSave = async () => {
    if (!form.client_id) {
      toast({ title: "Client ID obrigatório", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: {
          action: "save",
          tenant_id: tenantId,
          client_id: form.client_id,
          client_secret: form.client_secret,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Configurações salvas!", description: "Credenciais validadas e armazenadas." });
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "test", tenant_id: tenantId },
      });
      if (error) throw error;
      if ((data as any)?.ok) {
        toast({ title: "Conexão OK", description: (data as any).message });
      } else {
        throw new Error((data as any)?.message || (data as any)?.error || "Falha");
      }
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Falha no teste", description: err.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Remover credenciais Negociarie deste tenant?")) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("negociarie-credentials", {
        body: { action: "delete", tenant_id: tenantId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Credenciais removidas" });
      await loadStatus();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Cofre de Integrações</h3>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Key className="w-4 h-4" />
              Negociarie
            </CardTitle>
            {status?.has_credentials ? (
              <Badge variant="default" className="bg-green-600">Configurado</Badge>
            ) : status?.uses_global_fallback ? (
              <Badge variant="secondary">Fallback global ativo</Badge>
            ) : (
              <Badge variant="outline" className="text-destructive border-destructive/40">Não configurado</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Credenciais para geração de Boletos e Pix nesta assessoria.
            {status?.uses_global_fallback && !status?.has_credentials && (
              <span className="block mt-1 text-muted-foreground">
                Este tenant está usando as credenciais globais da plataforma. Configure abaixo apenas se este tenant tiver Client ID/Secret próprios na Negociarie (sobrepõem o fallback).
              </span>
            )}
            {status?.client_id_masked && (
              <span className="block mt-1 font-mono text-[10px]">
                Atual: {status.client_id_masked}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Client ID {status?.has_credentials && "(deixe vazio para manter)"}</Label>
            <Input
              value={form.client_id}
              onChange={e => setForm(prev => ({ ...prev, client_id: e.target.value }))}
              placeholder={status?.has_credentials ? "Manter atual" : "Ex: 550e8400-e29b-41d4-a716-446655440000"}
              className="bg-background"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Client Secret {status?.has_credentials && "(deixe vazio para manter)"}</Label>
            <div className="relative">
              <Input
                type={showSecret ? "text" : "password"}
                value={form.client_secret}
                onChange={e => setForm(prev => ({ ...prev, client_secret: e.target.value }))}
                placeholder="••••••••••••••••"
                className="bg-background pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={saving || !form.client_id}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar no Cofre
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing || (!status?.has_credentials && !status?.uses_global_fallback)}
              title="Testar Conexão"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            </Button>
            {status?.has_credentials && !status?.uses_global_fallback && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleDelete}
                disabled={saving}
                title="Remover credenciais"
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
        </CardContent>
      </Card>
    </div>
  );
};
