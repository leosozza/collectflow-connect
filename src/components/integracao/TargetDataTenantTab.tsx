import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

const TargetDataTenantTab = () => {
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Credenciais do Target Data salvas com sucesso!");
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Search className="w-6 h-6 text-primary" />
            <div>
              <CardTitle className="text-base">Target Data - Higienização de Base</CardTitle>
              <CardDescription>
                Enriquecimento de dados (telefones, e-mails, endereços) via CPF.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="api-key" className="text-xs text-muted-foreground">Token de API</Label>
              <Input
                id="api-key"
                type="password"
                placeholder="Insira o Token de API do Target Data"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="flex pt-2">
            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto min-w-[200px]">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configuração
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TargetDataTenantTab;
