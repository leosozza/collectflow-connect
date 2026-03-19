import { useTenant } from "@/hooks/useTenant";
import { Card, CardContent } from "@/components/ui/card";
import { Tag, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const QualificationsPanel = () => {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const hasMap = !!settings.threecplus_disposition_map;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Tag className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Qualificações / Tabulações</h3>
      </div>

      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            As qualificações são gerenciadas de forma centralizada em <strong>Cadastros → Tabulações</strong>.
          </p>
          <p className="text-xs text-muted-foreground">
            Quando você cria ou edita uma tabulação no RIVO, ela é automaticamente sincronizada com o 3CPlus.
          </p>
          {hasMap && (
            <p className="text-xs text-emerald-600 font-medium">
              ✅ Sincronização ativa — {Object.keys(settings.threecplus_disposition_map).length} tabulações mapeadas
            </p>
          )}
          <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate("/cadastros?tab=tabulacoes")}>
            <ExternalLink className="w-4 h-4" />
            Ir para Tabulações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default QualificationsPanel;
