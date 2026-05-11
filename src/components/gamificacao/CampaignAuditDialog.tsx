import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  Campaign,
  METRIC_OPTIONS,
  fetchCampaignAuditDetails,
} from "@/services/campaignService";

interface Props {
  campaign: Campaign;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return iso;
  }
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

const isCountMetric = (m: string) => m === "maior_qtd_acordos";

export default function CampaignAuditDialog({ campaign, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["campaign-audit", campaign.id],
    queryFn: () => fetchCampaignAuditDetails(campaign.id),
    enabled: open,
    staleTime: 30_000,
  });

  const metricLabel = METRIC_OPTIONS.find((m) => m.value === campaign.metric)?.label || campaign.metric;
  const countMetric = isCountMetric(campaign.metric);
  const fmtValue = (v: number) => (countMetric ? String(v) : fmtCurrency(v));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Conferência — {campaign.title}</DialogTitle>
          <DialogDescription>
            Detalhamento dos itens que compõem o ranking de cada participante.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{metricLabel}</Badge>
          <Badge variant="outline">
            {fmtDate(campaign.start_date)} → {fmtDate(campaign.end_date)}
          </Badge>
          {campaign.credores?.map((c) => (
            <Badge key={c.credor_id} variant="secondary" className="text-[10px]">
              {c.razao_social || "Credor"}
            </Badge>
          ))}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-10 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando conferência…
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">
            Erro ao carregar conferência.
          </div>
        )}

        {data && data.operators.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum participante encontrado.
          </p>
        )}

        {data && data.operators.length > 0 && (
          <Accordion type="multiple" className="w-full">
            {data.operators.map((op) => {
              const diverges = Math.abs(op.persisted_score - op.computed_total) > 0.01;
              return (
                <AccordionItem value={op.operator_id} key={op.operator_id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center justify-between gap-3 w-full pr-2">
                      <span className="font-medium text-sm">{op.operator_name}</span>
                      <div className="flex items-center gap-2">
                        {diverges && (
                          <Badge variant="outline" className="gap-1 text-[10px] border-amber-500/40 text-amber-600">
                            <AlertTriangle className="w-3 h-3" />
                            Ranking desatualizado
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Ranking: <strong className="text-foreground">{fmtValue(op.persisted_score)}</strong>
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Conferido: <strong className="text-foreground">{fmtValue(op.computed_total)}</strong>
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {op.rows.length} {op.rows.length === 1 ? "item" : "itens"}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    {op.rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">
                        Sem itens neste período.
                      </p>
                    ) : (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[100px]">Data</TableHead>
                              <TableHead>Cliente</TableHead>
                              <TableHead className="w-[120px]">CPF</TableHead>
                              <TableHead>Credor</TableHead>
                              <TableHead className="w-[110px]">Origem</TableHead>
                              <TableHead className="text-right w-[120px]">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {op.rows.map((r, idx) => (
                              <TableRow key={idx}>
                                <TableCell className="text-xs">{fmtDate(r.date)}</TableCell>
                                <TableCell className="text-xs">{r.client_name || "—"}</TableCell>
                                <TableCell className="text-xs">{r.client_cpf || "—"}</TableCell>
                                <TableCell className="text-xs">{r.credor || "—"}</TableCell>
                                <TableCell className="text-xs">
                                  <Badge variant="outline" className="text-[10px]">{r.source}</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-right font-medium">
                                  {fmtValue(r.value)}
                                </TableCell>
                              </TableRow>
                            ))}
                            <TableRow className="bg-muted/40">
                              <TableCell colSpan={5} className="text-xs font-semibold text-right">
                                Total
                              </TableCell>
                              <TableCell className="text-xs font-bold text-right">
                                {fmtValue(op.computed_total)}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
}
