import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, MessageCircle } from "lucide-react";
import CallDispositionTypesTab from "./CallDispositionTypesTab";

const DispositionTabsWrapper = () => {
  return (
    <Tabs defaultValue="call" className="w-full">
      <TabsList>
        <TabsTrigger value="call" className="gap-2">
          <Phone className="w-4 h-4" /> Chamadas
        </TabsTrigger>
        <TabsTrigger value="whatsapp" className="gap-2">
          <MessageCircle className="w-4 h-4" /> WhatsApp
        </TabsTrigger>
      </TabsList>
      <TabsContent value="call">
        <CallDispositionTypesTab channel="call" />
      </TabsContent>
      <TabsContent value="whatsapp">
        <CallDispositionTypesTab channel="whatsapp" />
      </TabsContent>
    </Tabs>
  );
};

export default DispositionTabsWrapper;
