import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone } from "lucide-react";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";

const TelefoniaTab = () => {
  return (
    <div className="mt-4">
      <Tabs defaultValue="threecplus">
        <TabsList>
          <TabsTrigger value="threecplus" className="gap-2">
            <Phone className="w-4 h-4" />
            3CPlus
          </TabsTrigger>
        </TabsList>
        <TabsContent value="threecplus">
          <ThreeCPlusPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TelefoniaTab;
