import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, List, Send, History, AlertTriangle, BarChart3, Users, Tag, ShieldBan, UsersRound } from "lucide-react";
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

const ThreeCPlusPanel = () => {
  const { tenant } = useTenant();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCredentials = settings.threecplus_domain && settings.threecplus_api_token;

  if (!hasCredentials) {
    return (
      <div className="mt-4">
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-muted-foreground">
              Credenciais 3CPlus não configuradas. Vá em{" "}
              <strong>Integrações → Telefonia</strong> para configurar domínio e token de API.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <Tabs defaultValue="dashboard">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2">
            <List className="w-4 h-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="mailing" className="gap-2">
            <Send className="w-4 h-4" />
            Mailing
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            Chamadas
          </TabsTrigger>
          <TabsTrigger value="chart" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Gráficos
          </TabsTrigger>
          <TabsTrigger value="agents-report" className="gap-2">
            <Users className="w-4 h-4" />
            Produtividade
          </TabsTrigger>
          <TabsTrigger value="qualifications" className="gap-2">
            <Tag className="w-4 h-4" />
            Qualificações
          </TabsTrigger>
          <TabsTrigger value="blocklist" className="gap-2">
            <ShieldBan className="w-4 h-4" />
            Bloqueio
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-2">
            <UsersRound className="w-4 h-4" />
            Equipes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard">
          <TelefoniaDashboard />
        </TabsContent>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="mailing">
          <MailingPanel />
        </TabsContent>
        <TabsContent value="history">
          <CallHistoryPanel />
        </TabsContent>
        <TabsContent value="chart">
          <CallsChart />
        </TabsContent>
        <TabsContent value="agents-report">
          <AgentsReportPanel />
        </TabsContent>
        <TabsContent value="qualifications">
          <QualificationsPanel />
        </TabsContent>
        <TabsContent value="blocklist">
          <BlockListPanel />
        </TabsContent>
        <TabsContent value="teams">
          <TeamsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ThreeCPlusPanel;
