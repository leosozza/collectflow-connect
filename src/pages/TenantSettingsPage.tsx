import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { updateTenant } from "@/services/tenantService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const TenantSettingsPage = () => {
  const { tenant, plan, isTenantAdmin, refetch } = useTenant();
  const { toast } = useToast();
  const [name, setName] = useState(tenant?.name || "");
  const [primaryColor, setPrimaryColor] = useState(tenant?.primary_color || "#F97316");
  const [saving, setSaving] = useState(false);

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!tenant) return;
    setSaving(true);
    try {
      await updateTenant(tenant.id, { name, primary_color: primaryColor });
      await refetch();
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const limits = plan?.limits as Record<string, any> || {};
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações da Empresa</h1>
        <p className="text-muted-foreground">Gerencie os dados e plano da sua empresa</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dados da Empresa</CardTitle>
            <CardDescription>Informações gerais do tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da empresa</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={tenant?.slug || ""} disabled />
              <p className="text-xs text-muted-foreground">O slug não pode ser alterado</p>
            </div>
            <div className="space-y-2">
              <Label>Cor primária</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border-0"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : "Salvar alterações"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plano Atual</CardTitle>
            <CardDescription>Detalhes do seu plano e uso</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-lg font-bold">{plan?.name || "Sem plano"}</p>
                <p className="text-sm text-muted-foreground">
                  {plan ? formatCurrency(plan.price_monthly) + "/mês" : ""}
                </p>
              </div>
              <Badge>{tenant?.status === "active" ? "Ativo" : "Inativo"}</Badge>
            </div>

            {limits.max_users && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Usuários</span>
                  <span className="text-muted-foreground">Limite: {limits.max_users}</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            )}

            {limits.max_clients && (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>Clientes</span>
                  <span className="text-muted-foreground">Limite: {limits.max_clients?.toLocaleString()}</span>
                </div>
                <Progress value={0} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TenantSettingsPage;
