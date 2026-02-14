import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Settings, Loader2, Save } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { useToast } from "@/hooks/use-toast";

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA",
  "PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"
];

const ESPECIE_OPTIONS = [
  { value: "DM", label: "DM - Duplicata Mercantil" },
  { value: "NP", label: "NP - Nota Promissória" },
  { value: "DS", label: "DS - Duplicata de Serviço" },
  { value: "CH", label: "CH - Cheque" },
  { value: "LC", label: "LC - Letra de Câmbio" },
];

const ProtestoConfigCard = () => {
  const { tenant, refetch } = useTenant();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState({
    cenprot_convenio: "",
    cenprot_apresentante: "",
    cenprot_cnpj: "",
    cenprot_uf: "",
    cenprot_cidade: "",
    cenprot_especie_padrao: "DM",
    cenprot_enabled: false,
  });

  useEffect(() => {
    if (tenant?.settings) {
      const s = tenant.settings as Record<string, any>;
      setConfig({
        cenprot_convenio: s.cenprot_convenio || "",
        cenprot_apresentante: s.cenprot_apresentante || "",
        cenprot_cnpj: s.cenprot_cnpj || "",
        cenprot_uf: s.cenprot_uf || "",
        cenprot_cidade: s.cenprot_cidade || "",
        cenprot_especie_padrao: s.cenprot_especie_padrao || "DM",
        cenprot_enabled: s.cenprot_enabled || false,
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
      toast({ title: "Configuração salva", description: "Convênio CENPROT atualizado" });
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
          <Settings className="w-5 h-5" />
          Configuração do Convênio CENPROT
        </CardTitle>
        <CardDescription>
          Dados do apresentante para envio de títulos a protesto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={config.cenprot_enabled}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, cenprot_enabled: v }))}
          />
          <Label>Integração CENPROT ativa</Label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Nº do Convênio</Label>
            <Input
              value={config.cenprot_convenio}
              onChange={(e) => setConfig((c) => ({ ...c, cenprot_convenio: e.target.value }))}
              placeholder="Ex: 12345"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do Apresentante</Label>
            <Input
              value={config.cenprot_apresentante}
              onChange={(e) => setConfig((c) => ({ ...c, cenprot_apresentante: e.target.value }))}
              placeholder="Razão social"
            />
          </div>
          <div className="space-y-2">
            <Label>CNPJ do Apresentante</Label>
            <Input
              value={config.cenprot_cnpj}
              onChange={(e) => setConfig((c) => ({ ...c, cenprot_cnpj: e.target.value }))}
              placeholder="00.000.000/0000-00"
            />
          </div>
          <div className="space-y-2">
            <Label>UF</Label>
            <Select
              value={config.cenprot_uf}
              onValueChange={(v) => setConfig((c) => ({ ...c, cenprot_uf: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cidade</Label>
            <Input
              value={config.cenprot_cidade}
              onChange={(e) => setConfig((c) => ({ ...c, cenprot_cidade: e.target.value }))}
              placeholder="Cidade do apresentante"
            />
          </div>
          <div className="space-y-2">
            <Label>Espécie Padrão</Label>
            <Select
              value={config.cenprot_especie_padrao}
              onValueChange={(v) => setConfig((c) => ({ ...c, cenprot_especie_padrao: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESPECIE_OPTIONS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

export default ProtestoConfigCard;
