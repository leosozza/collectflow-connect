import { useState } from "react";
import { AlertTriangle, LayoutDashboard, Megaphone, PhoneCall, Settings, BarChart3, Users2, Route, CalendarClock, UserCog, Timer, Clock, Award, UsersRound, ShieldBan } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import CampaignsPanel from "./CampaignsPanel";
import TelefoniaDashboard from "./TelefoniaDashboard";
import CallsChart from "./CallsChart";
import AgentsReportPanel from "./AgentsReportPanel";
import QualificationsPanel from "./QualificationsPanel";
import BlockListPanel from "./BlockListPanel";
import TeamsPanel from "./TeamsPanel";
import SchedulesPanel from "./SchedulesPanel";
import UsersPanel from "./UsersPanel";

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
      { value: "routes", label: "Rotas", icon: Route },
    ],
  },
  {
    id: "chamadas", label: "Chamadas", icon: PhoneCall,
    tabs: [
      { value: "schedules", label: "Agendamentos", icon: CalendarClock },
      { value: "blocklist", label: "Bloqueio", icon: ShieldBan },
    ],
  },
  {
    id: "controle", label: "Controle", icon: Settings,
    tabs: [
      { value: "users", label: "Usuários", icon: UserCog },
      { value: "teams", label: "Equipes", icon: UsersRound },
      { value: "intervals", label: "Intervalos", icon: Timer },
      { value: "office-hours", label: "Horários", icon: Clock },
      { value: "qualifications", label: "Qualificações", icon: Award },
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
      <div className="space-y-4">
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
    chart: <CallsChart />,
    "agents-report": <AgentsReportPanel />,
    qualifications: <QualificationsPanel />,
    intervals: <WorkBreakIntervalsPanel />,
    blocklist: <BlockListPanel />,
    teams: <TeamsPanel />,
    schedules: <SchedulesPanel />,
    users: <UsersPanel />,
    receptive: <ReceptiveQueuesPanel />,
    routes: <RoutesPanel />,
    "office-hours": <OfficeHoursPanel />,
  };

  return (
    <div className="space-y-4">
      {/* Level 1 — Group navigation */}
      <div className="flex items-center gap-6 border-b border-border">
        {groups.map((g) => {
          const Icon = g.icon;
          const isActive = activeGroup === g.id;
          return (
            <button
              key={g.id}
              onClick={() => handleGroupChange(g.id)}
              className={cn(
                "flex items-center gap-2 pb-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="w-4 h-4" />
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Level 2 — Sub-tab navigation */}
      {currentGroup.tabs.length > 1 && (
        <div className="flex items-center gap-2">
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
                    ? "bg-primary/15 text-primary font-semibold border-primary/30"
                    : "text-muted-foreground border-transparent hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div>{contentMap[activeTab]}</div>
    </div>
  );
};

export default ThreeCPlusPanel;
