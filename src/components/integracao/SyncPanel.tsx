import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2 } from "lucide-react";

interface SyncPanelProps {
  onSync: (message: string) => void;
}

const SyncPanel = ({ onSync }: SyncPanelProps) => {
  const { toast } = useToast();
  const [syncing, setSyncing] = useState(false);
  const [syncDate, setSyncDate] = useState(new Date().toISOString().split("T")[0]);

  const handleSyncToday = async () => {
    setSyncing(true);
    try {
      const result = await negociarieService.alteradasHoje();
      const count = Array.isArray(result) ? result.length : result?.total || 0;
      onSync(`${count} cobranças alteradas hoje sincronizadas`);
      toast({ title: "Sincronizado!", description: `${count} alterações encontradas` });
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncPagas = async () => {
    setSyncing(true);
    try {
      const result = await negociarieService.parcelasPagas(syncDate);
      const count = Array.isArray(result) ? result.length : result?.total || 0;
      onSync(`${count} parcelas pagas em ${syncDate}`);
      toast({ title: "Sincronizado!", description: `${count} parcelas pagas encontradas` });
    } catch (e: any) {
      toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5" />
          Sincronização
        </CardTitle>
        <CardDescription>Buscar atualizações da API Negociarie</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={handleSyncToday} disabled={syncing} variant="outline" className="w-full">
          {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Alteradas Hoje
        </Button>
        <div className="flex gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="sync-date">Pagas em</Label>
            <Input id="sync-date" type="date" value={syncDate} onChange={(e) => setSyncDate(e.target.value)} />
          </div>
          <Button onClick={handleSyncPagas} disabled={syncing} variant="outline" className="self-end">
            Buscar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SyncPanel;
