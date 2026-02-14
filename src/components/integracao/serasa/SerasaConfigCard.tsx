import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Loader2, Save, ShieldCheck } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { useToast } from "@/hooks/use-toast";

const SerasaConfigCard = () => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    serasa_codigo_empresa: "",
    serasa_cnpj: "",
    serasa_razao_social: "",
    serasa_natureza_padrao: "COBRANCA",
    serasa_enabled: false,
  });

  useEffect(() => {
    if (tenant?.settings) {
      const s = tenant.settings as Record<string, any>;
      setConfig({
        serasa_codigo_empresa: s.serasa_codigo_empresa || "",
        serasa_cnpj: s.serasa_cnpj || "",
        serasa_razao_social: s.serasa_razao_social || "",
        serasa_natureza_padrao: s.serasa_natureza_padrao || "COBRANCA",
        serasa_enabled: s.serasa_enabled || false,
      });
    }
  }, [tenant]);

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      const currentSettings = (tenant.settings as Record<string, any>) || {};
      await updateTenant(tenant.id, {
        settings: { ...currentSettings, ...config },
      });
      refetch();
      toast({ title: "Configuração salva", description: "Credenciais Serasa atualizadas" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5" />
          Configuração Serasa
        </CardTitle>
        <CardDescription>
          Dados da empresa para envio de negativações ao Serasa Experian
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={config.serasa_enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, serasa_enabled: v }))}
          />
          <Label>Integração Serasa ativa</Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Código da Empresa</Label>
            <Input
              value={config.serasa_codigo_empresa}
              onChange={(e) => setConfig((c) => ({ ...c, serasa_codigo_empresa: e.target.value }))}
              placeholder="Ex: 00123456"
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <Input
              value={config.serasa_cnpj}
              onChange={(e) => setConfig((c) => ({ ...c, serasa_cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label>Razão Social</Label>
            <Input
              value={config.serasa_razao_social}
              onChange={(e) => setConfig((c) => ({ ...c, serasa_razao_social: e.target.value }))}
              placeholder="Nome da empresa"
            />
          </div>
          <div className="space-y-2">
            <Label>Natureza da Operação Padrão</Label>
            <Input
              value={config.serasa_natureza_padrao}
              onChange={(e) => setConfig((c) => ({ ...c, serasa_natureza_padrao: e.target.value }))}
              placeholder="COBRANCA"
            />
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
};

export default SerasaConfigCard;
