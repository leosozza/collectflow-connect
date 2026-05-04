import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import { 
  Clock, PenLine, Save, Inbox, Phone, Play, Pause, User, Bot, Zap, 
  Handshake, CreditCard, Tags, FileEdit, Shield, MessageSquare, 
  Signature, Globe, Headphones, ArrowRightLeft, StickyNote, 
  AlertTriangle, ThumbsUp, ThumbsDown, CheckCircle2, XCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type ActorKind = "user" | "admin" | "workflow" | "ai" | "system" | "portal" | "gateway" | "client" | "unknown";
type EventCategory = "acordo" | "manual" | "automatico" | "lote";
type Sentiment = "positive" | "negative" | "neutral";

interface Actor {
  label: string;
  kind: ActorKind;
}

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  title: string;
  detail?: string;
  operator?: string;
  actor?: Actor;
  recordingUrl?: string;
  durationSeconds?: number;
  category: EventCategory;
  sentiment: Sentiment;
}

interface CallLog {
  id: string;
  phone?: string;
  agent_name?: string;
  status?: string;
  duration_seconds?: number;
  recording_url?: string | null;
  campaign_name?: string;
  called_at: string;
}

interface ClientTimelineProps {
  dispositions: (CallDisposition & { operator_name?: string })[];
  agreements: any[];
  callLogs?: CallLog[];
  clientCpf?: string;
}

interface ClientObservationsProps {
  observacoes?: string | null;
  onSaveNote?: (note: string) => Promise<void>;
  savingNote?: boolean;
}

