import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, RefreshCw, Download, Ban, CreditCard, MinusCircle, Copy, Clock, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import { useState } from "react";

export interface RejectedRecord {
  nome?: string;
  cpf?: string;
  reason: string;
}

export interface UpdatedRecord {
  nome: string;
  cpf: string;
  changes: Record<string, { old: any; new: any }>;
}

export interface ImportReport {
  inserted: number;
  updated: UpdatedRecord[];
  rejected: RejectedRecord[];
  skipped: number;
  unchanged: number;
  paid: number;
  cancelledMaxlist: number;
  duplicatesDiscarded: number;
  totalFetched: number;
  durationMs: number;
  mode: "import" | "update";
  processingLogs?: string[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: ImportReport;
}

const fieldLabels: Record<string, string> = {
  nome_completo: "Nome",
  phone: "Telefone 1",
  phone2: "Telefone 2",
  phone3: "Telefone 3",
  valor_parcela: "Valor Parcela",
  valor_pago: "Valor Pago",
  valor_saldo: "Valor Saldo",
  status: "Status",
  data_vencimento: "Vencimento",
  data_pagamento: "Pagamento",
  status_cobranca_id: "Status Cobrança",
  cod_contrato: "Contrato",
  numero_parcela: "Nº Parcela",
  model_name: "Modelo",
  external_id: "ID Externo",
};

const ImportResultDialog = ({ open, onOpenChange, report }: Props) => {
  const isUpdate = report.mode === "update";

  const handleDownload = () => {
    const wb = XLSX.utils.book_new();

    if (report.rejected.length > 0) {
      const rejData = report.rejected.map((r) => ({
        Nome: r.nome || "-",
        CPF: r.cpf || "-",
        Motivo: r.reason,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rejData), "Rejeitados");
    }

    if (report.updated.length > 0) {
      const updData = report.updated.map((u) => ({
        Nome: u.nome,
        CPF: u.cpf,
        "Campos Alterados": Object.entries(u.changes)
          .map(([k, v]) => `${fieldLabels[k] || k}: ${v.old} → ${v.new}`)
          .join("; "),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(updData), "Atualizados");
    }

    // Summary sheet
    const summaryData = [
      { Métrica: "Total consultado", Valor: report.totalFetched },
      { Métrica: "Novos inseridos", Valor: report.inserted },
      { Métrica: "Atualizados", Valor: report.updated.length },
      { Métrica: "Pagos", Valor: report.paid },
      { Métrica: "Cancelados MaxList", Valor: report.cancelledMaxlist },
      { Métrica: "Sem alteração", Valor: report.unchanged },
      { Métrica: "Rejeitados", Valor: report.rejected.length },
      { Métrica: "Duplicidades descartadas", Valor: report.duplicatesDiscarded },
      { Métrica: "Erros", Valor: report.skipped },
      { Métrica: "Tempo (s)", Valor: Math.round(report.durationMs / 1000) },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), "Resumo");

    XLSX.writeFile(wb, `Relatorio_${isUpdate ? "Atualizacao" : "Importacao"}.xlsx`);
  };

  const total = report.totalFetched;
  const durationStr = report.durationMs > 0 ? `${Math.round(report.durationMs / 1000)}s` : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Resultado da Atualização" : "Resultado da Importação"}
          </DialogTitle>
        </DialogHeader>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-emerald-500/10 border-emerald-500/30 px-3 py-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-medium">{report.inserted} inseridos</span>
          </div>
          {(isUpdate || report.updated.length > 0) && (
            <div className="flex items-center gap-2 rounded-lg border bg-blue-500/10 border-blue-500/30 px-3 py-2">
              <RefreshCw className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium">{report.updated.length} atualizados</span>
            </div>
          )}
          {report.paid > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-green-500/10 border-green-500/30 px-3 py-2">
              <CreditCard className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">{report.paid} pagos</span>
            </div>
          )}
          {report.cancelledMaxlist > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-orange-500/10 border-orange-500/30 px-3 py-2">
              <Ban className="w-4 h-4 text-orange-500" />
              <span className="text-sm font-medium">{report.cancelledMaxlist} cancelados</span>
            </div>
          )}
          {report.unchanged > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted px-3 py-2">
              <MinusCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{report.unchanged} sem alteração</span>
            </div>
          )}
          {report.rejected.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-destructive/10 border-destructive/30 px-3 py-2">
              <XCircle className="w-4 h-4 text-destructive" />
              <span className="text-sm font-medium">{report.rejected.length} rejeitados</span>
            </div>
          )}
          {report.duplicatesDiscarded > 0 && (
            <div className="flex items-center gap-2 rounded-lg border bg-yellow-500/10 border-yellow-500/30 px-3 py-2">
              <Copy className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium">{report.duplicatesDiscarded} duplicidades</span>
            </div>
          )}
          {report.skipped > 0 && (
            <Badge variant="outline">{report.skipped} erros de lote</Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>Total consultado: {total.toLocaleString("pt-BR")} registros</span>
          {durationStr && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {durationStr}
            </span>
          )}
        </div>

        <Accordion type="multiple" className="w-full">
          {/* Inserted */}
          <AccordionItem value="inserted">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Inseridos ({report.inserted})
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <p className="text-sm text-muted-foreground">
                {report.inserted} novos registros foram inseridos com sucesso no sistema.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Updated */}
          {report.updated.length > 0 && (
            <AccordionItem value="updated">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-500" />
                  Atualizados ({report.updated.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="max-h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Alterações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.updated.map((u, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{u.nome}</TableCell>
                          <TableCell className="font-mono text-xs">{u.cpf}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {Object.entries(u.changes).map(([field, val]) => (
                                <div key={field} className="text-xs">
                                  <span className="font-medium">{fieldLabels[field] || field}:</span>{" "}
                                  <span className="text-destructive line-through">{String(val.old || "-")}</span>{" "}
                                  → <span className="text-emerald-600">{String(val.new || "-")}</span>
                                </div>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Rejected */}
          {report.rejected.length > 0 && (
            <AccordionItem value="rejected">
              <AccordionTrigger>
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  Rejeitados ({report.rejected.length})
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ScrollArea className="max-h-[250px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rejected.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-sm">{r.nome || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.cpf || "-"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">{r.reason}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <DialogFooter className="gap-2">
          {report.processingLogs && report.processingLogs.length > 0 && (
            <Button variant="outline" onClick={() => {
              const logText = report.processingLogs!.join("\n");
              const blob = new Blob([logText], { type: "text/plain" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `Logs_${isUpdate ? "Atualizacao" : "Importacao"}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}>
              <FileText className="w-4 h-4 mr-2" />
              Download Logs ({report.processingLogs.length})
            </Button>
          )}
          <Button variant="outline" onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download Relatório
          </Button>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportResultDialog;
