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
    phone2?: string | null;
    phone3?: string | null;
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

const ClickablePhone = ({ phone, onCall, callingPhone }: { phone: string; onCall?: (p: string) => void; callingPhone?: boolean }) => (
  <button
    onClick={() => onCall?.(phone)}
    disabled={callingPhone || !onCall}
    className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    title={`Ligar para ${formatPhone(phone)}`}
  >
    <Phone className="w-4 h-4 text-emerald-500" />
    <span>{callingPhone ? "Discando..." : formatPhone(phone)}</span>
  </button>
);

const ClientHeader = ({ client, totalAberto, totalPago, totalParcelas, parcelasPagas, onCall, callingPhone }: ClientHeaderProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const [statusCobranca, setStatusCobranca] = useState<{ nome: string; cor: string } | null>(null);

  useEffect(() => {
    if (!client.status_cobranca_id) { setStatusCobranca(null); return; }
    supabase.from("tipos_status").select("nome, cor").eq("id", client.status_cobranca_id).maybeSingle()
      .then(({ data }) => setStatusCobranca(data as { nome: string; cor: string } | null));
  }, [client.status_cobranca_id]);

  const phones = [client.phone, client.phone2, client.phone3].filter(Boolean) as string[];

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Row 1: Name + Status + Formalizar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-foreground">{client.nome_completo}</h2>
          {statusCobranca && (
            <Badge className="text-xs" style={{ backgroundColor: statusCobranca.cor, color: "#fff", border: "none" }}>
              {statusCobranca.nome}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => navigate(`/carteira/${client.cpf.replace(/\D/g, "")}?tab=acordo`)}
        >
          <Handshake className="w-4 h-4 mr-1" />
          Formalizar Acordo
        </Button>
      </div>

      {/* Row 2: CPF + Credor + Email + ID Externo */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {formatCPF(client.cpf)}</span>
        <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> {client.credor}</span>
        {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}
        {client.external_id && <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> {client.external_id}</span>}
      </div>

      {/* Row 3: Clickable phones */}
      {phones.length > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {phones.map((p) => (
            <ClickablePhone key={p} phone={p} onCall={onCall} callingPhone={callingPhone} />
          ))}
        </div>
      )}

      {/* Row 4: Debt data (always visible) */}
      <div className="border-t border-border pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-3 text-center">
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
        {client.data_vencimento && (
          <div>
            <p className="text-xs text-muted-foreground">Vencimento</p>
            <p className="text-sm font-semibold text-foreground">{new Date(client.data_vencimento).toLocaleDateString("pt-BR")}</p>
          </div>
        )}
        {client.valor_parcela != null && (
          <div>
            <p className="text-xs text-muted-foreground">Valor Parcela</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(client.valor_parcela)}</p>
          </div>
        )}
        {client.numero_parcela != null && client.total_parcelas != null && (
          <div>
            <p className="text-xs text-muted-foreground">Parcela Atual</p>
            <p className="text-sm font-semibold text-foreground">{client.numero_parcela} de {client.total_parcelas}</p>
          </div>
        )}
        {client.valor_entrada != null && client.valor_entrada > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Entrada</p>
            <p className="text-sm font-semibold text-foreground">{formatCurrency(client.valor_entrada)}</p>
          </div>
        )}
        {client.quebra != null && client.quebra > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Quebra</p>
            <p className="text-sm font-semibold text-destructive">{formatCurrency(client.quebra)}</p>
          </div>
        )}
      </div>

      {/* Collapsible: secondary data */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {open ? "Menos detalhes" : "Mais detalhes"}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 pt-3 border-t border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
            {(client.endereco || client.cidade || client.uf || client.cep) && (
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Endereço:</span>
                <span className="font-medium text-foreground">{[client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", ")}</span>
              </div>
            )}
          </div>
          {client.observacoes && (
            <div className="mt-3 pt-3 border-t border-border flex items-start gap-2 text-sm">
              <StickyNote className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div>
                <span className="text-muted-foreground">Observações: </span>
                <span className="text-foreground">{client.observacoes}</span>
              </div>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};

export default ClientHeader;
