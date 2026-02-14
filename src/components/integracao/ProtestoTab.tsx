import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Landmark, ShieldCheck } from "lucide-react";
import ProtestoConfigCard from "./protesto/ProtestoConfigCard";
import ProtestoTitleForm from "./protesto/ProtestoTitleForm";
import ProtestoBatchDialog from "./protesto/ProtestoBatchDialog";
import ProtestoTitlesList from "./protesto/ProtestoTitlesList";
import ProtestoLogsCard from "./protesto/ProtestoLogsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SerasaTab = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <ShieldCheck className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg">Serasa Experian</CardTitle>
                <CardDescription>
                  Negativação de devedores via Serasa
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-muted-foreground">Em breve</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground space-y-2">
            <ShieldCheck className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-sm">
              A integração com o Serasa para negativação automática de devedores será disponibilizada em breve.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Você poderá enviar e remover negativações diretamente pelo sistema, com acompanhamento de status em tempo real.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const ProtestoTab = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

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
            <ProtestoBatchDialog onCreated={handleRefresh} />
          </div>

          <ProtestoTitleForm onCreated={handleRefresh} />
          <ProtestoTitlesList refreshKey={refreshKey} />
          <ProtestoLogsCard refreshKey={refreshKey} />
        </TabsContent>

        <TabsContent value="serasa" className="mt-4">
          <SerasaTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProtestoTab;
