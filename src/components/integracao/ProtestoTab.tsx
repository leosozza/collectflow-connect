import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, ShieldCheck } from "lucide-react";
import ProtestoConfigCard from "./protesto/ProtestoConfigCard";
import ProtestoTitleForm from "./protesto/ProtestoTitleForm";
import ProtestoBatchDialog from "./protesto/ProtestoBatchDialog";
import ProtestoTitlesList from "./protesto/ProtestoTitlesList";
import ProtestoLogsCard from "./protesto/ProtestoLogsCard";
import SerasaConfigCard from "./serasa/SerasaConfigCard";
import SerasaRecordForm from "./serasa/SerasaRecordForm";
import SerasaBatchDialog from "./serasa/SerasaBatchDialog";
import SerasaRecordsList from "./serasa/SerasaRecordsList";
import SerasaLogsCard from "./serasa/SerasaLogsCard";

const ProtestoTab = () => {
  const [protestoRefresh, setProtestoRefresh] = useState(0);
  const [serasaRefresh, setSerasaRefresh] = useState(0);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="cartorio">
        <TabsList>
          <TabsTrigger value="cartorio" className="gap-2">
            <Landmark className="w-4 h-4" />
            Cartório (Protesto)
          </TabsTrigger>
          <TabsTrigger value="serasa" className="gap-2">
            <ShieldCheck className="w-4 h-4" />
            Serasa
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cartorio" className="space-y-6 mt-4">
          <ProtestoConfigCard />
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Títulos a Protesto</h3>
            <ProtestoBatchDialog onCreated={() => setProtestoRefresh((k) => k + 1)} />
          </div>
          <ProtestoTitleForm onCreated={() => setProtestoRefresh((k) => k + 1)} />
          <ProtestoTitlesList refreshKey={protestoRefresh} />
          <ProtestoLogsCard refreshKey={protestoRefresh} />
        </TabsContent>

        <TabsContent value="serasa" className="space-y-6 mt-4">
          <SerasaConfigCard />
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Negativações Serasa</h3>
            <SerasaBatchDialog onCreated={() => setSerasaRefresh((k) => k + 1)} />
          </div>
          <SerasaRecordForm onCreated={() => setSerasaRefresh((k) => k + 1)} />
          <SerasaRecordsList refreshKey={serasaRefresh} />
          <SerasaLogsCard refreshKey={serasaRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProtestoTab;
