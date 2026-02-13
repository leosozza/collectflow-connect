import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { List, Send, History, AlertTriangle } from "lucide-react";
import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import CampaignsPanel from "./CampaignsPanel";
import MailingPanel from "./MailingPanel";
import HistoryPanel from "./HistoryPanel";

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
      <Tabs defaultValue="campaigns">
        <TabsList className="flex-wrap">
          <TabsTrigger value="campaigns" className="gap-2">
            <List className="w-4 h-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="mailing" className="gap-2">
            <Send className="w-4 h-4" />
            Enviar Mailing
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            Histórico
          </TabsTrigger>
        </TabsList>
        <TabsContent value="campaigns">
          <CampaignsPanel />
        </TabsContent>
        <TabsContent value="mailing">
          <MailingPanel />
        </TabsContent>
        <TabsContent value="history">
          <HistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ThreeCPlusPanel;
