import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { History } from "lucide-react";

const HistoryPanel = () => {
  return (
    <div className="mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Histórico de Envios</CardTitle>
              <CardDescription>
                Registro dos mailings enviados pelo sistema
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            O histórico de envios será exibido aqui conforme mailings forem enviados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default HistoryPanel;
