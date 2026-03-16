import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { Phone, Mail, Building, Hash, MapPin, Tag, Pencil, MessageCircle, Handshake, AlertTriangle, DollarSign, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { useModules } from "@/hooks/useModules";
import { fetchCustomFields, type CustomField } from "@/services/customFieldsService";
import { toast } from "sonner";

interface ClientHeaderProps {
  client: {
    id: string;
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
    custom_data?: Record<string, any> | null;
    tenant_id?: string | null;
  };
  totalAberto: number;
  totalPago: number;
  totalParcelas: number;
  parcelasPagas: number;
  diasAtraso: number;
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
    <Phone className="w-3.5 h-3.5 text-emerald-500" />
    <span>{callingPhone ? "Discando..." : formatPhone(phone)}</span>
  </button>
);

const ClientHeader = ({ client, totalAberto, totalPago, totalParcelas, parcelasPagas, diasAtraso, onCall, callingPhone }: ClientHeaderProps) => {
  const [editPhoneOpen, setEditPhoneOpen] = useState(false);
  const [phoneForm, setPhoneForm] = useState({ phone: "", phone2: "", phone3: "" });
  const [savingPhone, setSavingPhone] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusCobranca, setStatusCobranca] = useState<{ nome: string; cor: string } | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const { tenant } = useTenant();
  const { isModuleEnabled } = useModules();

  useEffect(() => {
    if (!client.status_cobranca_id) { setStatusCobranca(null); return; }
    supabase.from("tipos_status").select("nome, cor").eq("id", client.status_cobranca_id).maybeSingle()
      .then(({ data }) => setStatusCobranca(data as { nome: string; cor: string } | null));
  }, [client.status_cobranca_id]);

  useEffect(() => {
    const tid = client.tenant_id || tenant?.id;
    if (!tid) return;
    fetchCustomFields(tid).then(setCustomFields).catch(() => {});
  }, [client.tenant_id, tenant?.id]);

  const phones = [client.phone, client.phone2, client.phone3].filter(Boolean) as string[];

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

  const handleEditPhoneOpen = () => {
    setPhoneForm({ phone: client.phone || "", phone2: client.phone2 || "", phone3: client.phone3 || "" });
    setEditPhoneOpen(true);
  };

  const handleSavePhones = async () => {
    setSavingPhone(true);
    try {
      const { error } = await supabase.from("clients").update({
        phone: phoneForm.phone || null,
        phone2: phoneForm.phone2 || null,
        phone3: phoneForm.phone3 || null,
      }).eq("id", client.id);
      if (error) throw error;
      toast.success("Telefones atualizados");
      setEditPhoneOpen(false);
      queryClient.invalidateQueries({ queryKey: ["atendimento-client", client.id] });
    } catch {
      toast.error("Erro ao atualizar telefones");
    } finally {
      setSavingPhone(false);
    }
  };

  const initials = client.nome_completo.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase();

  const statusBadge = useMemo(() => {
    const s = client.status;
    if (s === "pago") return { label: "Pago", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200" };
    if (s === "pendente") return { label: "Pendente", className: "bg-amber-500/10 text-amber-600 border-amber-200" };
    return { label: s || "—", className: "bg-muted text-muted-foreground" };
  }, [client.status]);

  // Custom fields with values
  const activeCustomFields = customFields.filter(
    (f) => f.is_active && client.custom_data && client.custom_data[f.field_key] != null && client.custom_data[f.field_key] !== ""
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Main header row */}
      <div className="p-4 flex items-center gap-4 flex-wrap">
        {/* Avatar */}
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-lg flex items-center justify-center shrink-0">
          {initials}
        </div>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-foreground truncate">{client.nome_completo}</h2>
            <Badge variant="outline" className={statusBadge.className}>{statusBadge.label}</Badge>
            {statusCobranca && (
              <Badge className="text-xs" style={{ backgroundColor: statusCobranca.cor, color: "#fff", border: "none" }}>
                {statusCobranca.nome}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span>CPF: {formatCPF(client.cpf)}</span>
            <span className="flex items-center gap-1"><Building className="w-3 h-3" />{client.credor}</span>
            {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
            {client.external_id && <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{client.external_id}</span>}
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

      {/* Phones row */}
      <div className="px-4 pb-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
        {phones.map((p) => (
          <ClickablePhone key={p} phone={p} onCall={onCall} callingPhone={callingPhone} />
        ))}
        <button onClick={handleEditPhoneOpen} className="text-muted-foreground hover:text-foreground transition-colors" title="Editar telefones">
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {phones.length === 0 && (
          <button onClick={handleEditPhoneOpen} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" /> Adicionar telefone
          </button>
        )}
      </div>

      {/* Financial stat cards */}
      <div className="border-t border-border bg-muted/30 px-4 py-3 grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-destructive mb-1">
            <Wallet className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Em Aberto</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalAberto)}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-emerald-600 mb-1">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Total Pago</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalPago)}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-3 text-center">
          <div className="flex items-center justify-center gap-1.5 text-amber-600 mb-1">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Atraso</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{diasAtraso > 0 ? `${diasAtraso} Dias` : "Em dia"}</p>
        </div>
      </div>

      {/* Extra info (address, custom fields) — inline, no collapsible */}
      {(activeCustomFields.length > 0 || client.endereco || client.cidade) && (
        <div className="border-t border-border px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
          {(client.endereco || client.cidade || client.uf) && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {[client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", ")}
            </span>
          )}
          {activeCustomFields.map((f) => {
            const raw = client.custom_data![f.field_key];
            const display = f.field_type === "boolean" ? (raw ? "Sim" : "Não") : String(raw);
            return (
              <span key={f.id} className="flex items-center gap-1">
                <Tag className="w-3 h-3" /> {f.field_label}: <span className="font-medium text-foreground">{display}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Edit phones dialog */}
      <Dialog open={editPhoneOpen} onOpenChange={setEditPhoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Editar Telefones</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Telefone 1 (principal)</Label><Input value={phoneForm.phone} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="(11) 99999-9999" /></div>
            <div><Label>Telefone 2</Label><Input value={phoneForm.phone2} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone2: e.target.value }))} placeholder="(11) 99999-9999" /></div>
            <div><Label>Telefone 3</Label><Input value={phoneForm.phone3} onChange={(e) => setPhoneForm(prev => ({ ...prev, phone3: e.target.value }))} placeholder="(11) 99999-9999" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhoneOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePhones} disabled={savingPhone}>{savingPhone ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientHeader;
