import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { addMonths } from "date-fns";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, FileText } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface AgreementInstallmentsProps {
  agreementId: string;
  agreement: any;
  cpf: string;
}

const AgreementInstallments = ({ agreementId, agreement, cpf }: AgreementInstallmentsProps) => {
  // Check for linked negociarie cobrancas
  const { data: cobrancas = [] } = useQuery({
    queryKey: ["agreement-cobrancas", cpf, agreementId],
    queryFn: async () => {
      const rawCpf = cpf.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("negociarie_cobrancas" as any)
        .select("*")
        .or(`client_id.eq.${agreementId}`)
        .order("data_vencimento", { ascending: true });
      if (error) return [];
      return (data as any[]) || [];
    },
    enabled: !!agreementId,
  });

  // Generate virtual installments from agreement data
  const installments = [];
  for (let i = 0; i < agreement.new_installments; i++) {
    const dueDate = addMonths(new Date(agreement.first_due_date + "T00:00:00"), i);
    const cobranca = cobrancas.find((c: any) => {
      const cDate = new Date(c.data_vencimento);
      return cDate.getMonth() === dueDate.getMonth() && cDate.getFullYear() === dueDate.getFullYear();
    });
    installments.push({
      number: i + 1,
      dueDate,
      value: agreement.new_installment_value,
      cobranca,
    });
  }

  const handleDownloadBoleto = (url: string) => {
    window.open(url, "_blank");
  };

  const handleCopyPix = (pix: string) => {
    navigator.clipboard.writeText(pix);
  };

  return (
    <div className="pt-3 border-t border-border">
      <p className="text-xs text-muted-foreground uppercase font-medium mb-2 flex items-center gap-1">
        <FileText className="w-3 h-3" /> Parcelas do Acordo
      </p>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Parcela</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-center">Boleto</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {installments.map((inst) => {
            const isOverdue = inst.dueDate < new Date();
            const hasBoleto = inst.cobranca?.link_boleto;
            const hasPix = inst.cobranca?.pix_copia_cola;
            const status = inst.cobranca?.status || (isOverdue ? "vencido" : "pendente");

            return (
              <TableRow key={inst.number}>
                <TableCell>{inst.number}/{agreement.new_installments}</TableCell>
                <TableCell>{formatDate(inst.dueDate.toISOString().split("T")[0])}</TableCell>
                <TableCell className="text-right">{formatCurrency(Number(inst.value))}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className={
                    status === "pago" ? "bg-green-500/10 text-green-600 border-green-500/30" :
                    isOverdue ? "bg-destructive/10 text-destructive border-destructive/30" :
                    "bg-warning/10 text-warning border-warning/30"
                  }>
                    {status === "pago" ? "Pago" : isOverdue ? "Vencido" : "Em Aberto"}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    {hasBoleto ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs"
                        onClick={() => handleDownloadBoleto(inst.cobranca.link_boleto)}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Boleto
                      </Button>
                    ) : hasPix ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1 text-xs"
                        onClick={() => handleCopyPix(inst.cobranca.pix_copia_cola)}
                      >
                        Copiar PIX
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default AgreementInstallments;
