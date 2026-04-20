import { useState, useMemo, useCallback } from "react";
import { upsertClientProfile } from "@/services/clientProfileService";
import { Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Phone as PhoneIcon, MessageCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Headset, ChevronDown, Pencil, Flame } from "lucide-react";
import { promotePhoneToHot, type PhoneSlot } from "@/services/clientPhoneService";
import { Button } from "@/components/ui/button";
import { PrimaryFlowButton } from "@/components/ui/flow-button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCPF, formatCurrency, formatPhone, formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { useModules } from "@/hooks/useModules";
import { fetchTiposDevedor, fetchTiposDivida, fetchTiposStatus } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";
import { differenceInMonths } from "date-fns";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PhoneList from "./PhoneList";
import { CraftButton, CraftButtonLabel, CraftButtonIcon } from "@/components/ui/craft-button";
import EmailList from "./EmailList";
import InlineEditableField from "./InlineEditableField";
import StartWhatsAppConversationDialog from "./StartWhatsAppConversationDialog";

interface ClientDetailHeaderProps {
  client: any;
  clients: any[];
  cpf: string;
  agreements: any[];
  onFormalizarAcordo: () => void;
  backTo?: string;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const InfoItem = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={className}>
    <p className="text-xs text-muted-foreground uppercase font-medium mb-1">{label}</p>
    <p className="text-sm font-semibold text-foreground">{value || "—"}</p>
  </div>
);

