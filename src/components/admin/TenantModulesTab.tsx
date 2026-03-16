import { useState, useEffect } from "react";
import { getSystemModules, getTenantModules, toggleModule, SystemModule } from "@/services/moduleService";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface TenantModulesTabProps {
  tenantId: string;
  tenantName: string;
}

const TenantModulesTab = ({ tenantId, tenantName }: TenantModulesTabProps) => {
  const { toast } = useToast();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [allModules, tenantMods] = await Promise.all([
        getSystemModules(),
        getTenantModules(tenantId),
      ]);
      setModules(allModules);
      const map: Record<string, boolean> = {};
      allModules.forEach((m) => {
        if (m.is_core) {
          map[m.id] = true;
        }
      });
      tenantMods.forEach((tm) => {
        map[tm.module_id] = tm.enabled;
      });
      setEnabledMap(map);
    } catch {
      toast({ title: "Erro ao carregar módulos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  const handleToggle = async (moduleId: string, enabled: boolean) => {
    setToggling(moduleId);
    try {
      await toggleModule(tenantId, moduleId, enabled);
      setEnabledMap((prev) => ({ ...prev, [moduleId]: enabled }));
      toast({ title: enabled ? "Módulo ativado" : "Módulo desativado" });
    } catch {
      toast({ title: "Erro ao alterar módulo", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const categoryLabels: Record<string, string> = {
    core: "Core",
    comunicacao: "Comunicação",
    produtividade: "Produtividade",
    negociacao: "Negociação",
    analytics: "Analytics",
    engajamento: "Engajamento",
    financeiro: "Financeiro",
    tecnico: "Técnico",
    ia: "Inteligência Artificial",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground mb-4">
          Gerenciando módulos para <strong>{tenantName}</strong>
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => {
              const enabled = enabledMap[m.id] ?? false;
              return (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{m.description || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {categoryLabels[m.category] || m.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={enabled ? "default" : "secondary"}>
                      {enabled ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={enabled}
                      disabled={m.is_core || toggling === m.id}
                      onCheckedChange={(v) => handleToggle(m.id, v)}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default TenantModulesTab;
