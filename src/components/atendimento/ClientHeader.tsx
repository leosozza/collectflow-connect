import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF, formatCurrency } from "@/lib/formatters";
import { Building, MessageCircle, Handshake, AlertTriangle, DollarSign, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useModules } from "@/hooks/useModules";
import { toast } from "sonner";

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
  const navigate = useNavigate();
  const { isModuleEnabled } = useModules();

  const initials = client.nome_completo.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  const statusBadge = (() => {
    const s = client.status;
    if (s === "pago") return { label: "Pago", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
    if (s === "pendente") return { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" };
    return { label: s || "—", className: "bg-muted text-muted-foreground" };
  })();

  const handleWhatsAppClick = () => {
    const phone = client.phone;
    if (!phone) { toast.error("Cliente não possui telefone cadastrado"); return; }
    const rawPhone = phone.replace(/\D/g, "");
    if (isModuleEnabled("whatsapp")) {
      navigate(`/contact-center/whatsapp?phone=${rawPhone}`);
    } else {
      window.open(`https://wa.me/55${rawPhone}`, "_blank");
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-4 flex-wrap">
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
        {initials}
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-base font-bold text-foreground truncate">{client.nome_completo}</h2>
          <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
        </div>
        <div className="flex items-center gap-x-3 mt-0.5 text-xs text-muted-foreground">
          <span>CPF: {formatCPF(client.cpf)}</span>
          <span className="flex items-center gap-1"><Building className="w-3 h-3" />{client.credor}</span>
        </div>
      </div>

      {/* Financial stats inline */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-center">
          <div className="flex items-center gap-1 text-destructive">
            <Wallet className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Em Aberto</span>
          </div>
          <p className="text-sm font-bold text-destructive">{formatCurrency(totalAberto)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1 text-emerald-600">
            <DollarSign className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Total Pago</span>
          </div>
          <p className="text-sm font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wider">Atraso</span>
          </div>
          <p className="text-sm font-bold text-amber-600">{diasAtraso > 0 ? `${diasAtraso}d` : "Em dia"}</p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          className="bg-emerald-500 hover:bg-emerald-600 text-white gap-1.5"
          onClick={handleWhatsAppClick}
        >
          <MessageCircle className="w-4 h-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/carteira/${client.cpf.replace(/\D/g, "")}?tab=acordo`)}
          className="gap-1.5"
        >
          <Handshake className="w-4 h-4" />
          <span className="hidden sm:inline">Formalizar Acordo</span>
        </Button>
      </div>
    </div>
  );
};

export default ClientHeader;
