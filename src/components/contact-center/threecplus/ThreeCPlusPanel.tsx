import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
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

const ThreeCPlusPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCredentials = settings.threecplus_domain && settings.threecplus_api_token;

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

  return (
    <Tabs defaultValue="dashboard" className="space-y-4">
      <div className="space-y-1">
        {/* Row 1: Operational tabs */}
        <TabsList className="h-9 bg-muted/60 p-0.5 w-auto">
          <TabsTrigger value="dashboard" className="text-xs px-3 h-8">Dashboard</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-xs px-3 h-8">Campanhas</TabsTrigger>
          <TabsTrigger value="mailing" className="text-xs px-3 h-8">Mailing</TabsTrigger>
          <TabsTrigger value="history" className="text-xs px-3 h-8">Chamadas</TabsTrigger>
          <TabsTrigger value="chart" className="text-xs px-3 h-8">Gráficos</TabsTrigger>
          <TabsTrigger value="agents-report" className="text-xs px-3 h-8">Produtividade</TabsTrigger>
        </TabsList>
        {/* Row 2: Administrative tabs */}
        <TabsList className="h-9 bg-muted/60 p-0.5 w-auto">
          <TabsTrigger value="qualifications" className="text-xs px-3 h-8">Qualificações</TabsTrigger>
          <TabsTrigger value="blocklist" className="text-xs px-3 h-8">Bloqueio</TabsTrigger>
          <TabsTrigger value="teams" className="text-xs px-3 h-8">Equipes</TabsTrigger>
          <TabsTrigger value="schedules" className="text-xs px-3 h-8">Agendamentos</TabsTrigger>
          <TabsTrigger value="sms" className="text-xs px-3 h-8">SMS</TabsTrigger>
          <TabsTrigger value="users" className="text-xs px-3 h-8">Usuários</TabsTrigger>
          <TabsTrigger value="receptive" className="text-xs px-3 h-8">Receptivo</TabsTrigger>
          <TabsTrigger value="routes" className="text-xs px-3 h-8">Rotas</TabsTrigger>
          <TabsTrigger value="office-hours" className="text-xs px-3 h-8">Horários</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="dashboard"><TelefoniaDashboard /></TabsContent>
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
