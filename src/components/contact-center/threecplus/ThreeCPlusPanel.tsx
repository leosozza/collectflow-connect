import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, List, Send, History } from "lucide-react";
import ConfigPanel from "./ConfigPanel";
import CampaignsPanel from "./CampaignsPanel";
import MailingPanel from "./MailingPanel";
import HistoryPanel from "./HistoryPanel";

const ThreeCPlusPanel = () => {
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
          <TabsTrigger value="config" className="gap-2">
            <Settings className="w-4 h-4" />
            Configuração
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
        <TabsContent value="config">
          <ConfigPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ThreeCPlusPanel;
