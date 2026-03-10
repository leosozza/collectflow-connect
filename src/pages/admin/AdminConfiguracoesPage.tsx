import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Shield, Bell, Database, Globe } from "lucide-react";

const configSections = [
  {
    icon: Shield,
    title: "Segurança",
    description: "Configurações de segurança e autenticação",
    items: [
      { label: "Autenticação de dois fatores (2FA)", enabled: false },
      { label: "Timeout automático de sessão", enabled: true },
      { label: "Registro de IP e dispositivo", enabled: true },
    ],
  },
  {
    icon: Bell,
    title: "Notificações",
    description: "Alertas e notificações do sistema",
    items: [
      { label: "Alertas de novo inquilino", enabled: true },
      { label: "Alertas de inadimplência", enabled: true },
      { label: "Relatório semanal por e-mail", enabled: false },
    ],
  },
  {
    icon: Database,
    title: "Sistema",
    description: "Configurações gerais do sistema",
    items: [
      { label: "Modo de manutenção", enabled: false },
      { label: "Logs detalhados", enabled: true },
      { label: "Backup automático", enabled: true },
    ],
  },
  {
    icon: Globe,
    title: "Integrações Globais",
    description: "Integrações e APIs do sistema",
    items: [
      { label: "API pública habilitada", enabled: true },
      { label: "Webhooks globais", enabled: false },
    ],
  },
];

const AdminConfiguracoesPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="w-6 h-6 text-primary" />
          Configurações do Sistema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Configurações globais da plataforma</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {configSections.map((section) => (
          <Card key={section.title}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <section.icon className="w-4 h-4 text-primary" />
                {section.title}
              </CardTitle>
              <p className="text-xs text-muted-foreground">{section.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.items.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-sm text-foreground">{item.label}</span>
                  <Switch defaultChecked={item.enabled} />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex justify-end">
        <Button>Salvar Configurações</Button>
      </div>
    </div>
  );
};

export default AdminConfiguracoesPage;
