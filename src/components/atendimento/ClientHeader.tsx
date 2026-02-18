import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { User, Phone, Mail, Building, Hash, ChevronDown, ChevronUp, Calendar, FileText, DollarSign, AlertTriangle, Layers, MapPin, StickyNote, Handshake } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

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
    valor_entrada?: number;
    valor_pago?: number;
    numero_parcela?: number;
    total_parcelas?: number;
    quebra?: number | null;
    status?: string;
    operator_id?: string | null;
    endereco?: string | null;
    cidade?: string | null;
    uf?: string | null;
    cep?: string | null;
    observacoes?: string | null;
    status_cobranca_id?: string | null;
  };
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
  onCall?: (phone: string) => void;
  callingPhone?: boolean;
}

const InfoItem = ({ icon: Icon, label, value, className }: { icon?: any; label: string; value: string | number; className?: string }) => (
  <div className="flex items-center gap-2 text-sm">
    {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-muted-foreground" />}
    <span className="text-muted-foreground">{label}:</span>
    <span className={`font-medium ${className || "text-foreground"}`}>{value}</span>
  </div>
);

const ClientHeader = ({ client, totalAberto, totalPago, totalParcelas, parcelasPagas, onCall, callingPhone }: ClientHeaderProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [statusCobranca, setStatusCobranca] = useState<{ nome: string; cor: string } | null>(null);

  useEffect(() => {
    if (!client.status_cobranca_id) {
      setStatusCobranca(null);
      return;
    }
    supabase
      .from("tipos_status")
      .select("nome, cor")
      .eq("id", client.status_cobranca_id)
      .maybeSingle()
      .then(({ data }) => {
        setStatusCobranca(data as { nome: string; cor: string } | null);
      });
  }, [client.status_cobranca_id]);

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-foreground">{client.nome_completo}</h2>
              {statusCobranca && (
                <Badge
                  className="text-xs"
                  style={{ backgroundColor: statusCobranca.cor, color: "#fff", border: "none" }}
                >
                  {statusCobranca.nome}
                </Badge>
              )}
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
          <div className="flex items-center gap-2">
            {onCall && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => client.phone && onCall(client.phone)}
                disabled={callingPhone || !client.phone}
                title={client.phone ? `Ligar para ${client.phone}` : "Sem telefone cadastrado"}
                className={`gap-1.5 ${client.phone ? "border-emerald-500/50 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950" : "opacity-50 cursor-not-allowed"}`}
              >
                <Phone className="w-4 h-4" />
                {callingPhone ? "Discando..." : "Ligar"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/carteira/${client.cpf.replace(/\D/g, "")}?tab=acordo`)}
            >
              <Handshake className="w-4 h-4 mr-1" />
              Formalizar Acordo
            </Button>
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

        <CollapsibleContent className="mt-4 pt-4 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3">
            {client.phone && (
              <InfoItem icon={Phone} label="Telefone" value={formatPhone(client.phone)} />
            )}
            {client.email && (
              <InfoItem icon={Mail} label="Email" value={client.email} />
            )}
            {client.external_id && (
              <InfoItem icon={Hash} label="ID Externo" value={client.external_id} />
            )}
            {client.data_vencimento && (
              <InfoItem icon={Calendar} label="Vencimento" value={new Date(client.data_vencimento).toLocaleDateString("pt-BR")} />
            )}
            {client.valor_parcela != null && (
              <InfoItem icon={FileText} label="Valor Parcela" value={formatCurrency(client.valor_parcela)} />
            )}
            {client.valor_entrada != null && client.valor_entrada > 0 && (
              <InfoItem icon={DollarSign} label="Valor Entrada" value={formatCurrency(client.valor_entrada)} />
            )}
            {client.valor_pago != null && (
              <InfoItem icon={DollarSign} label="Valor Pago" value={formatCurrency(client.valor_pago)} className="text-success" />
            )}
            {client.numero_parcela != null && client.total_parcelas != null && (
              <InfoItem icon={Layers} label="Parcela Atual" value={`${client.numero_parcela} de ${client.total_parcelas}`} />
            )}
            {client.quebra != null && client.quebra > 0 && (
              <InfoItem icon={AlertTriangle} label="Quebra" value={formatCurrency(client.quebra)} className="text-destructive" />
            )}
            {client.status && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className={`font-medium capitalize ${client.status === "pendente" ? "text-destructive" : client.status === "pago" ? "text-success" : "text-foreground"}`}>
                  {client.status}
                </span>
              </div>
            )}
            {(client.endereco || client.cidade || client.uf || client.cep) && (
              <InfoItem
                icon={MapPin}
                label="Endereço"
                value={[client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", ")}
              />
            )}
          </div>
          {client.observacoes && (
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2 text-sm">
                <StickyNote className="w-4 h-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                <div>
                  <span className="text-muted-foreground">Observações: </span>
                  <span className="text-foreground">{client.observacoes}</span>
                </div>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ClientHeader;