const COLOR_MAP: Record<string, { border: string; bg: string; dot: string }> = {
  disposition: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  note:        { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  call:        { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  agreement:   { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_created:  { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_approved: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_cancelled:{ border: "border-red-200", bg: "bg-red-50/50", dot: "border-red-400" },
  agreement_overdue:  { border: "border-orange-200", bg: "bg-orange-50/50", dot: "border-orange-400" },
  agreement_signed:   { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  message:     { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  message_sent:{ border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  whatsapp_inbound: { border: "border-green-200", bg: "bg-green-50/50", dot: "border-green-400" },
  whatsapp_outbound:{ border: "border-green-200", bg: "bg-green-50/50", dot: "border-green-400" },
  payment:     { border: "border-teal-200", bg: "bg-teal-50/50", dot: "border-teal-400" },
  system:      { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  ai:          { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  debtor_category: { border: "border-pink-200", bg: "bg-pink-50/50", dot: "border-pink-400" },
  field_update:{ border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  atendimento_opened: { border: "border-cyan-200", bg: "bg-cyan-50/50", dot: "border-cyan-400" },
  atendimento_closed: { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  channel_switched: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  observation_added: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  portal_negotiation_started: { border: "border-teal-200", bg: "bg-teal-50/50", dot: "border-teal-400" },
  portal_agreement_created: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  ai_whatsapp_negotiation_started: { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  ai_voice_negotiation_started: { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  manual_payment_requested: { border: "border-yellow-200", bg: "bg-yellow-50/50", dot: "border-yellow-400" },
  manual_payment_confirmed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  manual_payment_rejected:  { border: "border-red-200", bg: "bg-red-50/50", dot: "border-red-400" },
  payment_confirmed:        { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_completed:      { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_status_completed:{ border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  debtor_profile_changed:   { border: "border-pink-200", bg: "bg-pink-50/50", dot: "border-pink-400" },
  call_hangup:              { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  document_previewed:       { border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  document_generated:       { border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  conversation_auto_closed: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  conversation_transferred: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  previous_agreement_credit_applied: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  credit_overflow:          { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
};

const toTitleCase = (s: string) =>
  s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const EVENT_TYPE_LABELS: Record<string, string> = {
  disposition: "Disposição",
  call: "Ligação",
  agreement_created: "Acordo Criado",
  agreement_approved: "Acordo Aprovado",
  agreement_cancelled: "Acordo Cancelado",
  agreement_overdue: "Acordo Vencido",
  agreement_signed: "Acordo Assinado",
  whatsapp_inbound: "WhatsApp Recebido",
  whatsapp_outbound: "WhatsApp Enviado",
  message_sent: "Mensagem de Prevenção",
  field_update: "Alteração de Dados",
  atendimento_opened: "Atendimento Iniciado",
  atendimento_closed: "Atendimento Encerrado",
  channel_switched: "Canal Alterado",
  observation_added: "Observação Registrada",
  portal_negotiation_started: "Negociação Portal",
  portal_agreement_created: "Acordo via Portal",
  ai_whatsapp_negotiation_started: "IA WhatsApp Iniciou",
  ai_voice_negotiation_started: "IA Voz Iniciou",
  manual_payment_requested: "Baixa Manual Solicitada",
  manual_payment_confirmed: "Pagamento Confirmado Manualmente",
  manual_payment_rejected: "Baixa Manual Recusada",
  payment_confirmed: "Pagamento Confirmado",
  agreement_completed: "Acordo Quitado",
  agreement_status_completed: "Acordo Quitado",
  debtor_profile_changed: "Perfil do Devedor Atualizado",
  debtor_category: "Categoria do Devedor Definida",
  call_hangup: "Ligação Encerrada",
  document_previewed: "Documento Visualizado",
  document_generated: "Documento Gerado",
  conversation_auto_closed: "Conversa Encerrada (Inatividade)",
  conversation_transferred: "Conversa Transferida",
  send_failed: "Falha no Envio",
  agreement_broken: "Acordo Quebrado",
  note: "Observação",
  phone_promoted_hot: "Número Quente Definido",
  previous_agreement_credit_applied: "Crédito de Acordo Anterior Aplicado",
  credit_overflow: "Crédito Excedente (revisar manualmente)",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  agreement: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_created: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_approved: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_cancelled: <Handshake className="w-3.5 h-3.5 text-red-500" />,
  agreement_overdue: <Handshake className="w-3.5 h-3.5 text-orange-500" />,
  agreement_signed: <Signature className="w-3.5 h-3.5 text-emerald-500" />,
  payment: <CreditCard className="w-3.5 h-3.5 text-teal-500" />,
  message: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  message_sent: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  whatsapp_inbound: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  whatsapp_outbound: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  system: <Bot className="w-3.5 h-3.5 text-slate-500" />,
  debtor_category: <Tags className="w-3.5 h-3.5 text-pink-500" />,
  field_update: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  disposition: <Phone className="w-3.5 h-3.5 text-amber-500" />,
  atendimento_opened: <Headphones className="w-3.5 h-3.5 text-cyan-500" />,
  atendimento_closed: <Headphones className="w-3.5 h-3.5 text-slate-500" />,
  channel_switched: <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />,
  observation_added: <StickyNote className="w-3.5 h-3.5 text-amber-500" />,
  portal_negotiation_started: <Globe className="w-3.5 h-3.5 text-teal-500" />,
  portal_agreement_created: <Globe className="w-3.5 h-3.5 text-emerald-500" />,
  ai_whatsapp_negotiation_started: <Bot className="w-3.5 h-3.5 text-purple-500" />,
  ai_voice_negotiation_started: <Bot className="w-3.5 h-3.5 text-purple-500" />,
  manual_payment_requested: <CreditCard className="w-3.5 h-3.5 text-yellow-500" />,
  manual_payment_confirmed: <CreditCard className="w-3.5 h-3.5 text-emerald-500" />,
  manual_payment_rejected: <CreditCard className="w-3.5 h-3.5 text-red-500" />,
  payment_confirmed: <CreditCard className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_completed: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_status_completed: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  debtor_profile_changed: <Tags className="w-3.5 h-3.5 text-pink-500" />,
  call_hangup: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  document_previewed: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  document_generated: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  conversation_auto_closed: <MessageSquare className="w-3.5 h-3.5 text-violet-500" />,
  conversation_transferred: <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />,
  previous_agreement_credit_applied: <CreditCard className="w-3.5 h-3.5 text-blue-500" />,
  credit_overflow: <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />,
};

const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome", cpf: "CPF", phone: "Telefone 1", phone2: "Telefone 2",
  phone3: "Telefone 3", email: "E-mail", credor: "Credor", valor_parcela: "Valor Parcela",
  valor_pago: "Valor Pago", status: "Status", data_vencimento: "Vencimento",
  data_pagamento: "Pagamento", endereco: "Endereço", cidade: "Cidade", uf: "UF",
  cep: "CEP", status_cobranca_id: "Status Cobrança", observacoes: "Observações",
};

const SOURCE_LABELS: Record<string, string> = {
  import: "Importação", api: "API", maxlist: "MaxList", manual: "Edição Manual",
  regua: "Régua de Cobrança", whatsapp_auto: "WhatsApp Automático",
  email_auto: "E-mail Automático", prevention: "Régua de Prevenção",
  negociarie: "Negociarie", portal: "Portal do Devedor",
  ai: "Agente IA", ai_agent: "Agente IA",
  operator: "Operador", admin: "Administrador",
  system: "Sistema", workflow: "Fluxo Automático",
};

const AGREEMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  pending_approval: "Aguardando Aprovação",
  approved: "Aprovado",
  completed: "Quitado",
  cancelled: "Cancelado",
  overdue: "Vencido",
  broken: "Quebrado",
};

const CALL_STATUS_LABELS: Record<string, string> = {
  answered: "Atendida",
  no_answer: "Não Atendida",
  busy: "Ocupado",
  failed: "Falhou",
  completed: "Concluída",
  abandoned: "Abandonada",
  voicemail: "Caixa Postal",
  realizada: "Realizada",
};

const CHANNEL_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  sms: "SMS",
  email: "E-mail",
  voice: "Voz",
  call: "Ligação",
  boleto: "Boleto",
  pix: "PIX",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  transferencia: "Transferência",
  ted: "TED",
  doc: "DOC",
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const InlineAudioPlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause();
    else audioRef.current.play();
    setPlaying(!playing);
  };

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <button
        onClick={toggle}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
        title={playing ? "Pausar" : "Ouvir gravação"}
      >
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />
    </span>
  );
};

const ResponsibleLabel = ({ actor }: { actor?: Actor }) => {
  const a: Actor = actor && actor.label
    ? actor
    : { label: "Origem desconhecida", kind: "unknown" };

  const iconByKind: Record<ActorKind, React.ReactNode> = {
    user: <User className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3 text-amber-600" />,
    workflow: <Zap className="w-3 h-3 text-violet-600" />,
    ai: <Bot className="w-3 h-3 text-purple-600" />,
    system: <Bot className="w-3 h-3 text-slate-500" />,
    portal: <Globe className="w-3 h-3 text-teal-600" />,
    gateway: <CreditCard className="w-3 h-3 text-emerald-600" />,
    client: <User className="w-3 h-3 text-green-600" />,
    unknown: <Bot className="w-3 h-3 text-muted-foreground" />,
  };

  const prefix = a.kind === "user" || a.kind === "admin" ? "por " : "";

  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
      {iconByKind[a.kind]} {prefix}{a.label}
    </span>
  );
};

/** Resolve who is responsible for an event */
const resolveActor = (
  event: any,
  profileMap: Record<string, string>,
  workflowMap: Record<string, string>
): Actor => {
  const meta = (event?.metadata || {}) as any;
  const eventType: string = event?.event_type || "";
  const eventSource: string = event?.event_source || "";

  // Admin actions (manual payment review)
  const adminId = meta.reviewed_by || meta.reviewer_id || meta.confirmed_by;
  if (adminId && (eventType === "manual_payment_confirmed" || eventType === "manual_payment_rejected")) {
    const name = profileMap[adminId];
    return { label: name || "Admin", kind: "admin" };
  }

  // Workflow / régua automática
  if (eventSource === "workflow" || meta.source_type === "workflow" || meta.workflow_id) {
    const wfName = meta.workflow_id ? workflowMap[meta.workflow_id] : undefined;
    return { label: wfName ? `Fluxo: ${wfName}` : "Fluxo Automático", kind: "workflow" };
  }

  // Régua de prevenção
  if (eventSource === "prevention" || eventType === "message_sent") {
    return { label: "Régua de Prevenção", kind: "workflow" };
  }

  // IA
  if (
    eventType.startsWith("ai_") ||
    meta.source_type === "ai_agent" ||
    eventSource === "ai" ||
    eventSource === "ai_agent"
  ) {
    return { label: meta.agent_name ? `Agente IA — ${meta.agent_name}` : "Agente IA", kind: "ai" };
  }

  // Portal do devedor
  if (eventType.startsWith("portal_") || eventSource === "portal") {
    return { label: "Portal do Devedor", kind: "portal" };
  }

  // Gateway externo
  if (eventSource === "negociarie" || eventSource === "boleto" || eventSource === "asaas") {
    const labels: Record<string, string> = {
      negociarie: "Negociarie",
      boleto: "Negociarie (Boleto)",
      asaas: "Asaas",
    };
    return { label: labels[eventSource] || "Gateway", kind: "gateway" };
  }

  // WhatsApp inbound = cliente respondendo
  if (eventType === "whatsapp_inbound" || eventSource === "whatsapp_inbound") {
    return { label: "Cliente (WhatsApp)", kind: "client" };
  }

  // Operador humano
  const userId = meta.operator_id || meta.created_by || meta.requested_by || meta.updated_by;
  if (userId && profileMap[userId]) {
    return { label: profileMap[userId], kind: "user" };
  }
  if (meta.operator_name) {
    return { label: meta.operator_name, kind: "user" };
  }
  if (meta.agent_name) {
    return { label: meta.agent_name, kind: "user" };
  }

  // Sistema (auto-close, transferências automáticas, etc.)
  if (
    eventSource === "system" ||
    eventType === "conversation_auto_closed" ||
    eventType === "agreement_overdue" ||
    eventType === "agreement_status_completed"
  ) {
    return { label: "Sistema", kind: "system" };
  }

  // Fallback para operador se a fonte for operator mas não temos o nome
  if (eventSource === "operator") {
    return { label: "Operador", kind: "user" };
  }

  return { label: "Origem desconhecida", kind: "unknown" };
};

const resolveCategory = (event: any): EventCategory => {
  const type = event?.event_type || "";
  const source = event?.event_source || "";
  const meta = (event?.metadata || {}) as any;

  if (
    type.startsWith("agreement_") || 
    type.startsWith("manual_payment_") || 
    type === "payment_confirmed" ||
    type === "agreement_broken"
  ) {
    return "acordo";
  }

  if (source === "operator" || source === "admin" || source === "manual") {
    return "manual";
  }

  if (
    source === "maxlist" || 
    source === "import" || 
    meta.campaign_id || 
    meta.campaign_name || 
    meta.is_bulk
  ) {
    return "lote";
  }

  return "automatico";
};

const resolveSentiment = (event: any): Sentiment => {
  const type = event?.event_type || "";
  
  const positive = [
    "agreement_created", "agreement_approved", "agreement_signed", 
    "agreement_completed", "manual_payment_confirmed", "payment_confirmed",
    "phone_promoted_hot", "agreement_status_approved", "agreement_status_completed"
  ];
  
  const negative = [
    "agreement_cancelled", "agreement_overdue", "agreement_broken",
    "manual_payment_rejected", "send_failed", "credit_overflow",
    "agreement_status_cancelled", "agreement_status_overdue", "agreement_status_broken"
  ];

  if (positive.includes(type)) return "positive";
  if (negative.includes(type)) return "negative";
  return "neutral";
};

/** Render field_update changes inline */
const FieldUpdateDetail = ({ metadata }: { metadata: any }) => {
  const changes = metadata?.changes;
  if (!changes || typeof changes !== "object") return null;
  const fields = Object.keys(changes);
  if (fields.length === 0) return null;
  return (
    <div className="space-y-0.5 mt-1">
      {fields.map((field) => {
        const change = changes[field];
        const oldVal = change?.old ?? "—";
        const newVal = change?.new ?? "—";
        return (
          <p key={field} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{FIELD_LABELS[field] || field}:</span>{" "}
            <span className="line-through">{String(oldVal)}</span> → <span className="font-medium text-foreground">{String(newVal)}</span>
          </p>
        );
      })}
    </div>
  );
};

const ClientTimeline = ({ dispositions, agreements, callLogs = [], clientCpf }: ClientTimelineProps) => {
  const [filters, setFilters] = useState<Record<EventCategory, boolean>>({
    acordo: true,
    manual: true,
    automatico: true,
    lote: true,
  });
  const [sentiment, setSentiment] = useState<"positive" | "negative" | "all">("all");

  const { data: clientEvents = [] } = useQuery({
    queryKey: ["client-events-timeline", clientCpf],
    queryFn: async () => {
      const rawCpf = (clientCpf || "").replace(/\D/g, "");
      if (!rawCpf) return [];
      const { data, error } = await supabase
        .from("client_events")
        .select("*")
        .or(`client_cpf.eq.${rawCpf},client_cpf.eq.${clientCpf}`)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data || [];
    },
    enabled: !!clientCpf,
  });

  const { data: profileMap = {} } = useQuery({
    queryKey: ["timeline-profiles", clientCpf, clientEvents.length],
    queryFn: async () => {
      const userIds = new Set<string>();
      clientEvents.forEach((e: any) => {
        const meta = e.metadata as any;
        if (meta?.created_by) userIds.add(meta.created_by);
        if (meta?.updated_by) userIds.add(meta.updated_by);
        if (meta?.operator_id) userIds.add(meta.operator_id);
      });
      const ids = [...userIds].filter(Boolean);
      if (ids.length === 0) return {};
      const { data } = await supabase.from("profiles").select("id, user_id, full_name").or(`user_id.in.(${ids.join(",")}),id.in.(${ids.join(",")})`);
      const map: Record<string, string> = {};
      (data || []).forEach((p) => { 
        if (p.user_id) map[p.user_id] = p.full_name;
        if (p.id) map[p.id] = p.full_name;
      });
      return map;
    },
    enabled: clientEvents.length > 0,
  });

  const { data: workflowMap = {} } = useQuery({
    queryKey: ["timeline-workflows", clientCpf, clientEvents.length],
    queryFn: async () => {
      const wfIds = new Set<string>();
      clientEvents.forEach((e: any) => {
        const wid = (e.metadata as any)?.workflow_id;
        if (wid) wfIds.add(wid);
      });
      const ids = [...wfIds].filter(Boolean);
      if (ids.length === 0) return {};
      const { data } = await supabase.from("workflow_flows" as any).select("id, name").in("id", ids);
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((w: any) => { if (w.id && w.name) map[w.id] = w.name; });
      return map;
    },
    enabled: clientEvents.length > 0,
  });

  const allItems = useMemo(() => {
    const items: TimelineItem[] = [];
    clientEvents.forEach((e: any) => {
      const meta = (e.metadata || {}) as any;
      const eventType = e.event_type || "system";
      const actor = resolveActor(e, profileMap, workflowMap);
      
      const label = eventType === "disposition"
        ? (DISPOSITION_TYPES[e.event_value as keyof typeof DISPOSITION_TYPES] || e.event_value || "Disposição")
        : (EVENT_TYPE_LABELS[eventType] || "Evento do Sistema");

      let detail = "";
      if (eventType === "disposition") detail = meta.notes || "";
      else if (eventType.startsWith("agreement_")) {
        if (meta.proposed_total) detail = `${formatCurrency(Number(meta.original_total || 0))} → ${formatCurrency(Number(meta.proposed_total))}`;
        if (meta.credor) detail = `${meta.credor}${detail ? " — " + detail : ""}`;
      } else if (eventType === "call") {
        if (meta.duration_seconds) detail = `Duração: ${formatDuration(meta.duration_seconds)}`;
      } else if (eventType === "whatsapp_inbound" || eventType === "whatsapp_outbound") {
        detail = e.event_value || "";
      }

      items.push({
        id: `ev-${e.id}`,
        date: e.created_at,
        type: eventType,
        title: label,
        detail: detail || undefined,
        actor,
        category: resolveCategory(e),
        sentiment: resolveSentiment(e),
        recordingUrl: meta.recording_url,
        durationSeconds: meta.duration_seconds,
      });
    });
    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [clientEvents, profileMap, workflowMap]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => {
      if (!filters[item.category]) return false;
      if (sentiment === "positive" && item.sentiment !== "positive") return false;
      if (sentiment === "negative" && item.sentiment !== "negative") return false;
      if (item.type === "whatsapp_inbound" || item.type === "whatsapp_outbound") return false;
      return true;
    });
  }, [allItems, filters, sentiment]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    filteredItems.forEach(item => {
      const minute = item.date.slice(0, 16);
      if (!groups[minute]) groups[minute] = [];
      groups[minute].push(item);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredItems]);

  const toggleCategory = (cat: EventCategory) => {
    setFilters(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const getCategoryColor = (cat: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      acordo: "bg-[#4ade80]",
      manual: "bg-[#3b82f6]",
      automatico: "bg-[#a855f7]",
      lote: "bg-[#f97316]",
    };
    return colors[cat];
  };

  return (
    <Card className="border-none shadow-none bg-transparent overflow-visible">
      <CardHeader className="px-0 pb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <CardTitle className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500 flex items-center gap-2.5">
            <Clock className="w-4 h-4" />
            Histórico de Atendimento
          </CardTitle>

          <div className="flex items-center gap-8">
            {/* Categories Switches */}
            <div className="flex items-center gap-5 pr-8 border-r border-slate-200">
              {(Object.keys(filters) as EventCategory[]).map((cat) => (
                <div key={cat} className="flex flex-col items-center gap-1.5">
                  <Switch 
                    checked={filters[cat]} 
                    onCheckedChange={() => toggleCategory(cat)}
                    className={cn(
                      "scale-90",
                      filters[cat] ? getCategoryColor(cat) : "bg-slate-200"
                    )}
                  />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                    {cat === "automatico" ? "Automático" : toTitleCase(cat)}
                  </span>
                </div>
              ))}
            </div>

            {/* Sentiment Filters */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-9 h-9 rounded-full transition-all",
                  sentiment === "positive" ? "bg-emerald-50 text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
                onClick={() => setSentiment(sentiment === "positive" ? "all" : "positive")}
              >
                <ThumbsUp className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-9 h-9 rounded-full transition-all",
                  sentiment === "negative" ? "bg-rose-50 text-rose-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                )}
                onClick={() => setSentiment(sentiment === "negative" ? "all" : "negative")}
              >
                <ThumbsDown className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-0">
        {groupedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center opacity-40">
            <Inbox className="w-16 h-16 text-slate-300 mb-4" />
            <p className="text-sm font-medium text-slate-500">Nenhum evento registrado</p>
          </div>
        ) : (
          <div className="relative pt-8 w-full max-w-6xl mx-auto">
            {/* Central Line */}
            <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-[2px] bg-slate-100" />

            <div className="space-y-16">
              {groupedItems.map(([minute, items], idx) => {
                const isLeft = idx % 2 === 0;
                const primaryItem = items[0];
                const sourceLabel = primaryItem.actor?.kind === "system" || primaryItem.actor?.kind === "workflow" ? "AUTO" : (primaryItem.actor?.kind || "MANUAL").toUpperCase();

                return (
                  <div key={minute} className="grid grid-cols-[1fr_80px_1fr] items-center group">
                    {/* LEFT SIDE */}
                    <div className={cn("flex flex-col", isLeft ? "items-end pr-10" : "items-start pl-10 order-3")}>
                      <div className="space-y-4 w-full">
                        {items.map((item) => (
                          <div 
                            key={item.id} 
                            className={cn(
                              "relative p-6 rounded-2xl border transition-all duration-300 bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-lg hover:-translate-y-0.5",
                              item.sentiment === "positive" ? "border-emerald-100" : item.sentiment === "negative" ? "border-rose-100" : "border-slate-100",
                              isLeft ? "text-right" : "text-left"
                            )}
                          >
                            {/* Speech Bubble Tip */}
                            <div className={cn(
                              "absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-inherit transform rotate-45",
                              isLeft ? "-right-[9px] border-r border-t" : "-left-[9px] border-l border-b"
                            )} />

                            <div className={cn("flex items-center gap-2.5 mb-2", isLeft ? "justify-end" : "justify-start")}>
                              <span className={cn(
                                "text-[12px] font-black uppercase tracking-wider flex items-center gap-2",
                                item.category === "acordo" ? "text-emerald-600" : item.category === "manual" ? "text-blue-600" : item.category === "automatico" ? "text-purple-600" : "text-orange-600"
                              )}>
                                {isLeft && item.sentiment === "positive" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {isLeft && item.sentiment === "negative" && <XCircle className="w-3.5 h-3.5" />}
                                {item.title}
                                {!isLeft && item.sentiment === "positive" && <CheckCircle2 className="w-3.5 h-3.5" />}
                                {!isLeft && item.sentiment === "negative" && <XCircle className="w-3.5 h-3.5" />}
                              </span>
                            </div>

                            {item.detail && (
                              <p className="text-[13px] text-slate-500 font-medium leading-relaxed mb-3">
                                {item.detail}
                              </p>
                            )}

                            <div className={cn("flex flex-col gap-2 pt-3 border-t border-slate-50", isLeft ? "items-end" : "items-start")}>
                              {item.actor && <ResponsibleLabel actor={item.actor} />}
                              {item.type === "call" && item.recordingUrl && (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-bold text-blue-500 uppercase">Gravação</span>
                                  <InlineAudioPlayer url={item.recordingUrl} />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* CENTRAL ICON */}
                    <div className="relative z-10 flex justify-center order-2">
                      <div className={cn(
                        "w-12 h-12 rounded-full border-[6px] border-white shadow-xl flex items-center justify-center transition-all group-hover:scale-110",
                        getCategoryColor(primaryItem.category)
                      )}>
                        <div className="text-white">
                          {TYPE_ICON[primaryItem.type] || <Bot className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>

                    {/* META INFO SIDE */}
                    <div className={cn("flex flex-col opacity-60 group-hover:opacity-100 transition-opacity", isLeft ? "items-start pl-10 order-3" : "items-end pr-10 text-right")}>
                      <span className="text-[11px] font-black text-slate-800 tracking-widest mb-0.5">
                        {sourceLabel}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 tabular-nums">
                        {new Date(primaryItem.date).toLocaleDateString("pt-BR")} — {new Date(primaryItem.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const ClientObservations = ({ observacoes, onSaveNote, savingNote }: ClientObservationsProps) => {
  const [noteText, setNoteText] = useState("");

  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    await onSaveNote?.(noteText.trim());
    setNoteText("");
  };

  const parsedNotes = (() => {
    if (!observacoes) return [];
    return observacoes.split("\n---\n").filter(Boolean).map((block, i) => {
      const lines = block.trim().split("\n");
      const header = lines[0] || "";
      const body = lines.slice(1).join("\n").trim();
      const match = header.match(/^(.+?)\s*\|\s*(.+)$/);
      const datetime = match ? match[1].trim() : header;
      const operator = match ? match[2].trim() : "";
      return { id: `note-${i}`, datetime, operator, body };
    });
  })();

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <PenLine className="w-4 h-4" />
          Observações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {onSaveNote && (
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione uma observação sobre este atendimento..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleSaveNote}
                disabled={savingNote || !noteText.trim()}
                className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Save className="w-4 h-4" />
                Salvar Nota
              </Button>
            </div>
          </div>
        )}

        {parsedNotes.length > 0 ? (
          <div className="space-y-3">
            {parsedNotes.map((note) => (
              <div key={note.id} className="border-l-4 border-amber-400 bg-muted/30 rounded-r-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-muted-foreground">{note.datetime}</span>
                  {note.operator && (
                    <span className="text-[11px] font-semibold text-foreground">{note.operator}</span>
                  )}
                </div>
                {note.body && <p className="text-sm text-foreground italic">"{note.body}"</p>}
              </div>
            ))}
          </div>
        ) : (
          !onSaveNote && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <PenLine className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma observação</p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
};

export default ClientTimeline;
export { ClientObservations };
