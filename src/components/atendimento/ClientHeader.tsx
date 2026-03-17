import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { formatCPF, formatCurrency, formatPhone, formatDate, formatCEP } from "@/lib/formatters";
import { User, Building, ChevronDown, ChevronUp, Phone, Mail, MapPin, FileText, DollarSign, Tag, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTenant } from "@/hooks/useTenant";
import { useModules } from "@/hooks/useModules";
import { atendimentoFieldsService } from "@/services/atendimentoFieldsService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ClientHeaderProps {
  client: any;
  clientRecords?: any[];
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
  diasAtraso: number;
  onCall?: (phone: string) => void;
  callingPhone?: boolean;
  onNegotiate?: () => void;
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

const ClientHeader = ({ client, clientRecords = [], totalAberto, totalPago, diasAtraso, onNegotiate }: ClientHeaderProps) => {
  const [expanded, setExpanded] = useState(false);
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const navigate = useNavigate();
  const { isModuleEnabled } = useModules();

  const openWhatsApp = () => {
    if (!client.phone) {
      toast({ title: "Cliente sem telefone cadastrado", variant: "destructive" });
      return;
    }
    const cleanPhone = client.phone.replace(/\D/g, "");
    if (isModuleEnabled("whatsapp")) {
      navigate(`/contact-center/whatsapp?phone=${cleanPhone}`);
    } else {
      window.open(`https://wa.me/55${cleanPhone}`, "_blank");
    }
  };

  // Resolve credor_id from credor name
  const { data: credorData } = useQuery({
    queryKey: ["credor-by-name", tenantId, client?.credor],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("id")
        .eq("tenant_id", tenantId!)
        .eq("razao_social", client.credor)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tenantId && !!client?.credor,
    staleTime: 10 * 60 * 1000,
  });

  const credorId = credorData?.id;

  const { data: fieldConfig } = useQuery({
    queryKey: ["atendimento-field-config", credorId],
    queryFn: () => atendimentoFieldsService.fetchFieldConfig(credorId!),
    enabled: !!credorId,
    staleTime: 5 * 60 * 1000,
  });

  // Resolve lookup names for UUID fields
  const { data: tipoDevedorName } = useQuery({
    queryKey: ["tipo-devedor-name", client?.tipo_devedor_id],
    queryFn: async () => {
      if (!client?.tipo_devedor_id) return null;
      const { data } = await supabase.from("tipos_devedor").select("nome").eq("id", client.tipo_devedor_id).maybeSingle();
      return data?.nome || null;
    },
    enabled: !!client?.tipo_devedor_id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: tipoDividaName } = useQuery({
    queryKey: ["tipo-divida-name", client?.tipo_divida_id],
    queryFn: async () => {
      if (!client?.tipo_divida_id) return null;
      const { data } = await supabase.from("tipos_divida").select("nome").eq("id", client.tipo_divida_id).maybeSingle();
      return data?.nome || null;
    },
    enabled: !!client?.tipo_divida_id,
    staleTime: 10 * 60 * 1000,
  });

  const { data: statusCobrancaName } = useQuery({
    queryKey: ["status-cobranca-name", client?.status_cobranca_id],
    queryFn: async () => {
      if (!client?.status_cobranca_id) return null;
      const { data } = await supabase.from("tipos_status").select("nome").eq("id", client.status_cobranca_id).maybeSingle();
      return data?.nome || null;
    },
    enabled: !!client?.status_cobranca_id,
    staleTime: 10 * 60 * 1000,
  });

  const FIELD_RENDERERS: Record<string, () => { label: string; value: string | null; icon?: React.ElementType }> = {
    phone: () => ({ label: "Telefone 1", value: client.phone ? formatPhone(client.phone) : null, icon: Phone }),
    phone2: () => ({ label: "Telefone 2", value: client.phone2 ? formatPhone(client.phone2) : null, icon: Phone }),
    phone3: () => ({ label: "Telefone 3", value: client.phone3 ? formatPhone(client.phone3) : null, icon: Phone }),
    email: () => ({ label: "E-mail", value: client.email, icon: Mail }),
    endereco: () => ({ label: "Endereço", value: client.endereco, icon: MapPin }),
    bairro: () => ({ label: "Bairro", value: client.bairro, icon: MapPin }),
    cidade: () => ({ label: "Cidade", value: client.cidade, icon: MapPin }),
    uf: () => ({ label: "UF", value: client.uf }),
    cep: () => ({ label: "CEP", value: client.cep ? formatCEP(client.cep) : null }),
    external_id: () => ({ label: "Cód. Devedor", value: client.external_id, icon: Tag }),
    cod_contrato: () => ({ label: "Cód. Contrato", value: client.cod_contrato, icon: FileText }),
    valor_saldo: () => {
      const records = clientRecords.length > 0 ? clientRecords : [client];
      const pending = records.filter((r) => r.status === "pendente");
      const total = pending.reduce((sum, r) => sum + (Number(r.valor_saldo) || 0), 0);
      return { label: "Valor Saldo", value: total > 0 ? formatCurrency(total) : null, icon: DollarSign };
    },
    valor_atualizado: () => {
      const records = clientRecords.length > 0 ? clientRecords : [client];
      const pending = records.filter((r) => r.status === "pendente");
      const total = pending.reduce((sum, r) => sum + (Number(r.valor_atualizado) || 0), 0);
      return { label: "Valor Atualizado", value: total > 0 ? formatCurrency(total) : null, icon: DollarSign };
    },
    data_vencimento: () => ({ label: "Data Vencimento", value: client.data_vencimento ? formatDate(client.data_vencimento) : null }),
    tipo_devedor: () => ({ label: "Perfil Devedor", value: tipoDevedorName || null }),
    tipo_divida: () => ({ label: "Tipo de Dívida", value: tipoDividaName || null }),
    status_cobranca: () => ({ label: "Status Cobrança", value: statusCobrancaName || null }),
    observacoes: () => ({ label: "Observações", value: client.observacoes ? (client.observacoes.length > 80 ? client.observacoes.slice(0, 80) + "…" : client.observacoes) : null }),
  };

  const ALL_FIELD_KEYS = Object.keys(FIELD_RENDERERS);

  // If config exists for this credor, use it; otherwise show all fields
  const visibleFields = fieldConfig && fieldConfig.length > 0
    ? fieldConfig.filter((f) => f.visible).sort((a, b) => a.sort_order - b.sort_order)
    : ALL_FIELD_KEYS.map((key, i) => ({ field_key: key, sort_order: i }));

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

        {/* Centered action buttons */}
        <div className="flex items-center justify-center gap-3 pb-4">
          <Button
            onClick={openWhatsApp}
            className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-10 w-10 p-0"
            title="Abrir WhatsApp"
          >
            <MessageCircle className="w-5 h-5 fill-white" />
          </Button>
          {onNegotiate && (
            <Button
              onClick={onNegotiate}
              size="lg"
              className="gap-2 font-bold text-base px-8"
            >
              <Handshake className="w-5 h-5" />
              FORMALIZAR ACORDO
            </Button>
          )}
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
          <div className="px-6 pb-5 pt-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
              {visibleFields.map((f) => {
                const renderer = FIELD_RENDERERS[f.field_key];
                if (!renderer) return null;
                const { label, value, icon } = renderer();
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
