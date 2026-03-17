import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatCPF, formatCurrency, formatPhone, formatDate, formatCEP } from "@/lib/formatters";
import { User, Building, ChevronDown, ChevronUp, Phone, Mail, MapPin, FileText, DollarSign, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenant } from "@/hooks/useTenant";
import { atendimentoFieldsService } from "@/services/atendimentoFieldsService";

interface ClientHeaderProps {
  client: any;
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
  diasAtraso: number;
  onCall?: (phone: string) => void;
  callingPhone?: boolean;
}

const InfoItem = ({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ElementType }) => {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 min-w-0">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground truncate">{value}</p>
      </div>
    </div>
  );
};

const FIELD_RENDERERS: Record<string, (client: any) => { label: string; value: string | null; icon?: React.ElementType }> = {
  phone: (c) => ({ label: "Telefone 1", value: c.phone ? formatPhone(c.phone) : null, icon: Phone }),
  phone2: (c) => ({ label: "Telefone 2", value: c.phone2 ? formatPhone(c.phone2) : null, icon: Phone }),
  phone3: (c) => ({ label: "Telefone 3", value: c.phone3 ? formatPhone(c.phone3) : null, icon: Phone }),
  email: (c) => ({ label: "E-mail", value: c.email, icon: Mail }),
  endereco: (c) => ({ label: "Endereço", value: c.endereco, icon: MapPin }),
  bairro: (c) => ({ label: "Bairro", value: c.bairro, icon: MapPin }),
  cidade: (c) => ({ label: "Cidade", value: c.cidade, icon: MapPin }),
  uf: (c) => ({ label: "UF", value: c.uf }),
  cep: (c) => ({ label: "CEP", value: c.cep ? formatCEP(c.cep) : null }),
  external_id: (c) => ({ label: "Cód. Devedor", value: c.external_id, icon: Tag }),
  cod_contrato: (c) => ({ label: "Cód. Contrato", value: c.cod_contrato, icon: FileText }),
  valor_saldo: (c) => ({ label: "Valor Saldo", value: c.valor_saldo != null ? formatCurrency(c.valor_saldo) : null, icon: DollarSign }),
  valor_atualizado: (c) => ({ label: "Valor Atualizado", value: c.valor_atualizado != null ? formatCurrency(c.valor_atualizado) : null, icon: DollarSign }),
  data_vencimento: (c) => ({ label: "Data Vencimento", value: c.data_vencimento ? formatDate(c.data_vencimento) : null }),
  tipo_devedor: (c) => ({ label: "Perfil Devedor", value: c.tipo_devedor_id || null }),
  tipo_divida: (c) => ({ label: "Tipo de Dívida", value: c.tipo_divida_id || null }),
  status_cobranca: (c) => ({ label: "Status Cobrança", value: c.status_cobranca_id || null }),
  observacoes: (c) => ({ label: "Observações", value: c.observacoes ? (c.observacoes.length > 80 ? c.observacoes.slice(0, 80) + "…" : c.observacoes) : null }),
};

const ClientHeader = ({ client, totalAberto, totalPago, diasAtraso }: ClientHeaderProps) => {
  const [expanded, setExpanded] = useState(false);
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const { data: fieldConfig } = useQuery({
    queryKey: ["atendimento-field-config", tenantId],
    queryFn: () => atendimentoFieldsService.fetchFieldConfig(tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  // If no config exists yet, show all fields; otherwise only visible ones
  const visibleFields = fieldConfig && fieldConfig.length > 0
    ? fieldConfig.filter((f) => f.visible).sort((a, b) => a.sort_order - b.sort_order)
    : Object.keys(FIELD_RENDERERS).map((key, i) => ({ field_key: key, sort_order: i }));

  const statusBadge = (() => {
    const s = client.status;
    if (s === "pago") return { label: "PAGO", className: "bg-emerald-500 text-white border-emerald-500" };
    if (s === "pendente") return { label: "PENDENTE", className: "bg-amber-500 text-white border-amber-500" };
    return { label: s?.toUpperCase() || "—", className: "bg-muted text-muted-foreground" };
  })();

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="bg-card rounded-xl border border-border">
        <div className="p-6 flex items-center gap-6 flex-wrap">
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

          {/* Financial stats */}
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

        {/* Expand trigger */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border-t border-border rounded-b-xl">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {expanded ? "Ocultar informações" : "Mais informações do devedor"}
          </button>
        </CollapsibleTrigger>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-6 pb-5 pt-3 border-t border-border">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
              {visibleFields.map((f) => {
                const renderer = FIELD_RENDERERS[f.field_key];
                if (!renderer) return null;
                const { label, value, icon } = renderer(client);
                if (!value) return null;
                return <InfoItem key={f.field_key} label={label} value={value} icon={icon} />;
              })}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

export default ClientHeader;
