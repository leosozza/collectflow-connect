import { useState } from "react";
import { addMonths, format, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, Download, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { createAsaasCustomer, createAsaasPayment, getAsaasPixQrCode } from "@/services/asaasService";
import { Agreement } from "@/services/agreementService";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface VirtualInstallment {
  number: number;
  label: string;
  value: number;
  dueDate: Date;
  status: "paid" | "pending" | "overdue";
}

interface Props {
  agreement: Agreement;
}

function generateInstallments(agreement: Agreement): VirtualInstallment[] {
  const items: VirtualInstallment[] = [];
  const today = startOfDay(new Date());
  let num = 1;

  // Entrada
  if (agreement.entrada_value && agreement.entrada_value > 0) {
    const entradaDate = agreement.entrada_date
      ? new Date(agreement.entrada_date + "T00:00:00")
      : new Date(agreement.first_due_date + "T00:00:00");
    items.push({
      number: num++,
      label: "Entrada",
      value: agreement.entrada_value,
      dueDate: entradaDate,
      status: isBefore(entradaDate, today) ? "overdue" : "pending",
    });
  }

  // Parcelas
  const firstDue = new Date(agreement.first_due_date + "T00:00:00");
  for (let i = 0; i < agreement.new_installments; i++) {
    const dueDate = addMonths(firstDue, i);
    items.push({
      number: num++,
      label: `Parcela ${i + 1}`,
      value: agreement.new_installment_value,
      dueDate,
      status: isBefore(dueDate, today) ? "overdue" : "pending",
    });
  }

  return items;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  pending: { label: "Pendente", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  overdue: { label: "Vencido", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

export default function AgreementInstallmentsPanel({ agreement }: Props) {
  const installments = generateInstallments(agreement);
  const [generatingBoleto, setGeneratingBoleto] = useState<number | null>(null);
  const [boletoUrls, setBoletoUrls] = useState<Record<number, string>>({});

  const handleGenerateBoleto = async (installment: VirtualInstallment) => {
    setGeneratingBoleto(installment.number);
    try {
      // 1. Create or find customer
      const customer = await createAsaasCustomer({
        name: agreement.client_name,
        cpfCnpj: agreement.client_cpf.replace(/\D/g, ""),
      });

      if (!customer?.id) {
        throw new Error("Erro ao criar cliente no gateway de pagamento");
      }

      // 2. Create payment (boleto)
      const payment = await createAsaasPayment({
        customer: customer.id,
        billingType: "BOLETO",
        value: installment.value,
        dueDate: format(installment.dueDate, "yyyy-MM-dd"),
        description: `${installment.label} - Acordo ${agreement.client_name} - ${agreement.credor}`,
      });

      if (payment?.bankSlipUrl) {
        setBoletoUrls(prev => ({ ...prev, [installment.number]: payment.bankSlipUrl }));
        toast.success("Boleto gerado com sucesso!");
      } else if (payment?.errors) {
        throw new Error(payment.errors[0]?.description || "Erro ao gerar boleto");
      } else {
        throw new Error("Resposta inesperada do gateway");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar boleto");
    } finally {
      setGeneratingBoleto(null);
    }
  };

  const totalValue = installments.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
        Parcelas ({installments.length})
      </h4>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs">#</TableHead>
              <TableHead className="text-xs">Descrição</TableHead>
              <TableHead className="text-xs">Vencimento</TableHead>
              <TableHead className="text-xs text-right">Valor</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs text-center">Boleto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {installments.map((inst) => {
              const cfg = statusConfig[inst.status];
              const url = boletoUrls[inst.number];
              return (
                <TableRow key={inst.number}>
                  <TableCell className="text-xs font-medium">{inst.number}</TableCell>
                  <TableCell className="text-xs">{inst.label}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(inst.dueDate, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-xs text-right font-medium">
                    R$ {inst.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={`text-[10px] ${cfg.className}`}>
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {url ? (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1">
                          <Download className="w-3 h-3" /> Baixar
                        </Button>
                      </a>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs gap-1"
                        disabled={generatingBoleto === inst.number || agreement.status === "cancelled"}
                        onClick={() => handleGenerateBoleto(inst)}
                      >
                        {generatingBoleto === inst.number ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        Gerar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end text-xs text-muted-foreground">
        Total: R$ {totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
      </div>
    </div>
  );
}
