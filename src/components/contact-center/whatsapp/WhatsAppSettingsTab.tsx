import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface AutocloseSettings {
  enabled: boolean;
  inactivity_hours: number;
  applies_to_statuses: string[];
  applies_to_official: boolean;
  applies_to_unofficial: boolean;
}

const DEFAULTS: AutocloseSettings = {
  enabled: false,
  inactivity_hours: 24,
  applies_to_statuses: ["open"],
  applies_to_official: true,
  applies_to_unofficial: true,
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Abertas" },
  { value: "waiting", label: "Aguardando" },
];

const WhatsAppSettingsTab = () => {
  const { tenant } = useTenant();
  const [settings, setSettings] = useState<AutocloseSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenant.id)
        .single();
      const ac = ((data?.settings as any)?.whatsapp_autoclose || {}) as Partial<AutocloseSettings>;
      setSettings({ ...DEFAULTS, ...ac });
      setLoading(false);
    })();
  }, [tenant?.id]);

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { data: cur } = await supabase
        .from("tenants")
        .select("settings")
        .eq("id", tenant.id)
        .single();
      const newSettings = {
        ...((cur?.settings as any) || {}),
        whatsapp_autoclose: settings,
      };
      const { error } = await supabase
        .from("tenants")
        .update({ settings: newSettings })
        .eq("id", tenant.id);
      if (error) throw error;
      toast.success("Configurações salvas");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = (status: string, checked: boolean) => {
    setSettings((s) => ({
      ...s,
      applies_to_statuses: checked
        ? Array.from(new Set([...s.applies_to_statuses, status]))
        : s.applies_to_statuses.filter((x) => x !== status),
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-semibold mb-1">Personalização do WhatsApp</h2>
        <p className="text-sm text-muted-foreground">
          Configurações operacionais internas da RIVO Connect (não substituem o SLA oficial da API).
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="mt-1 p-2 rounded-md bg-muted">
                <Timer className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Fechamento automático por inatividade</CardTitle>
                <CardDescription className="mt-1">
                  Conversas sem interação por X horas serão fechadas automaticamente, com a tabulação{" "}
                  <span className="font-medium">"Fechamento automático"</span>.
                </CardDescription>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="hours">Horas de inatividade</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={720}
              value={settings.inactivity_hours}
              onChange={(e) =>
                setSettings((s) => ({ ...s, inactivity_hours: Number(e.target.value) || 24 }))
              }
              disabled={!settings.enabled}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 1h, máximo 720h (30 dias). A última mensagem (cliente ou operador) reinicia o
              relógio.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Status que entram na regra</Label>
            <div className="flex gap-4">
              {STATUS_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={settings.applies_to_statuses.includes(opt.value)}
                    onCheckedChange={(v) => toggleStatus(opt.value, v === true)}
                    disabled={!settings.enabled}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Aplicar a quais tipos de instância</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={settings.applies_to_official}
                  onCheckedChange={(v) =>
                    setSettings((s) => ({ ...s, applies_to_official: v === true }))
                  }
                  disabled={!settings.enabled}
                />
                Oficial (Meta Cloud)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={settings.applies_to_unofficial}
                  onCheckedChange={(v) =>
                    setSettings((s) => ({ ...s, applies_to_unofficial: v === true }))
                  }
                  disabled={!settings.enabled}
                />
                Não oficial (Evolution / WuzAPI / Gupshup)
              </label>
            </div>
          </div>

          <div className="pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppSettingsTab;
