import { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, LayoutDashboard, Megaphone, ListOrdered, PhoneCall, BarChart3, Users2, Award, Timer, ShieldBan, UsersRound, CalendarClock, MessageSquareText, UserCog, PhoneIncoming, Route, Clock } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
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
import WorkBreakIntervalsPanel from "./WorkBreakIntervalsPanel";

const tabs = [
  { value: "dashboard", label: "Dashboard", group: "operation", icon: LayoutDashboard },
  { value: "campaigns", label: "Campanhas", group: "operation", icon: Megaphone },
  { value: "mailing", label: "Mailing", group: "operation", icon: ListOrdered },
  { value: "history", label: "Chamadas", group: "operation", icon: PhoneCall },
  { value: "chart", label: "Gráficos", group: "operation", icon: BarChart3 },
  { value: "agents-report", label: "Produtividade", group: "operation", icon: Users2 },
  { value: "qualifications", label: "Qualificações", group: "admin", icon: Award },
  { value: "intervals", label: "Intervalos", group: "admin", icon: Timer },
  { value: "blocklist", label: "Bloqueio", group: "admin", icon: ShieldBan },
  { value: "teams", label: "Equipes", group: "admin", icon: UsersRound },
  { value: "schedules", label: "Agendamentos", group: "admin", icon: CalendarClock },
  { value: "sms", label: "SMS", group: "admin", icon: MessageSquareText },
  { value: "users", label: "Usuários", group: "admin", icon: UserCog },
  { value: "receptive", label: "Receptivo", group: "admin", icon: PhoneIncoming },
  { value: "routes", label: "Rotas", group: "admin", icon: Route },
  { value: "office-hours", label: "Horários", group: "admin", icon: Clock },
] as const;

const ThreeCPlusPanel = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const isOperator = profile?.role !== "admin";
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

  if (isOperator) {
    return <TelefoniaDashboard isOperatorView />;
  }

  const operationTabs = tabs.filter((t) => t.group === "operation");
  const adminTabs = tabs.filter((t) => t.group === "admin");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      {/* Navigation bar */}
      <div className="border-b border-border bg-card/50 rounded-t-xl px-1">
        <ScrollArea className="w-full">
          <div className="flex items-center gap-0.5 py-1.5 px-1">
            {operationTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setActiveTab(t.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}

            <Separator orientation="vertical" className="h-6 mx-1.5" />

            {adminTabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setActiveTab(t.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {activeTab !== "dashboard" && (
        <div className="flex items-center gap-3 px-4">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8" onClick={() => setActiveTab("dashboard")}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Dashboard
          </Button>
          <span className="text-sm font-semibold text-foreground">
            {tabs.find((t) => t.value === activeTab)?.label}
          </span>
        </div>
      )}

      <TabsContent value="dashboard"><TelefoniaDashboard /></TabsContent>
      <TabsContent value="campaigns"><CampaignsPanel /></TabsContent>
      <TabsContent value="mailing"><MailingPanel /></TabsContent>
      <TabsContent value="history"><CallHistoryPanel /></TabsContent>
      <TabsContent value="chart"><CallsChart /></TabsContent>
      <TabsContent value="agents-report"><AgentsReportPanel /></TabsContent>
      <TabsContent value="qualifications"><QualificationsPanel /></TabsContent>
      <TabsContent value="intervals"><WorkBreakIntervalsPanel /></TabsContent>
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
