import { formatCPF, formatCurrency } from "@/lib/formatters";
import { User, Building } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ClientHeaderProps {
  client: {
    id: string;
    nome_completo: string;
    cpf: string;
    phone: string | null;
    credor: string;
    status?: string;
  };
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
  diasAtraso: number;
  onCall?: (phone: string) => void;
  callingPhone?: boolean;
}

const ClientHeader = ({ client, totalAberto, totalPago, diasAtraso }: ClientHeaderProps) => {
  const statusBadge = (() => {
    const s = client.status;
    if (s === "pago") return { label: "PAGO", className: "bg-emerald-500 text-white border-emerald-500" };
    if (s === "pendente") return { label: "PENDENTE", className: "bg-amber-500 text-white border-amber-500" };
    return { label: s?.toUpperCase() || "—", className: "bg-muted text-muted-foreground" };
  })();

  return (
    <div className="bg-card rounded-xl border border-border p-6 flex items-center gap-6 flex-wrap">
      {/* Avatar */}
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center shrink-0">
        <User className="w-6 h-6 text-muted-foreground" />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="text-lg font-bold text-foreground truncate">{client.nome_completo}</h2>
          <Badge className={`text-[10px] font-bold tracking-wider px-2.5 py-0.5 ${statusBadge.className}`}>
            {statusBadge.label}
          </Badge>
        </div>
        <div className="flex items-center gap-x-4 mt-1 text-sm text-muted-foreground">
          <span>CPF: {formatCPF(client.cpf)}</span>
          <span className="flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5" />
            Credor: {client.credor}
          </span>
        </div>
      </div>

      {/* Financial stats with vertical dividers */}
      <div className="flex items-center gap-0 shrink-0">
        <div className="text-center px-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-0.5">Em Aberto</p>
          <p className="text-base font-bold text-destructive">{formatCurrency(totalAberto)}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="text-center px-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-0.5">Total Pago</p>
          <p className="text-base font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="w-px h-10 bg-border" />
        <div className="text-center px-6">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-0.5">Atraso</p>
          <p className="text-base font-bold text-amber-600">{diasAtraso > 0 ? `${diasAtraso} Dias` : "Em dia"}</p>
        </div>
      </div>
    </div>
  );
};

export default ClientHeader;
