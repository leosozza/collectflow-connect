import { useNavigate } from "react-router-dom";
import { Agreement } from "@/services/agreementService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCPF } from "@/lib/formatters";

interface AgreementsListProps {
  agreements: Agreement[];
}

const statusColors: Record<string, string> = {
  pending: "bg-green-50 text-green-700 border border-green-300",
  pending_approval: "bg-blue-100 text-blue-800",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  overdue: "bg-amber-100 text-amber-800",
};

const statusLabels: Record<string, string> = {
  pending: "Acordo Vigente",
  pending_approval: "Aguardando Liberação",
  approved: "Pago",
  rejected: "Rejeitado",
  cancelled: "Cancelado",
  overdue: "Vencido",
};

const AgreementsList = ({ agreements }: AgreementsListProps) => {
  const navigate = useNavigate();

  if (agreements.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhum acordo encontrado.</p>;
  }

  const handleOpenProfile = (cpf: string) => {
    const rawCpf = cpf.replace(/\D/g, "");
    navigate(`/carteira/${rawCpf}?tab=acordo`);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead>Credor</TableHead>
            <TableHead>Operador</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {agreements.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <span
                  className="font-medium cursor-pointer text-primary hover:underline"
                  onClick={() => handleOpenProfile(a.client_cpf)}
                >
                  {a.client_name}
                </span>
              </TableCell>
              <TableCell>{formatCPF(a.client_cpf)}</TableCell>
              <TableCell>{a.credor}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {(a as any).creator_name || "—"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  <Badge className={statusColors[a.status] || ""}>{statusLabels[a.status] || a.status}</Badge>
                  {(a as any).boleto_pendente && (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-600">
                      Boleto pendente
                    </Badge>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default AgreementsList;
