import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/formatters";
import { DISPOSITION_TYPES, type CallDisposition } from "@/services/dispositionService";
import {
  Clock, PenLine, Save, Inbox, Phone, Play, Pause, User, Bot, Zap, Handshake,
  CreditCard, Tags, FileEdit, Shield, MessageSquare, Signature, Globe, Headphones,
  ArrowRightLeft, StickyNote, AlertTriangle, ThumbsUp, ThumbsDown, Layers,
} from "lucide-react";

type ActorKind = "user" | "admin" | "workflow" | "ai" | "system" | "portal" | "gateway" | "client" | "import" | "api" | "unknown";

interface Actor { label: string; kind: ActorKind; }

interface TimelineItem {
  id: string;
  date: string;
  type: string;
  title: string;
  detail?: string;
  actor?: Actor;
  category: "acordo" | "manual" | "automatico" | "lote";
  sentiment?: "positivo" | "negativo" | null;
  recordingUrl?: string;
  durationSeconds?: number;
  rawEvent?: any;
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
  note: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  observation_added: { border: "border-amber-200", bg: "bg-amber-50/50", dot: "border-amber-400" },
  call: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  call_hangup: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  agreement: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_created: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_approved: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_cancelled: { border: "border-red-200", bg: "bg-red-50/50", dot: "border-red-400" },
  agreement_overdue: { border: "border-orange-200", bg: "bg-orange-50/50", dot: "border-orange-400" },
  agreement_signed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_completed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  agreement_status_completed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  message_sent: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  whatsapp_session: { border: "border-green-200", bg: "bg-green-50/50", dot: "border-green-400" },
  payment_confirmed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  manual_payment_requested: { border: "border-yellow-200", bg: "bg-yellow-50/50", dot: "border-yellow-400" },
  manual_payment_confirmed: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  manual_payment_rejected: { border: "border-red-200", bg: "bg-red-50/50", dot: "border-red-400" },
  system: { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  ai: { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  debtor_profile_changed: { border: "border-pink-200", bg: "bg-pink-50/50", dot: "border-pink-400" },
  field_update: { border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  atendimento_opened: { border: "border-cyan-200", bg: "bg-cyan-50/50", dot: "border-cyan-400" },
  atendimento_closed: { border: "border-slate-200", bg: "bg-slate-50/50", dot: "border-slate-400" },
  channel_switched: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  conversation_auto_closed: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  conversation_transferred: { border: "border-violet-200", bg: "bg-violet-50/50", dot: "border-violet-400" },
  portal_negotiation_started: { border: "border-teal-200", bg: "bg-teal-50/50", dot: "border-teal-400" },
  portal_agreement_created: { border: "border-emerald-200", bg: "bg-emerald-50/50", dot: "border-emerald-400" },
  ai_whatsapp_negotiation_started: { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  ai_voice_negotiation_started: { border: "border-purple-200", bg: "bg-purple-50/50", dot: "border-purple-400" },
  document_previewed: { border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  document_generated: { border: "border-indigo-200", bg: "bg-indigo-50/50", dot: "border-indigo-400" },
  previous_agreement_credit_applied: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
  credit_overflow: { border: "border-blue-200", bg: "bg-blue-50/50", dot: "border-blue-400" },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  disposition: "Tabulação Registrada",
  call: "Ligação",
  agreement_created: "Acordo Criado",
  agreement_approved: "Acordo Aprovado",
  agreement_cancelled: "Acordo Cancelado",
  agreement_overdue: "Acordo Vencido",
  agreement_signed: "Acordo Assinado",
  message_sent: "Mensagem de Prevenção",
  field_update: "Alteração de Dados",
  atendimento_opened: "Atendimento Iniciado",
  atendimento_closed: "Atendimento Encerrado",
  channel_switched: "Canal Alterado",
  observation_added: "Observação Registrada",
  portal_negotiation_started: "Negociação pelo Portal",
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
  whatsapp_session: "Conversa por WhatsApp",
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  call: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  call_hangup: <Phone className="w-3.5 h-3.5 text-blue-500" />,
  agreement_created: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_approved: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_cancelled: <Handshake className="w-3.5 h-3.5 text-red-500" />,
  agreement_overdue: <Handshake className="w-3.5 h-3.5 text-orange-500" />,
  agreement_signed: <Signature className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_completed: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  agreement_status_completed: <Handshake className="w-3.5 h-3.5 text-emerald-500" />,
  payment_confirmed: <CreditCard className="w-3.5 h-3.5 text-emerald-500" />,
  message_sent: <Zap className="w-3.5 h-3.5 text-violet-500" />,
  whatsapp_session: <MessageSquare className="w-3.5 h-3.5 text-green-500" />,
  system: <Bot className="w-3.5 h-3.5 text-slate-500" />,
  field_update: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  disposition: <Tags className="w-3.5 h-3.5 text-amber-500" />,
  atendimento_opened: <Headphones className="w-3.5 h-3.5 text-cyan-500" />,
  atendimento_closed: <Headphones className="w-3.5 h-3.5 text-slate-500" />,
  channel_switched: <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />,
  observation_added: <StickyNote className="w-3.5 h-3.5 text-amber-500" />,
  note: <StickyNote className="w-3.5 h-3.5 text-amber-500" />,
  portal_negotiation_started: <Globe className="w-3.5 h-3.5 text-teal-500" />,
  portal_agreement_created: <Globe className="w-3.5 h-3.5 text-emerald-500" />,
  ai_whatsapp_negotiation_started: <Bot className="w-3.5 h-3.5 text-purple-500" />,
  ai_voice_negotiation_started: <Bot className="w-3.5 h-3.5 text-purple-500" />,
  manual_payment_requested: <CreditCard className="w-3.5 h-3.5 text-yellow-500" />,
  manual_payment_confirmed: <CreditCard className="w-3.5 h-3.5 text-emerald-500" />,
  manual_payment_rejected: <CreditCard className="w-3.5 h-3.5 text-red-500" />,
  debtor_profile_changed: <Tags className="w-3.5 h-3.5 text-pink-500" />,
  document_previewed: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  document_generated: <FileEdit className="w-3.5 h-3.5 text-indigo-500" />,
  conversation_auto_closed: <MessageSquare className="w-3.5 h-3.5 text-violet-500" />,
  conversation_transferred: <ArrowRightLeft className="w-3.5 h-3.5 text-violet-500" />,
  previous_agreement_credit_applied: <CreditCard className="w-3.5 h-3.5 text-blue-500" />,
  credit_overflow: <AlertTriangle className="w-3.5 h-3.5 text-blue-500" />,
};

const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome", cpf: "CPF", phone: "Telefone 1", phone2: "Telefone 2",
  phone3: "Telefone 3", email: "E-mail", credor: "Credor", valor_parcela: "Valor da Parcela",
  valor_pago: "Valor Pago", valor_saldo: "Saldo", valor_entrada: "Entrada",
  status: "Status", data_vencimento: "Vencimento",
  data_pagamento: "Pagamento", endereco: "Endereço", cidade: "Cidade", uf: "UF",
  cep: "CEP", status_cobranca_id: "Status de Cobrança", observacoes: "Observações",
  tipo_divida_id: "Tipo de Dívida", tipo_devedor_id: "Tipo de Devedor",
  meio_pagamento_id: "Meio de Pagamento", numero_parcela: "Número da Parcela",
  total_parcelas: "Total de Parcelas", debtor_profile: "Perfil do Devedor",
  data_quitacao: "Data de Quitação", quebra: "Quebra", cod_contrato: "Contrato",
};

// Campos puramente técnicos: alterações que SÓ os tocam não viram card
const FIELD_BLACKLIST = new Set([
  "updated_at", "created_at", "external_id", "tenant_id", "operator_id",
  "status_cobranca_locked_by", "status_cobranca_locked_at", "propensity_score",
  "enrichment_data", "score_total", "score_dimensions", "score_updated_at",
  "id", "user_id", "actor_label",
]);

const DEBTOR_PROFILE_LABEL: Record<string, string> = {
  ocasional: "Ocasional", recorrente: "Recorrente",
  insatisfeito: "Insatisfeito", resistente: "Resistente",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX", boleto: "Boleto", dinheiro: "Dinheiro",
  cartao: "Cartão", cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito", transferencia: "Transferência",
  ted: "TED", doc: "DOC",
};

const formatDuration = (seconds: number) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const formatValue = (field: string, value: any): string => {
  if (value === null || value === undefined || value === "") return "(vazio)";
  if (field === "debtor_profile") return DEBTOR_PROFILE_LABEL[value] || String(value);
  if (field.startsWith("data_") && typeof value === "string") {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toLocaleDateString("pt-BR");
  }
  if (field.startsWith("valor_")) {
    const n = Number(value);
    if (!isNaN(n)) return formatCurrency(n);
  }
  return String(value);
};

const InlineAudioPlayer = ({ url }: { url: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) audioRef.current.pause(); else audioRef.current.play();
    setPlaying(!playing);
  };
  return (
    <span className="inline-flex items-center gap-1 ml-2">
      <button onClick={toggle} className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors" title={playing ? "Pausar" : "Ouvir gravação"}>
        {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
      </button>
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} preload="none" />
    </span>
  );
};

const ResponsibleLabel = ({ actor }: { actor?: Actor }) => {
  const a = actor || { label: "Sistema", kind: "system" as ActorKind };
  const iconByKind: Record<ActorKind, React.ReactNode> = {
    user: <User className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3 text-amber-600" />,
    workflow: <Zap className="w-3 h-3 text-violet-600" />,
    ai: <Bot className="w-3 h-3 text-purple-600" />,
    system: <Bot className="w-3 h-3 text-slate-500" />,
    portal: <Globe className="w-3 h-3 text-teal-600" />,
    gateway: <CreditCard className="w-3 h-3 text-emerald-600" />,
    client: <User className="w-3 h-3 text-green-600" />,
    import: <Layers className="w-3 h-3 text-indigo-600" />,
    api: <Globe className="w-3 h-3 text-blue-600" />,
    unknown: <Bot className="w-3 h-3 text-muted-foreground" />,
  };
  const prefix = a.kind === "user" || a.kind === "admin" ? "por " : "";
  return (
    <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
      {iconByKind[a.kind]} {prefix}{a.label}
    </span>
  );
};

/** Resolve quem é responsável pelo evento — nunca devolve "Origem desconhecida". */
const resolveActor = (event: any, profileMap: Record<string, string>, workflowMap: Record<string, string>): Actor => {
  const meta = (event?.metadata || {}) as any;
  const eventType: string = event?.event_type || "";
  const eventSource: string = (event?.event_source || "").toLowerCase();

  // 1. Admin (manual payment review)
  const adminId = meta.reviewed_by || meta.reviewer_id || meta.confirmed_by;
  if (adminId && (eventType === "manual_payment_confirmed" || eventType === "manual_payment_rejected")) {
    return { label: profileMap[adminId] || "Administrador", kind: "admin" };
  }

  // 2. Operador humano via metadata
  const userId = meta.operator_id || meta.created_by || meta.requested_by || meta.updated_by;
  if (userId && profileMap[userId]) return { label: profileMap[userId], kind: "user" };
  if (meta.actor_label) return { label: meta.actor_label, kind: "user" };
  if (meta.operator_name) return { label: meta.operator_name, kind: "user" };

  // 3. Workflow / régua
  if (eventSource === "workflow" || meta.source_type === "workflow" || meta.workflow_id) {
    const wfName = meta.workflow_id ? workflowMap[meta.workflow_id] : undefined;
    return { label: wfName ? `Fluxo: ${wfName}` : "Fluxo Automático", kind: "workflow" };
  }
  if (eventSource === "prevention" || eventType === "message_sent") return { label: "Régua de Prevenção", kind: "workflow" };
  if (eventSource === "regua") return { label: "Régua de Cobrança", kind: "workflow" };

  // 4. IA
  if (eventType.startsWith("ai_") || eventSource === "ai" || eventSource === "ai_agent" || meta.source_type === "ai_agent") {
    return { label: meta.agent_name ? `Agente IA — ${meta.agent_name}` : "Agente IA", kind: "ai" };
  }

  // 5. Auto-disposition (perfil inferido)
  if (eventSource === "auto_disposition") {
    const disp = meta.disposition_key ? (DISPOSITION_TYPES[meta.disposition_key] || meta.disposition_key) : "tabulação";
    return { label: `Sistema (inferido pela tabulação ${disp})`, kind: "system" };
  }

  // 6. Portal
  if (eventType.startsWith("portal_") || eventSource === "portal") return { label: "Portal do Devedor", kind: "portal" };

  // 7. Gateway externo
  const gatewayLabels: Record<string, string> = {
    negociarie: "Negociarie", boleto: "Negociarie (Boleto)", asaas: "Asaas",
  };
  if (gatewayLabels[eventSource]) return { label: gatewayLabels[eventSource], kind: "gateway" };

  // 8. Importações / API
  if (eventSource === "maxlist") return { label: "Importação MaxList", kind: "import" };
  if (eventSource === "import") return { label: "Importação em Lote", kind: "import" };
  if (eventSource === "api") return { label: "API Externa", kind: "api" };
  if (eventSource === "manual") return { label: "Edição no Cadastro", kind: "user" };

  // 9. WhatsApp inbound = cliente
  if (eventType === "whatsapp_inbound") return { label: "Cliente (WhatsApp)", kind: "client" };

  // 10. Fallback final → Sistema
  return { label: "Sistema", kind: "system" };
};

/** Render field_update changes inline (com resolução de IDs em rótulos humanos). */
const FieldUpdateDetail = ({ metadata, lookup }: { metadata: any; lookup: LookupMaps }) => {
  const changes = metadata?.changes;
  if (!changes || typeof changes !== "object") return null;

  const fields = Object.keys(changes).filter((f) => !FIELD_BLACKLIST.has(f));
  if (fields.length === 0) return null;

  const resolveOne = (field: string, raw: any): string => {
    if (raw === null || raw === undefined || raw === "") return "(vazio)";
    const map: Record<string, Record<string, string>> = {
      tipo_divida_id: lookup.dividas,
      tipo_devedor_id: lookup.devedores,
      status_cobranca_id: lookup.statuses,
      meio_pagamento_id: lookup.meios,
      operator_id: lookup.profiles,
    };
    if (map[field]) return map[field][String(raw)] || formatValue(field, raw);
    return formatValue(field, raw);
  };

  return (
    <div className="space-y-0.5 mt-1">
      {fields.map((field) => {
        const change = changes[field];
        const oldVal = resolveOne(field, change?.old);
        const newVal = resolveOne(field, change?.new);
        return (
          <p key={field} className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{FIELD_LABELS[field] || field.replace(/_/g, " ")}:</span>{" "}
            <span className="line-through">{oldVal}</span> → <span className="font-medium text-foreground">{newVal}</span>
          </p>
        );
      })}
    </div>
  );
};

interface LookupMaps {
  dividas: Record<string, string>;
  devedores: Record<string, string>;
  statuses: Record<string, string>;
  meios: Record<string, string>;
  profiles: Record<string, string>;
}

/** Categoriza e detecta sentimento. */
function classifyEvent(e: any): { category: TimelineItem["category"]; sentiment: TimelineItem["sentiment"] } {
  const t: string = e.event_type || "";
  const src: string = (e.event_source || "").toLowerCase();
  const meta = e.metadata || {};
  const sourceType = (meta.source_type || "").toLowerCase();

  // WhatsApp outbound de campanha → Lote (prioridade)
  if (t === "whatsapp_outbound" && (src === "campaign" || sourceType === "campaign")) {
    return { category: "lote", sentiment: null };
  }
  // WhatsApp outbound de régua/workflow → Automático
  if (t === "whatsapp_outbound" && (["regua", "prevention", "workflow"].includes(src) || ["regua", "prevention", "workflow"].includes(sourceType))) {
    return { category: "automatico", sentiment: null };
  }

  // Lote — importações/batch
  if (meta.batch_id || ["maxlist", "import"].includes(src)) {
    return { category: "lote", sentiment: null };
  }

  // Acordo
  if (t.startsWith("agreement_") || t === "payment_confirmed" || t.startsWith("manual_payment_") || t === "previous_agreement_credit_applied") {
    let sentiment: TimelineItem["sentiment"] = null;
    if (t === "agreement_cancelled" || t === "agreement_overdue" || t === "agreement_broken" || t === "manual_payment_rejected") sentiment = "negativo";
    if (t === "agreement_approved" || t === "agreement_completed" || t === "agreement_status_completed" || t === "agreement_signed" || t === "payment_confirmed" || t === "manual_payment_confirmed" || t === "agreement_created") sentiment = "positivo";
    // agreement_overdue/broken automáticos → automatico
    if ((t === "agreement_overdue" || t === "agreement_broken") && (src === "system" || src === "auto" || !src)) {
      return { category: "automatico", sentiment };
    }
    return { category: "acordo", sentiment };
  }

  // Disposição
  if (t === "disposition") {
    const code = e.event_value;
    const dispMeta: Record<string, "positivo" | "negativo"> = {
      cpc: "positivo", wa_cpc: "positivo", wa_em_negociacao: "positivo",
      wa_acordo_formalizado: "positivo", wa_em_dia: "positivo", wa_quitado: "positivo",
      no_answer: "negativo", voicemail: "negativo", interrupted: "negativo",
      wrong_contact: "negativo", wa_cpe: "negativo", wa_sem_contato: "negativo",
      wa_risco_processo: "negativo", wa_sem_interesse_produto: "negativo",
      wa_sem_interesse_financeiro: "negativo",
    };
    return { category: "manual", sentiment: dispMeta[code] || null };
  }

  // Encerramento automático
  if (t === "conversation_auto_closed") return { category: "automatico", sentiment: null };

  // Manual humano
  if (["note", "observation_added", "atendimento_opened", "atendimento_closed", "channel_switched", "document_previewed", "document_generated", "conversation_transferred"].includes(t)) {
    return { category: "manual", sentiment: null };
  }
  if (t === "debtor_profile_changed") {
    return { category: src === "auto_disposition" ? "automatico" : "manual", sentiment: null };
  }
  if (t === "field_update") {
    if (["maxlist", "import"].includes(src)) return { category: "lote", sentiment: null };
    if (["negociarie", "asaas", "api", "auto", "system"].includes(src)) return { category: "automatico", sentiment: null };
    return { category: "manual", sentiment: null };
  }
  if (t === "message_sent") {
    if (["regua", "prevention", "workflow"].includes(src)) return { category: "automatico", sentiment: null };
    return { category: "automatico", sentiment: null };
  }

  // Automático
  return { category: "automatico", sentiment: null };
}

const ClientTimeline = ({ dispositions, agreements, callLogs = [], clientCpf }: ClientTimelineProps) => {
  const [showAll, setShowAll] = useState(false);
  const [filters, setFilters] = useState({
    acordo: true, manual: true, automatico: true, lote: true,
    positivas: true, negativas: true,
  });

  // 1) client_events
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

  // 2) profiles
  const { data: profileMap = {} } = useQuery({
    queryKey: ["timeline-profiles", clientCpf, clientEvents.length],
    queryFn: async () => {
      const userIds = new Set<string>();
      clientEvents.forEach((e: any) => {
        const m = e.metadata || {};
        ["created_by","updated_by","operator_id","requested_by","reviewed_by","reviewer_id","confirmed_by","assigned_to"].forEach(k => { if (m[k]) userIds.add(m[k]); });
      });
      dispositions.forEach((d) => { if (d.operator_id) userIds.add(d.operator_id); });
      const ids = [...userIds].filter(Boolean);
      if (ids.length === 0) return {};
      const [{ data: byUserId }, { data: byId }] = await Promise.all([
        supabase.from("profiles").select("id, user_id, full_name").in("user_id", ids),
        supabase.from("profiles").select("id, user_id, full_name").in("id", ids),
      ]);
      const map: Record<string, string> = {};
      (byUserId || []).forEach((p: any) => { if (p.user_id && p.full_name) map[p.user_id] = p.full_name; });
      (byId || []).forEach((p: any) => { if (p.id && p.full_name) map[p.id] = p.full_name; if (p.user_id && p.full_name) map[p.user_id] = p.full_name; });
      return map;
    },
    enabled: clientEvents.length > 0 || dispositions.length > 0,
  });

  // 3) workflows
  const { data: workflowMap = {} } = useQuery({
    queryKey: ["timeline-workflows", clientCpf, clientEvents.length],
    queryFn: async () => {
      const wfIds = new Set<string>();
      clientEvents.forEach((e: any) => { const wid = (e.metadata || {})?.workflow_id; if (wid) wfIds.add(wid); });
      const ids = [...wfIds].filter(Boolean);
      if (ids.length === 0) return {};
      const { data } = await supabase.from("workflow_flows" as any).select("id, name").in("id", ids);
      const map: Record<string, string> = {};
      ((data as any[]) || []).forEach((w: any) => { if (w.id && w.name) map[w.id] = w.name; });
      return map;
    },
    enabled: clientEvents.length > 0,
  });

  // 4) lookups (apenas IDs efetivamente referenciados em field_update)
  const { data: lookup = { dividas: {}, devedores: {}, statuses: {}, meios: {}, profiles: {} } } = useQuery({
    queryKey: ["timeline-lookups", clientCpf, clientEvents.length],
    queryFn: async (): Promise<LookupMaps> => {
      const buckets: Record<string, Set<string>> = {
        tipo_divida_id: new Set(), tipo_devedor_id: new Set(),
        status_cobranca_id: new Set(), meio_pagamento_id: new Set(),
        operator_id: new Set(),
      };
      clientEvents.forEach((e: any) => {
        if (e.event_type !== "field_update") return;
        const ch = e.metadata?.changes || {};
        Object.keys(ch).forEach((field) => {
          if (!buckets[field]) return;
          [ch[field]?.old, ch[field]?.new].forEach((v) => { if (v) buckets[field].add(String(v)); });
        });
      });

      async function fetchMap(table: string, ids: string[], nameCol = "nome"): Promise<Record<string, string>> {
        if (ids.length === 0) return {};
        const { data } = await supabase.from(table as any).select(`id, ${nameCol}`).in("id", ids);
        const m: Record<string, string> = {};
        ((data as any[]) || []).forEach((r: any) => { m[r.id] = r[nameCol]; });
        return m;
      }

      const [dividas, devedores, statuses, profiles2] = await Promise.all([
        fetchMap("tipos_divida", [...buckets.tipo_divida_id]),
        fetchMap("tipos_devedor", [...buckets.tipo_devedor_id]),
        fetchMap("tipos_status", [...buckets.status_cobranca_id]),
        (async () => {
          const ids = [...buckets.operator_id];
          if (ids.length === 0) return {};
          const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
          const m: Record<string, string> = {};
          (data || []).forEach((p: any) => { if (p.full_name) m[p.id] = p.full_name; });
          return m;
        })(),
      ]);
      return { dividas, devedores, statuses, meios: {}, profiles: profiles2 };
    },
    enabled: clientEvents.length > 0,
  });

  // 5) Construir items
  const items: TimelineItem[] = useMemo(() => {
    const out: TimelineItem[] = [];

    if (clientEvents.length > 0) {
      // 5a) WhatsApp:
      //   - mensagens humanas (operador/cliente sem campanha/régua) → DESCARTADAS (vão na aba WhatsApp)
      //   - outbound de campanha → agrupar por campaign_id como "Disparo em massa" (Lote)
      //   - outbound de régua/workflow → agrupar por dia como "Mensagem da Régua" (Automático)
      const otherEvents: any[] = [];
      const campaignBuckets = new Map<string, any[]>();
      const reguaBuckets = new Map<string, any[]>();

      clientEvents.forEach((e: any) => {
        if (e.event_type !== "whatsapp_inbound" && e.event_type !== "whatsapp_outbound") {
          otherEvents.push(e);
          return;
        }
        const meta = e.metadata || {};
        const src = (e.event_source || "").toLowerCase();
        const sourceType = (meta.source_type || "").toLowerCase();

        if (e.event_type === "whatsapp_outbound" && (src === "campaign" || sourceType === "campaign")) {
          const cid = meta.campaign_id || "sem-campanha";
          if (!campaignBuckets.has(cid)) campaignBuckets.set(cid, []);
          campaignBuckets.get(cid)!.push(e);
          return;
        }
        if (e.event_type === "whatsapp_outbound" && (
          ["regua", "prevention", "workflow"].includes(src) ||
          ["regua", "prevention", "workflow"].includes(sourceType)
        )) {
          const day = new Date(e.created_at).toISOString().slice(0, 10);
          const wid = meta.workflow_id || sourceType || src || "regua";
          const key = `${wid}|${day}`;
          if (!reguaBuckets.has(key)) reguaBuckets.set(key, []);
          reguaBuckets.get(key)!.push(e);
          return;
        }
        // Bate-papo humano: descartado da timeline (visível na aba WhatsApp)
      });

      // 5a.1) Cards de campanha
      campaignBuckets.forEach((evs, cid) => {
        const last = evs.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
        const campaignName = campaignNameMap[cid] || (cid !== "sem-campanha" ? "Campanha" : "Campanha");
        out.push({
          id: `wa-campaign-${cid}-${last.created_at}`,
          date: last.created_at,
          type: "whatsapp_session",
          title: "Disparo de WhatsApp em massa",
          detail: `${campaignName} · ${evs.length} mensagem(ns)`,
          actor: { label: "Campanha de WhatsApp", kind: "system" },
          category: "lote",
          sentiment: null,
        });
      });

      // 5a.2) Cards de régua/workflow
      reguaBuckets.forEach((evs, key) => {
        const last = evs.reduce((a, b) => new Date(a.created_at) > new Date(b.created_at) ? a : b);
        const wid = (last.metadata || {}).workflow_id;
        const wfName = (wid && workflowMap[wid]) || "Régua de Prevenção";
        out.push({
          id: `wa-regua-${key}`,
          date: last.created_at,
          type: "message_sent",
          title: "Mensagem enviada pela Régua",
          detail: `${wfName} · ${evs.length} mensagem(ns)`,
          actor: { label: wfName, kind: "workflow" },
          category: "automatico",
          sentiment: null,
        });
      });

      // 5c) demais eventos
      otherEvents.forEach((e: any) => {
        const meta = e.metadata || {};
        const eventType = e.event_type || "system";

        // Filtrar field_update que só toca campos blacklisted
        if (eventType === "field_update") {
          const changes = meta.changes || {};
          const visibleFields = Object.keys(changes).filter((f) => !FIELD_BLACKLIST.has(f));
          if (visibleFields.length === 0) return;
        }

        const actor = resolveActor(e, profileMap, workflowMap);
        const { category, sentiment } = classifyEvent(e);

        let title = EVENT_TYPE_LABELS[eventType];
        let detail = "";

        if (eventType === "disposition") {
          const dispLabel = DISPOSITION_TYPES[e.event_value as string] || e.event_value || "Tabulação";
          title = `Tabulação: ${dispLabel}`;
          const parts: string[] = [];
          if (meta.notes) parts.push(`"${meta.notes}"`);
          if (actor.kind === "user") parts.push(`Tabulado por ${actor.label}`);
          if (meta.scheduled_callback) {
            const d = new Date(meta.scheduled_callback);
            if (!isNaN(d.getTime())) parts.push(`Retorno agendado: ${d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`);
          }
          detail = parts.join(" · ");
        } else if (eventType === "debtor_profile_changed") {
          const from = meta.from ? DEBTOR_PROFILE_LABEL[meta.from] || meta.from : "(não definido)";
          const to = meta.to ? DEBTOR_PROFILE_LABEL[meta.to] || meta.to : "(removido)";
          detail = `${from} → ${to}`;
        } else if (eventType.startsWith("agreement_")) {
          const parts: string[] = [];
          if (meta.credor) parts.push(meta.credor);
          if (meta.original_total && meta.proposed_total) {
            let v = `${formatCurrency(Number(meta.original_total))} → ${formatCurrency(Number(meta.proposed_total))}`;
            if (meta.new_installments) v += ` (${meta.new_installments}x)`;
            parts.push(v);
          }
          detail = parts.join(" — ");
        } else if (eventType === "call") {
          const parts: string[] = [];
          if (meta.duration_seconds) parts.push(`Duração: ${formatDuration(meta.duration_seconds)}`);
          if (meta.campaign_name) parts.push(meta.campaign_name);
          detail = parts.join(" — ");
        } else if (eventType === "message_sent") {
          detail = "Enviada via régua";
        } else if (eventType === "atendimento_opened") {
          const ch = meta.origin_channel || e.event_channel || "WhatsApp";
          if (actor.kind === "user") title = `${actor.label} iniciou atendimento via ${ch}`;
          else title = `Cliente iniciou conversa (${ch})`;
        } else if (eventType === "atendimento_closed") {
          if (actor.kind === "user") title = `Atendimento encerrado por ${actor.label}`;
          else title = "Atendimento encerrado";
        } else if (eventType === "conversation_auto_closed") {
          title = "Conversa encerrada automaticamente (inatividade)";
        } else if (eventType === "manual_payment_requested" || eventType === "manual_payment_confirmed" || eventType === "manual_payment_rejected") {
          const pm = meta.payment_method;
          if (pm) detail = `Forma: ${PAYMENT_METHOD_LABELS[pm] || pm}`;
        }

        out.push({
          id: `ev-${e.id}`,
          date: e.created_at,
          type: eventType,
          title: title || (eventType === "disposition" ? "Tabulação" : "Evento do Sistema"),
          detail: detail || undefined,
          actor,
          category,
          sentiment,
          durationSeconds: eventType === "call" ? meta.duration_seconds : undefined,
          rawEvent: e,
        });
      });
    } else {
      // Fallback props
      dispositions.forEach((d) => {
        const label = DISPOSITION_TYPES[d.disposition_type as keyof typeof DISPOSITION_TYPES] || d.disposition_type;
        const opName = d.operator_name || (d.operator_id && profileMap[d.operator_id]) || undefined;
        out.push({
          id: `d-${d.id}`,
          date: d.created_at,
          type: d.disposition_type === "note" ? "note" : "disposition",
          title: `Tabulação: ${label}`,
          detail: [d.notes && `"${d.notes}"`, opName && `Tabulado por ${opName}`].filter(Boolean).join(" · ") || undefined,
          actor: opName ? { label: opName, kind: "user" } : { label: "Sistema", kind: "system" },
          category: "manual",
          sentiment: null,
        });
      });

      agreements.forEach((a: any) => {
        const opName = a.creator_name || (a.created_by && profileMap[a.created_by]) || undefined;
        out.push({
          id: `a-${a.id}`,
          date: a.created_at,
          type: "agreement_created",
          title: `Acordo ${a.status === "completed" ? "Quitado" : a.status === "cancelled" ? "Cancelado" : "Criado"}`,
          detail: `${formatCurrency(Number(a.original_total))} → ${formatCurrency(Number(a.proposed_total))} (${a.new_installments}x)`,
          actor: opName ? { label: opName, kind: "user" } : { label: "Sistema", kind: "system" },
          category: "acordo",
          sentiment: a.status === "cancelled" ? "negativo" : "positivo",
        });
      });

      callLogs.forEach((c) => {
        out.push({
          id: `call-${c.id}`,
          date: c.called_at,
          type: "call",
          title: "Ligação",
          detail: c.phone ? `Tel: ${c.phone}` : undefined,
          actor: c.agent_name ? { label: c.agent_name, kind: "user" } : { label: "Discador", kind: "system" },
          recordingUrl: c.recording_url || undefined,
          durationSeconds: c.duration_seconds || 0,
          category: "automatico",
          sentiment: null,
        });
      });
    }

    out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return out;
  }, [clientEvents, profileMap, workflowMap, dispositions, agreements, callLogs]);

  // 6) Aplicar filtros
  const filtered = useMemo(() => {
    return items.filter((it) => {
      if (!filters[it.category]) return false;
      // Para itens com sentimento, respeitar toggles positivas/negativas
      if (it.sentiment === "positivo" && !filters.positivas) return false;
      if (it.sentiment === "negativo" && !filters.negativas) return false;
      return true;
    });
  }, [items, filters]);

  const visibleItems = showAll ? filtered : filtered.slice(0, 5);
  const getColors = (type: string) => COLOR_MAP[type] || COLOR_MAP.disposition;

  const FilterChip = ({ active, onClick, color, label, icon }: { active: boolean; onClick: () => void; color: string; label?: string; icon?: React.ReactNode }) => (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? `${color} shadow-sm`
          : "bg-muted/40 text-muted-foreground border-border opacity-60 hover:opacity-90"
      }`}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );

  return (
    <Card className="border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Histórico de Atendimento
          </CardTitle>
          {filtered.length > 5 && (
            <button
              className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Mostrar menos" : "Ver tudo"}
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5 pt-3">
          <FilterChip
            active={filters.acordo}
            onClick={() => setFilters((f) => ({ ...f, acordo: !f.acordo }))}
            color="bg-emerald-100 text-emerald-700 border-emerald-300"
            label="Acordo"
            icon={<Handshake className="w-3 h-3" />}
          />
          <FilterChip
            active={filters.manual}
            onClick={() => setFilters((f) => ({ ...f, manual: !f.manual }))}
            color="bg-blue-100 text-blue-700 border-blue-300"
            label="Manual"
            icon={<User className="w-3 h-3" />}
          />
          <FilterChip
            active={filters.automatico}
            onClick={() => setFilters((f) => ({ ...f, automatico: !f.automatico }))}
            color="bg-purple-100 text-purple-700 border-purple-300"
            label="Automático"
            icon={<Bot className="w-3 h-3" />}
          />
          <FilterChip
            active={filters.lote}
            onClick={() => setFilters((f) => ({ ...f, lote: !f.lote }))}
            color="bg-orange-100 text-orange-700 border-orange-300"
            label="Lote"
            icon={<Layers className="w-3 h-3" />}
          />
          <span className="mx-1 w-px bg-border" />
          <FilterChip
            active={filters.positivas}
            onClick={() => setFilters((f) => ({ ...f, positivas: !f.positivas }))}
            color="bg-green-100 text-green-700 border-green-300"
            icon={<ThumbsUp className="w-3 h-3" />}
          />
          <FilterChip
            active={filters.negativas}
            onClick={() => setFilters((f) => ({ ...f, negativas: !f.negativas }))}
            color="bg-rose-100 text-rose-700 border-rose-300"
            icon={<ThumbsDown className="w-3 h-3" />}
          />
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum registro de atendimento</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Os eventos aparecerão aqui conforme o atendimento avança.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Inbox className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum filtro ativo</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Selecione pelo menos uma categoria acima.</p>
          </div>
        ) : (
          <div className="relative pl-6">
            <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
            <div className="space-y-3">
              {visibleItems.map((item) => {
                const colors = getColors(item.type);
                const meta = item.type === "field_update" ? item.rawEvent?.metadata : null;
                return (
                  <div key={item.id} className="relative">
                    <div className={`absolute -left-6 top-3 w-[14px] h-[14px] rounded-full border-2 bg-card ${colors.dot}`} />
                    <div className={`border rounded-lg p-3 ${colors.border} ${colors.bg}`}>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          {TYPE_ICON[item.type] || TYPE_ICON.system}
                          {item.title}
                          {item.type === "call" && item.durationSeconds !== undefined && item.durationSeconds > 0 && (
                            <span className="text-xs font-normal text-muted-foreground">({formatDuration(item.durationSeconds)})</span>
                          )}
                        </span>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                          {new Date(item.date).toLocaleDateString("pt-BR")} — {new Date(item.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <ResponsibleLabel actor={item.actor} />
                      {item.type === "field_update" && meta ? (
                        <FieldUpdateDetail metadata={meta} lookup={lookup} />
                      ) : (
                        item.detail && <p className="text-xs text-muted-foreground mt-1">{item.detail}</p>
                      )}
                      {item.type === "call" && item.recordingUrl && (
                        <div className="mt-1.5 flex items-center">
                          <span className="text-xs text-blue-600 font-medium">Gravação</span>
                          <InlineAudioPlayer url={item.recordingUrl} />
                        </div>
                      )}
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
              <Button size="sm" onClick={handleSaveNote} disabled={savingNote || !noteText.trim()} className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground">
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
