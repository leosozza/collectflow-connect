import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface DispositionTag {
  id: string;
  key: string;
  label: string;
  color: string;
  impact: string;
  active: boolean;
}

const TagsManagementTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const navigate = useNavigate();
  const [tags, setTags] = useState<DispositionTag[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const load = async () => {
      const { data } = await supabase
        .from("call_disposition_types")
        .select("id, key, label, color, impact, active")
        .eq("tenant_id", tenantId)
        .order("sort_order", { ascending: true });
      const filtered = (data || []).filter((d: any) => d.key?.startsWith("wa_") || (d as any).channel === "whatsapp");
      setTags(filtered as DispositionTag[]);
    };
    load();
  }, [tenantId]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="w-5 h-5" /> Etiquetas de Tabulação
        </h2>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => navigate("/cadastros/tabulacoes")}
        >
          <ExternalLink className="w-4 h-4" /> Gerenciar em Cadastros
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Tabulações de WhatsApp (somente leitura)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Impacto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    <span
                      className="w-5 h-5 rounded-full inline-block"
                      style={{ backgroundColor: tag.color }}
                    />
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tag.impact === "positivo" ? "default" : "secondary"}>
                      {tag.impact === "positivo" ? "Positivo" : "Negativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={tag.active ? "default" : "secondary"}>
                      {tag.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {tags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma tabulação WhatsApp configurada.
                    <br />
                    <Button
                      variant="link"
                      className="mt-2"
                      onClick={() => navigate("/cadastros/tabulacoes")}
                    >
                      Configurar em Cadastros → Tabulações de Atendimento
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default TagsManagementTab;
