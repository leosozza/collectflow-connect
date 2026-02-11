import { useEffect, useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ExternalLink, Copy, Loader2, List } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CobrancasListProps {
  tenantId: string;
  refreshKey: number;
}

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-500/10 text-yellow-700 border-yellow-300",
  registrado: "bg-blue-500/10 text-blue-700 border-blue-300",
  pago: "bg-green-500/10 text-green-700 border-green-300",
  cancelado: "bg-red-500/10 text-red-700 border-red-300",
};

const CobrancasList = ({ tenantId, refreshKey }: CobrancasListProps) => {
  const { toast } = useToast();
  const [cobrancas, setCobrancas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCobrancas();
  }, [tenantId, refreshKey]);

  const loadCobrancas = async () => {
    setLoading(true);
    try {
      const data = await negociarieService.getCobrancas(tenantId);
      setCobrancas(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar cobranças:", e);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência` });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!cobrancas.length) return null;

  return (
    <TooltipProvider>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="w-5 h-5" />
            Cobranças Geradas ({cobrancas.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>ID Geral</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobrancas.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="capitalize font-medium">{c.tipo}</TableCell>
                    <TableCell className="font-mono text-xs">{c.id_geral}</TableCell>
                    <TableCell>R$ {Number(c.valor).toFixed(2)}</TableCell>
                    <TableCell>{new Date(c.data_vencimento).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[c.status] || ""}>
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {c.link_boleto && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" asChild>
                                <a href={c.link_boleto} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Abrir boleto</TooltipContent>
                          </Tooltip>
                        )}
                        {c.pix_copia_cola && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(c.pix_copia_cola, "Pix Copia e Cola")}>
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar Pix</TooltipContent>
                          </Tooltip>
                        )}
                        {c.link_cartao && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" asChild>
                                <a href={c.link_cartao} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Abrir link cartão</TooltipContent>
                          </Tooltip>
                        )}
                        {c.linha_digitavel && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => copyToClipboard(c.linha_digitavel, "Linha Digitável")}>
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar linha digitável</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default CobrancasList;
