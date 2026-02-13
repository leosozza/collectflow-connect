import { useState } from "react";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { User, Phone, Mail, Building, Hash, ChevronDown, ChevronUp, Calendar, FileText } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

interface ClientHeaderProps {
  client: {
    nome_completo: string;
    cpf: string;
    phone: string | null;
    email: string | null;
    credor: string;
    external_id?: string | null;
    data_vencimento?: string;
    valor_parcela?: number;
    numero_parcela?: number;
    total_parcelas?: number;
    status?: string;
  };
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
}

const ClientHeader = ({ client, totalAberto, totalPago, totalParcelas, parcelasPagas }: ClientHeaderProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        {/* Always visible: name, CPF, credor + totals */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-foreground">{client.nome_completo}</h2>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> {formatCPF(client.cpf)}
              </span>
              <span className="flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5" /> {client.credor}
              </span>
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

        {/* Collapsible: full details */}
        <CollapsibleContent className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {client.phone && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-foreground">{formatPhone(client.phone)}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="font-medium text-foreground">{client.email}</span>
              </div>
            )}
            {client.external_id && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Hash className="w-4 h-4 flex-shrink-0" />
                <span className="text-muted-foreground">ID Externo:</span>
                <span className="font-medium text-foreground">{client.external_id}</span>
              </div>
            )}
            {client.data_vencimento && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span className="text-muted-foreground">Vencimento:</span>
                <span className="font-medium text-foreground">{new Date(client.data_vencimento).toLocaleDateString("pt-BR")}</span>
              </div>
            )}
            {client.valor_parcela != null && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="text-muted-foreground">Valor Parcela:</span>
                <span className="font-medium text-foreground">{formatCurrency(client.valor_parcela)}</span>
              </div>
            )}
            {client.status && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium capitalize ${client.status === "pendente" ? "text-destructive" : client.status === "pago" ? "text-success" : "text-foreground"}`}>
                  {client.status}
                </span>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ClientHeader;
