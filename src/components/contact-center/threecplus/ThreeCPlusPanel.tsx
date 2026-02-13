import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, Menu } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import CampaignsPanel from "./CampaignsPanel";
import MailingPanel from "./MailingPanel";
import CallHistoryPanel from "./CallHistoryPanel";
import TelefoniaDashboard from "./TelefoniaDashboard";
import CallsChart from "./CallsChart";
import AgentsReportPanel from "./AgentsReportPanel";
import QualificationsPanel from "./QualificationsPanel";
import BlockListPanel from "./BlockListPanel";
import TeamsPanel from "./TeamsPanel";
import SchedulesPanel from "./SchedulesPanel";
import SMSPanel from "./SMSPanel";
import UsersPanel from "./UsersPanel";
import ReceptiveQueuesPanel from "./ReceptiveQueuesPanel";
import RoutesPanel from "./RoutesPanel";
import OfficeHoursPanel from "./OfficeHoursPanel";

const tabs = [
  { value: "dashboard", label: "Dashboard", group: "operation" },
  { value: "campaigns", label: "Campanhas", group: "operation" },
  { value: "mailing", label: "Mailing", group: "operation" },
  { value: "history", label: "Chamadas", group: "operation" },
  { value: "chart", label: "Gráficos", group: "operation" },
  { value: "agents-report", label: "Produtividade", group: "operation" },
  { value: "qualifications", label: "Qualificações", group: "admin" },
  { value: "blocklist", label: "Bloqueio", group: "admin" },
  { value: "teams", label: "Equipes", group: "admin" },
  { value: "schedules", label: "Agendamentos", group: "admin" },
  { value: "sms", label: "SMS", group: "admin" },
  { value: "users", label: "Usuários", group: "admin" },
  { value: "receptive", label: "Receptivo", group: "admin" },
  { value: "routes", label: "Rotas", group: "admin" },
  { value: "office-hours", label: "Horários", group: "admin" },
] as const;

const ThreeCPlusPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCredentials = settings.threecplus_domain && settings.threecplus_api_token;
  const [activeTab, setActiveTab] = useState("dashboard");

  if (!hasCredentials) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <p className="text-sm text-muted-foreground">
            Credenciais 3CPlus não configuradas. Vá em{" "}
            <strong>Integrações → Telefonia</strong> para configurar domínio e token de API.
          </p>
        </CardContent>
      </Card>
    );
  }

  const activeLabel = tabs.find((t) => t.value === activeTab)?.label ?? "Dashboard";

  const menuButton = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
          <Menu className="h-3.5 w-3.5" />
          {activeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>Operacional</DropdownMenuLabel>
        {tabs.filter((t) => t.group === "operation").map((t) => (
          <DropdownMenuItem
            key={t.value}
            onSelect={() => setActiveTab(t.value)}
            className={activeTab === t.value ? "bg-accent font-medium" : ""}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Administrativo</DropdownMenuLabel>
        {tabs.filter((t) => t.group === "admin").map((t) => (
          <DropdownMenuItem
            key={t.value}
            onSelect={() => setActiveTab(t.value)}
            className={activeTab === t.value ? "bg-accent font-medium" : ""}
          >
            {t.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">

      <TabsContent value="dashboard"><TelefoniaDashboard menuButton={menuButton} /></TabsContent>
      <TabsContent value="campaigns"><CampaignsPanel /></TabsContent>
      <TabsContent value="mailing"><MailingPanel /></TabsContent>
      <TabsContent value="history"><CallHistoryPanel /></TabsContent>
      <TabsContent value="chart"><CallsChart /></TabsContent>
      <TabsContent value="agents-report"><AgentsReportPanel /></TabsContent>
      <TabsContent value="qualifications"><QualificationsPanel /></TabsContent>
      <TabsContent value="blocklist"><BlockListPanel /></TabsContent>
      <TabsContent value="teams"><TeamsPanel /></TabsContent>
      <TabsContent value="schedules"><SchedulesPanel /></TabsContent>
      <TabsContent value="sms"><SMSPanel /></TabsContent>
      <TabsContent value="users"><UsersPanel /></TabsContent>
      <TabsContent value="receptive"><ReceptiveQueuesPanel /></TabsContent>
      <TabsContent value="routes"><RoutesPanel /></TabsContent>
      <TabsContent value="office-hours"><OfficeHoursPanel /></TabsContent>
    </Tabs>
  );
};

export default ThreeCPlusPanel;
