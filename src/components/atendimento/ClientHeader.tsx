import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { User, Phone, Mail, Building, Hash } from "lucide-react";

interface ClientHeaderProps {
  client: {
    nome_completo: string;
    cpf: string;
    phone: string | null;
    email: string | null;
    credor: string;
    external_id?: string | null;
  };
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
}

const ClientHeader = ({ client, totalAberto, totalPago, totalParcelas, parcelasPagas }: ClientHeaderProps) => {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-foreground">{client.nome_completo}</h2>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" /> {formatCPF(client.cpf)}
            </span>
            {client.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {formatPhone(client.phone)}
              </span>
            )}
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {client.email}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5" /> {client.credor}
            </span>
            {client.external_id && (
              <span className="flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5" /> {client.external_id}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Em Aberto</p>
            <p className="text-lg font-bold text-destructive">{formatCurrency(totalAberto)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Pago</p>
            <p className="text-lg font-bold text-success">{formatCurrency(totalPago)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Parcelas</p>
            <p className="text-lg font-bold text-foreground">{parcelasPagas}/{totalParcelas}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientHeader;
