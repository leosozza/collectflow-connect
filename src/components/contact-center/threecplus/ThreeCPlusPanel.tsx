import { useState } from "react";
import { AlertTriangle, LayoutDashboard, Megaphone, PhoneCall, Settings, BarChart3, Users2, ListOrdered, Route, PhoneIncoming, CalendarClock, UserCog, Timer, Clock, Award, UsersRound, ShieldBan, MessageSquareText } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
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

const groups = [
  {
    id: "dashboard", label: "Dashboard", icon: LayoutDashboard,
    tabs: [
      { value: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
      { value: "chart", label: "Gráficos", icon: BarChart3 },
      { value: "agents-report", label: "Produtividade", icon: Users2 },
    ],
  },
  {
    id: "campanhas", label: "Campanhas", icon: Megaphone,
    tabs: [
      { value: "campaigns", label: "Campanhas", icon: Megaphone },
      { value: "mailing", label: "Mailing", icon: ListOrdered },
      { value: "routes", label: "Rotas", icon: Route },
    ],
  },
  {
    id: "chamadas", label: "Chamadas", icon: PhoneCall,
    tabs: [
      { value: "history", label: "Histórico", icon: PhoneCall },
      { value: "receptive", label: "Receptivo", icon: PhoneIncoming },
      { value: "schedules", label: "Agendamentos", icon: CalendarClock },
    ],
  },
  {
    id: "controle", label: "Controle", icon: Settings,
    tabs: [
      { value: "users", label: "Usuários", icon: UserCog },
      { value: "intervals", label: "Intervalos", icon: Timer },
      { value: "office-hours", label: "Horários", icon: Clock },
      { value: "qualifications", label: "Qualificações", icon: Award },
      { value: "teams", label: "Equipes", icon: UsersRound },
      { value: "blocklist", label: "Bloqueio", icon: ShieldBan },
      { value: "sms", label: "SMS", icon: MessageSquareText },
    ],
  },
] as const;

const ThreeCPlusPanel = () => {
  const { tenant } = useTenant();
  const { profile } = useAuth();
  const isOperator = profile?.role !== "admin";
  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasCredentials = settings.threecplus_domain && settings.threecplus_api_token;
  const [activeGroup, setActiveGroup] = useState("dashboard");
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
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Telefonia</h1>
          <p className="text-sm text-muted-foreground">Gerencie campanhas, operadores e chamadas</p>
        </div>
        <TelefoniaDashboard isOperatorView />
      </div>
    );
  }

  const currentGroup = groups.find((g) => g.id === activeGroup) || groups[0];

  const handleGroupChange = (groupId: string) => {
    setActiveGroup(groupId);
    const group = groups.find((g) => g.id === groupId);
    if (group) setActiveTab(group.tabs[0].value);
  };

  const contentMap: Record<string, JSX.Element> = {
    dashboard: <TelefoniaDashboard />,
    campaigns: <CampaignsPanel />,
    mailing: <MailingPanel />,
    history: <CallHistoryPanel />,
    chart: <CallsChart />,
    "agents-report": <AgentsReportPanel />,
    qualifications: <QualificationsPanel />,
    intervals: <WorkBreakIntervalsPanel />,
    blocklist: <BlockListPanel />,
    teams: <TeamsPanel />,
    schedules: <SchedulesPanel />,
    sms: <SMSPanel />,
    users: <UsersPanel />,
    receptive: <ReceptiveQueuesPanel />,
    routes: <RoutesPanel />,
    "office-hours": <OfficeHoursPanel />,
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Telefonia</h1>
        <p className="text-sm text-muted-foreground">Gerencie campanhas, operadores e chamadas</p>
      </div>

      {/* Level 1 — Group navigation */}
      <div className="flex items-center gap-3">
        {groups.map((g) => {
          const Icon = g.icon;
          const isActive = activeGroup === g.id;
          return (
            <button
              key={g.id}
              onClick={() => handleGroupChange(g.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card text-muted-foreground border border-border hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Level 2 — Sub-tab navigation */}
      {currentGroup.tabs.length > 1 && (
        <>
          <div className="border-t border-border my-1" />
          <div className="flex items-center gap-2 px-1 py-2">
            {currentGroup.tabs.map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.value;
              return (
                <button
                  key={t.value}
                  onClick={() => setActiveTab(t.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-all border",
                    isActive
                      ? "bg-primary/20 text-primary font-semibold border-primary/40"
                      : "text-muted-foreground/80 border-transparent hover:bg-accent hover:text-foreground"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Content */}
      <div>{contentMap[activeTab]}</div>
    </div>
  );
};

export default ThreeCPlusPanel;
