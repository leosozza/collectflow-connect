import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { User, Phone, Mail, Building, Hash, ChevronDown, ChevronUp, MapPin, StickyNote, Handshake, Tag, Pencil, MessageCircle } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
    if (!phone) {
      toast.error("Cliente não possui telefone cadastrado");
      return;
    }
    const rawPhone = phone.replace(/\D/g, "");
    if (isModuleEnabled("whatsapp")) {
      navigate(`/contact-center/whatsapp?phone=${rawPhone}`);
    } else {
      window.open(`https://wa.me/55${rawPhone}`, "_blank");
    }
  };

  const handleEditPhoneOpen = () => {
    setPhoneForm({
      phone: client.phone || "",
      phone2: client.phone2 || "",
      phone3: client.phone3 || "",
    });
    setEditPhoneOpen(true);
  };

  const handleSavePhones = async () => {
    setSavingPhone(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({
          phone: phoneForm.phone || null,
          phone2: phoneForm.phone2 || null,
          phone3: phoneForm.phone3 || null,
        })
        .eq("id", client.id);
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

  return (
    <div className="bg-card rounded-xl border border-border p-5 space-y-4">
      {/* Row 1: Name + Status + WhatsApp + Formalizar */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-xl font-bold text-foreground">{client.nome_completo}</h2>
          {statusCobranca && (
            <Badge className="text-xs" style={{ backgroundColor: statusCobranca.cor, color: "#fff", border: "none" }}>
              {statusCobranca.nome}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={handleWhatsAppClick}
            title="Abrir WhatsApp"
          >
            <MessageCircle className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/carteira/${client.cpf.replace(/\D/g, "")}?tab=acordo`)}
          >
            <Handshake className="w-4 h-4 mr-1" />
            Formalizar Acordo
          </Button>
        </div>
      </div>

      {/* Row 2: CPF + Credor + Email + ID Externo */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {formatCPF(client.cpf)}</span>
        <span className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5" /> {client.credor}</span>
        {client.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {client.email}</span>}
        {client.external_id && <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5" /> {client.external_id}</span>}
      </div>

      {/* Row 3: Clickable phones + edit pencil */}
      {phones.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          {phones.map((p) => (
            <ClickablePhone key={p} phone={p} onCall={onCall} callingPhone={callingPhone} />
          ))}
          <button
            onClick={handleEditPhoneOpen}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Editar telefones"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {phones.length === 0 && (
        <button
          onClick={handleEditPhoneOpen}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span>Adicionar telefone</span>
        </button>
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
          {/* Custom fields */}
          {(() => {
            const activeFields = customFields.filter(
              (f) => f.is_active && client.custom_data && client.custom_data[f.field_key] != null && client.custom_data[f.field_key] !== ""
            );
            if (activeFields.length === 0) return null;
            return (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-3 text-sm">
                  {activeFields.map((f) => {
                    const raw = client.custom_data![f.field_key];
                    const display = f.field_type === "boolean" ? (raw ? "Sim" : "Não") : String(raw);
                    return (
                      <div key={f.id} className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-muted-foreground" />
                        <span className="text-muted-foreground">{f.field_label}:</span>
                        <span className="font-medium text-foreground">{display}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
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

      {/* Edit phones dialog */}
      <Dialog open={editPhoneOpen} onOpenChange={setEditPhoneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Telefones</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Telefone 1 (principal)</Label>
              <Input
                value={phoneForm.phone}
                onChange={(e) => setPhoneForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>Telefone 2</Label>
              <Input
                value={phoneForm.phone2}
                onChange={(e) => setPhoneForm((prev) => ({ ...prev, phone2: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>Telefone 3</Label>
              <Input
                value={phoneForm.phone3}
                onChange={(e) => setPhoneForm((prev) => ({ ...prev, phone3: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPhoneOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePhones} disabled={savingPhone}>
              {savingPhone ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientHeader;