const ClientDetailHeader = ({ client, clients, cpf, agreements, onFormalizarAcordo, backTo }: ClientDetailHeaderProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const { isModuleEnabled } = useModules();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [editForm, setEditForm] = useState({
    nome_completo: client.nome_completo || "",
    phone: client.phone || "",
    phone2: client.phone2 || "",
    phone3: client.phone3 || "",
    email: client.email || "",
    endereco: client.endereco || "",
    bairro: client.bairro || "",
    cidade: client.cidade || "",
    uf: client.uf || "",
    cep: client.cep || "",
    cod_contrato: client.cod_contrato || "",
    observacoes: client.observacoes || "",
    external_id: client.external_id || "",
  });
  const formattedCpf = formatCPF(cpf || "");
  const [promotingSlot, setPromotingSlot] = useState<PhoneSlot | null>(null);
  const [waDialogOpen, setWaDialogOpen] = useState(false);

  const handlePromoteHot = async (slot: PhoneSlot) => {
    if (slot === "phone" || !tenant?.id || !client?.cpf || !client?.credor) return;
    setPromotingSlot(slot);
    try {
      const { newHot } = await promotePhoneToHot({
        cpf: client.cpf,
        credor: client.credor,
        tenantId: tenant.id,
        slotOrigem: slot,
      });
      toast.success("Número quente atualizado", {
        description: newHot ? `${formatPhone(newHot)} agora é o Telefone 1.` : undefined,
      });
      await queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error("Erro ao atualizar número quente", { description: e?.message });
    } finally {
      setPromotingSlot(null);
    }
  };

  const HotBadge = ({ slot }: { slot: PhoneSlot }) => {
    if (slot === "phone") {
      if (!client.phone) return null;
      return (
        <span title="Número quente (Hot)" className="inline-flex">
          <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500/30" />
        </span>
      );
    }
    const targetValue = slot === "phone2" ? client.phone2 : client.phone3;
    if (!targetValue) return null;
    return (
      <button
        type="button"
        onClick={() => handlePromoteHot(slot)}
        disabled={promotingSlot !== null}
        title="Marcar como número quente"
        className="inline-flex items-center justify-center rounded p-0.5 hover:bg-muted transition-colors disabled:opacity-40"
      >
        <Flame className={`w-3.5 h-3.5 ${promotingSlot === slot ? "text-orange-500 animate-pulse" : "text-muted-foreground hover:text-orange-500"}`} />
      </button>
    );
  };

  const PhoneInfo = ({ label, slot, value }: { label: string; slot: PhoneSlot; value: string | null }) => (
    <div>
      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">{label}</p>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-foreground">{value ? formatPhone(value) : "—"}</p>
        <HotBadge slot={slot} />
      </div>
    </div>
  );

  const runCepLookup = useCallback(async (cepValue: string) => {
    const digits = (cepValue || "").replace(/\D/g, "");
    if (digits.length !== 8) return;
    setFetchingCep(true);
    try {
      const { lookupCepDetailed } = await import("@/lib/viaCep");
      const res = await lookupCepDetailed(digits);
      if (res.ok) {
        setEditForm(f => ({
          ...f,
          endereco: res.data.logradouro || f.endereco,
          bairro: res.data.bairro || f.bairro,
          cidade: res.data.localidade || f.cidade,
          uf: res.data.uf || f.uf,
        }));
      } else {
        if (res.reason === "not_found") toast.error("CEP não encontrado");
        else if (res.reason === "network") toast.error("Falha ao consultar CEP");
      }
    } finally {
      setFetchingCep(false);
    }
  }, []);

  const handleCepBlur = useCallback(() => {
    runCepLookup(editForm.cep);
  }, [editForm.cep, runCepLookup]);

  const { data: tiposDevedor = [] } = useQuery({
    queryKey: ["tipos_devedor", tenant?.id],
    queryFn: () => fetchTiposDevedor(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposDivida = [] } = useQuery({
    queryKey: ["tipos_divida", tenant?.id],
    queryFn: () => fetchTiposDivida(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: tiposStatus = [] } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  const cleanCpf = cpf?.replace(/\D/g, "") || "";
  const { data: allClientPhones = [] } = useQuery({
    queryKey: ["client_phones", tenant?.id, cleanCpf],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_phones")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("cpf", cleanCpf)
        .order("priority", { ascending: true });
      return data || [];
    },
    enabled: !!tenant?.id && !!cleanCpf,
  });

  const updatePerfilMutation = useMutation({
    mutationFn: async (tipoDevedorId: string | null) => {
      const clientIds = clients.map(c => c.id);
      for (const id of clientIds) {
        const { error } = await supabase.from("clients").update({ tipo_devedor_id: tipoDevedorId } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Perfil do devedor atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const cepDigits = (data.cep || "").replace(/\D/g, "");
      const normalizedCep = cepDigits.length === 8
        ? `${cepDigits.slice(0, 5)}-${cepDigits.slice(5)}`
        : data.cep || null;
      const normalizedUf = (data.uf || "").trim().toUpperCase() || null;

      const sharedData = {
        nome_completo: data.nome_completo,
        phone: data.phone || null,
        phone2: data.phone2 || null,
        phone3: data.phone3 || null,
        email: data.email || null,
        endereco: (data.endereco || "").trim() || null,
        bairro: (data.bairro || "").trim() || null,
        cidade: (data.cidade || "").trim() || null,
        uf: normalizedUf,
        cep: normalizedCep,
        observacoes: data.observacoes || null,
      };

      const clientIds = clients.map(c => c.id);
      for (const id of clientIds) {
        const { error } = await supabase.from("clients").update(sharedData as any).eq("id", id);
        if (error) throw error;
      }

      // Campos com constraint unique: atualizar apenas no registro principal
      const { error: uniqueError } = await supabase.from("clients").update({
        cod_contrato: data.cod_contrato || null,
        external_id: data.external_id || null,
      } as any).eq("id", clientIds[0]);
      if (uniqueError) throw uniqueError;

      // Sync to canonical client_profiles
      if (tenant?.id) {
        const cleanCpfVal = cpf?.replace(/\D/g, "") || "";
        if (cleanCpfVal) {
          await upsertClientProfile(tenant.id, cleanCpfVal, {
            nome_completo: data.nome_completo,
            phone: data.phone || "",
            phone2: data.phone2 || "",
            phone3: data.phone3 || "",
            email: data.email || "",
            endereco: (data.endereco || "").trim(),
            bairro: (data.bairro || "").trim(),
            cidade: (data.cidade || "").trim(),
            uf: (normalizedUf || ""),
            cep: normalizedCep || "",
          }, "manual");
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dados do devedor atualizados!");
      setEditOpen(false);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar dados"),
  });

  const SHARED_FIELDS = new Set(["endereco", "bairro", "cidade", "uf", "cep", "phone", "phone2", "phone3", "email", "nome_completo", "observacoes"]);
  const PROFILE_FIELD_MAP: Record<string, string> = {
    endereco: "endereco", bairro: "bairro", cidade: "cidade", uf: "uf", cep: "cep",
    phone: "phone", phone2: "phone2", phone3: "phone3", email: "email", nome_completo: "nome_completo",
  };

  const updateSingleField = async (field: string, rawValue: string) => {
    let value: string | null = rawValue.trim() || null;
    if (field === "cep" && value) {
      const digits = value.replace(/\D/g, "");
      if (digits.length === 8) value = `${digits.slice(0, 5)}-${digits.slice(5)}`;
    }
    if (field === "uf" && value) value = value.toUpperCase();

    try {
      const clientIds = clients.map(c => c.id);
      const targetIds = SHARED_FIELDS.has(field) ? clientIds : [clientIds[0]];
      for (const id of targetIds) {
        const { error } = await supabase.from("clients").update({ [field]: value } as any).eq("id", id);
        if (error) throw error;
      }
      // Sync profile if applicable
      if (tenant?.id && PROFILE_FIELD_MAP[field]) {
        const cleanCpfVal = cpf?.replace(/\D/g, "") || "";
        if (cleanCpfVal) {
          await upsertClientProfile(tenant.id, cleanCpfVal, { [PROFILE_FIELD_MAP[field]]: value || "" } as any, "manual_inline");
        }
      }
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Campo atualizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao atualizar campo");
      throw e;
    }
  };

  const openWhatsApp = (phoneNumber?: string) => {
    const rawPhone = phoneNumber || client.phone;
    if (!rawPhone && !allClientPhones.length) {
      toast.error("Nenhum telefone cadastrado para este devedor");
      return;
    }
    if (isModuleEnabled("whatsapp")) {
      // Abre o diálogo para escolher telefone + instância
      setWaDialogOpen(true);
    } else {
      const phone = (rawPhone || "").replace(/\D/g, "");
      const intlPhone = phone.startsWith("55") ? phone : `55${phone}`;
      window.open(`https://wa.me/${intlPhone}`, "_blank");
    }
  };

  // Total Pago: somente parcelas efetivamente pagas (exclui cheque devolvido) + acordos aprovados
  const totalPagoRecords = clients.reduce((sum, c) => {
    const isDevolvido = !!(c as any).data_devolucao;
    if (isDevolvido) return sum;
    return sum + Number(c.valor_pago);
  }, 0);
  const totalPagoAcordos = (agreements || [])
    .filter((a: any) => a.status === "approved")
    .reduce((sum: number, a: any) => sum + Number(a.proposed_total), 0);
  const totalPago = totalPagoRecords + totalPagoAcordos;
  
  const pagas = clients.filter((c) => c.status === "pago" && !(c as any).data_devolucao).length;
  const endereco = [client.endereco, client.bairro, client.cidade, client.uf, client.cep].filter(Boolean).join(", ");

  // Aggregate multi-contract values
  const modelNames = [...new Set(clients.map(c => c.model_name).filter(Boolean))].join(" / ") || "—";
  const codContratos = [...new Set(clients.map(c => c.cod_contrato).filter(Boolean))].join(" / ") || "—";

  // Saldo Devedor: parcelas não-pagas (inclui devolvidas com valor cheio)
  const naoPageos = clients.filter(c => c.status !== "pago" || !!(c as any).data_devolucao);
  const totalSaldo = naoPageos.reduce((sum, c) => {
    const isDevolvido = !!(c as any).data_devolucao;
    const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
    const pago = isDevolvido ? 0 : Number(c.valor_pago) || 0;
    return sum + Math.max(0, valorBase - pago);
  }, 0);

  // Fetch credor rules for dynamic interest calculation
  const credorName = client.credor;
  const { data: credorData } = useQuery({
    queryKey: ["credor_rules_header", tenant?.id, credorName],
    queryFn: async () => {
      if (!tenant?.id || !credorName) return null;
      const { data } = await supabase
        .from("credores")
        .select("juros_mes, multa, razao_social, nome_fantasia")
        .eq("tenant_id", tenant.id);
      if (!data) return null;
      const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
      const credorNorm = normalize(credorName);
      return data.find(c =>
        normalize(c.razao_social) === credorNorm ||
        (c.nome_fantasia && normalize(c.nome_fantasia) === credorNorm)
      ) || null;
    },
    enabled: !!tenant?.id && !!credorName,
  });

  // Calculate valor atualizado dynamically using credor rules
  const totalAtualizado = useMemo(() => {
    const jurosMes = Number(credorData?.juros_mes) || 0;
    const multa = Number(credorData?.multa) || 0;
    const today = new Date();

    return naoPageos.reduce((sum, c) => {
      const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
      const vencimento = new Date(c.data_vencimento);
      if (vencimento >= today || (jurosMes === 0 && multa === 0)) {
        return sum + valorBase;
      }
      const meses = Math.max(1, differenceInMonths(today, vencimento));
      const comMulta = valorBase * (multa / 100);
      const comJuros = valorBase * (jurosMes / 100) * meses;
      return sum + valorBase + comMulta + comJuros;
    }, 0);
  }, [naoPageos, credorData]);

  // Em Aberto: soma direta por parcela elegível (pendente, vencido, em_acordo, devolvido)
  const totalAberto = clients.reduce((sum, c) => {
    const isDevolvido = !!(c as any).data_devolucao;
    const isPago = c.status === "pago" && !isDevolvido;
    const isCancelado = c.status === "cancelado_maxlist" || c.status === "quebrado";
    if (isPago || isCancelado) return sum;
    const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
    const pago = isDevolvido ? 0 : Number(c.valor_pago) || 0;
    return sum + Math.max(0, valorBase - pago);
  }, 0);

  // Tipo de Dívida agregado: moda dos clients (evita usar só client[0] quando há múltiplos tipos)
  const tipoDividaAgregadoId = (() => {
    const counts = new Map<string, number>();
    clients.forEach((c) => {
      const id = (c as any).tipo_divida_id;
      if (!id) return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    if (counts.size === 0) return client.tipo_divida_id;
    let bestId: string | null = null;
    let bestCount = -1;
    counts.forEach((count, id) => {
      if (count > bestCount) {
        bestCount = count;
        bestId = id;
      }
    });
    return bestId || client.tipo_divida_id;
  })();

  // Lookup names
  const statusCobrancaNome = (tiposStatus as any[]).find((t) => t.id === client.status_cobranca_id)?.nome;
  const tipoDividaNome = (tiposDivida as any[]).find((t) => t.id === tipoDividaAgregadoId)?.nome;
  const tipoDevedorNome = (tiposDevedor as any[]).find((t) => t.id === client.tipo_devedor_id)?.nome;

  // Format phones for metadata line
  const phones = [client.phone, client.phone2, client.phone3].filter(Boolean);

  return (
    <>
      <div className="flex items-center gap-1 mb-1 -mt-1">
        <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1" onClick={() => navigate(backTo || "/carteira")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <span className="text-xs text-muted-foreground">Voltar</span>
      </div>
      <Card className="px-4 py-2.5">
        {/* Linha 1: Nome + Ações */}
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-foreground flex-1 min-w-0 truncate">{client.nome_completo}</h1>
          <div className="flex items-center gap-3 ml-auto shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600"
              onClick={() => openWhatsApp()}
              title="WhatsApp"
            >
              <WhatsAppIcon className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600"
              onClick={() => navigate(`/atendimento?clientId=${client.id}`)}
              title="Atendimento"
            >
              <Headset className="w-4 h-4" />
            </Button>
            <PrimaryFlowButton onClick={onFormalizarAcordo}>
              <FileText className="w-4 h-4" />
              Formalizar Acordo
            </PrimaryFlowButton>
          </div>
        </div>

        {/* Linha 2: Grid de informações (estilo CRM) */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:[grid-template-columns:auto_auto_minmax(0,1fr)_minmax(0,200px)_auto] lg:divide-x divide-border rounded-lg bg-muted/30 border border-border/60 overflow-hidden">
          <div className="px-3 py-2 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">CPF</p>
            <p className="text-[13px] font-semibold text-foreground truncate mt-0.5">{formattedCpf}</p>
          </div>
          <div className="px-3 py-2 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Telefone</p>
            <p className="text-[13px] font-semibold text-foreground truncate mt-0.5">
              {client.phone ? formatPhone(client.phone) : "—"}
            </p>
          </div>
          <div className="px-3 py-2 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Email</p>
            <p className="text-[13px] font-semibold text-foreground truncate mt-0.5" title={client.email || ""}>
              {client.email || "—"}
            </p>
          </div>
          <div className="px-3 py-2 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Credor</p>
            <p className="text-[13px] font-semibold text-foreground truncate mt-0.5" title={client.credor}>
              {client.credor ? client.credor.split(/\s+/).slice(0, 2).join(" ") : "—"}
            </p>
          </div>
          <div className="px-3 py-2 min-w-0 bg-destructive/5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Saldo Devedor</p>
            <p className="text-[15px] font-bold text-destructive truncate mt-0.5">
              {formatCurrency(totalAberto)}
            </p>
          </div>
        </div>

        {/* Linha 3: Colapsável */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <CraftButton size="sm" className="w-full justify-between mt-1.5 text-muted-foreground">
              <CraftButtonLabel>Mais informações do devedor</CraftButtonLabel>
              <CraftButtonIcon>
                <ChevronDown className={cn("size-3 stroke-2 transition-transform duration-500", open && "rotate-180")} />
              </CraftButtonIcon>
            </CraftButton>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-2 pb-1 border-t border-border mt-2 space-y-2">
              {/* Identificação */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                <InlineEditableField
                  label="Cod. Devedor"
                  value={client.external_id}
                  onSave={(v) => updateSingleField("external_id", v)}
                />
                <InlineEditableField
                  label="Cod. Contrato"
                  value={client.cod_contrato}
                  onSave={(v) => updateSingleField("cod_contrato", v)}
                />
                <InfoItem label="Modelo" value={modelNames} />
                <InfoItem label="Credor" value={client.credor} />
              </div>

              {/* Telefones + Email */}
              <div className="pt-2 border-t border-border">
                <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
                  {tenant?.id && client?.cpf && client?.credor && (
                    <PhoneList
                      tenantId={tenant.id}
                      cpf={client.cpf}
                      credor={client.credor}
                      phone={client.phone}
                      phone2={client.phone2}
                      phone3={client.phone3}
                    />
                  )}
                  <div className="min-w-0 max-w-full">
                    <EmailList
                      emails={(clients || []).map((c: any) => c?.email).concat([client.email])}
                      tenantId={tenant?.id}
                      cpf={client.cpf}
                      credor={client.credor}
                      currentEmail={client.email}
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Endereço</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                  <InlineEditableField
                    label="Rua"
                    value={client.endereco}
                    onSave={(v) => updateSingleField("endereco", v)}
                    className="md:col-span-2"
                  />
                  <InlineEditableField
                    label="Bairro"
                    value={client.bairro}
                    onSave={(v) => updateSingleField("bairro", v)}
                  />
                  <InlineEditableField
                    label="Cidade"
                    value={client.cidade}
                    onSave={(v) => updateSingleField("cidade", v)}
                  />
                  <InlineEditableField
                    label="UF"
                    value={client.uf}
                    onSave={(v) => updateSingleField("uf", v)}
                    type="uf"
                    maxLength={2}
                  />
                  <InlineEditableField
                    label="CEP"
                    value={client.cep}
                    onSave={(v) => updateSingleField("cep", v)}
                    type="cep"
                    maxLength={10}
                    placeholder="00000-000"
                  />
                </div>
              </div>

              {/* Valores */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-2 pt-2 border-t border-border">
                <InfoItem label="Total Pago" value={<span className="text-success">{formatCurrency(totalPago)}</span>} />
                <InfoItem label="Valor Atualizado" value={<span className="font-semibold">{formatCurrency(totalAtualizado)}</span>} />
                <InfoItem label="Saldo Devedor" value={<span className="text-destructive">{formatCurrency(totalAberto)}</span>} />
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 pt-2 border-t border-border">
                <InfoItem label="Data Pagamento" value={client.data_pagamento ? formatDate(client.data_pagamento) : null} />
                <InfoItem label="Data Quitação" value={client.data_quitacao ? formatDate(client.data_quitacao) : null} />
                <InfoItem label="Data Devolução" value={client.data_devolucao ? formatDate(client.data_devolucao) : null} />
              </div>

              {/* Classificações */}
              <div className="pt-2 border-t border-border">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                  <InfoItem label="Tipo de Dívida" value={tipoDividaNome} />
                  <InfoItem label="Status do Cliente" value={statusCobrancaNome} />
                </div>
              </div>

              {/* Observações */}
              {client.observacoes && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{client.observacoes}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Sheet de Edição */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Dados do Devedor</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="nome_completo">Nome Completo</Label>
              <Input id="nome_completo" value={editForm.nome_completo} onChange={e => setEditForm(f => ({ ...f, nome_completo: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone 1</Label>
              <Input id="phone" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="phone2">Telefone 2</Label>
                <Input id="phone2" value={editForm.phone2} onChange={e => setEditForm(f => ({ ...f, phone2: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone3">Telefone 3</Label>
                <Input id="phone3" value={editForm.phone3} onChange={e => setEditForm(f => ({ ...f, phone3: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} placeholder="email@exemplo.com" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="external_id">Cód. Devedor (ID Externo)</Label>
                <Input id="external_id" value={editForm.external_id} onChange={e => setEditForm(f => ({ ...f, external_id: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cod_contrato">Cód. Contrato</Label>
                <Input id="cod_contrato" value={editForm.cod_contrato} onChange={e => setEditForm(f => ({ ...f, cod_contrato: e.target.value }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <div className="relative">
                <Input
                  id="cep"
                  value={editForm.cep}
                  onChange={e => setEditForm(f => ({ ...f, cep: e.target.value }))}
                  onBlur={handleCepBlur}
                  placeholder="00000-000"
                  maxLength={10}
                />
                {fetchingCep && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bairro">Bairro</Label>
              <Input id="bairro" value={editForm.bairro} onChange={e => setEditForm(f => ({ ...f, bairro: e.target.value }))} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input id="cidade" value={editForm.cidade} onChange={e => setEditForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uf">UF</Label>
                <Input id="uf" value={editForm.uf} onChange={e => setEditForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} maxLength={2} placeholder="SP" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea id="observacoes" value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} rows={4} placeholder="Anotações sobre o devedor..." />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={() => updateClientMutation.mutate(editForm)} disabled={updateClientMutation.isPending}>
              {updateClientMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <StartWhatsAppConversationDialog
        open={waDialogOpen}
        onOpenChange={setWaDialogOpen}
        client={client}
        allClientPhones={allClientPhones}
      />
    </>
  );
};

export default ClientDetailHeader;
