import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency, formatDate, formatCPF } from "@/lib/formatters";
import { createAgreement, AgreementFormData } from "@/services/agreementService";
import { negociarieService, BoletoInstallment } from "@/services/negociarieService";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Calculator, FileCheck, Loader2, AlertTriangle, Play, Copy, CheckCircle2 } from "lucide-react";
import { enrichClientAddress } from "@/services/addressEnrichmentService";
import { getClientProfile, upsertClientProfile } from "@/services/clientProfileService";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchCredorRules, type CredorRulesResult } from "@/services/cadastrosService";
import SimpleCalculator from "./SimpleCalculator";
import { useSessionStorage } from "@/hooks/useSessionStorage";
import { RotateCcw, X as XIcon } from "lucide-react";

interface AgreementCalculatorProps {
  clients: any[];
  cpf: string;
  clientName: string;
  credor: string;
  onAgreementCreated: () => void;
  hasActiveAgreement?: boolean;
  reactivateFrom?: any | null;
}

interface SimulatedInstallment {
  number: number;
  method: string;
  dueDate: string;
  value: number;
  label?: string;
}

interface EntradaItem {
  date: string;
  value: string;
  method: string;
}

const parseDecimal = (s: string): number => {
  if (!s) return 0;
  const n = Number(s.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const AgreementCalculator = ({ clients, cpf, clientName, credor, onAgreementCreated, hasActiveAgreement, reactivateFrom }: AgreementCalculatorProps) => {
  const { user, profile } = useAuth();
  const pendentes = clients.filter((c) => c.status === "pendente" || c.status === "vencido");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(pendentes.map((c) => c.id)));
  const [calcDate, setCalcDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [jurosPercent, setJurosPercent] = useState("0");
  const [multaPercent, setMultaPercent] = useState("0");
  const [honorariosPercent, setHonorariosPercent] = useState("0");
  const [descontoPercent, setDescontoPercent] = useState("0");
  const [descontoReais, setDescontoReais] = useState("0");
  const [discountSource, setDiscountSource] = useState<"percent" | "amount">("percent");

  // Agreement form
  const [entradas, setEntradas] = useState<EntradaItem[]>([{ date: "", value: "0", method: "BOLETO" }]);
  const [numParcelas, setNumParcelas] = useState<number | "">(0);
  const [formaPagto, setFormaPagto] = useState("BOLETO");
  const [intervalo, setIntervalo] = useState("mensal");
  const [firstDueDate, setFirstDueDate] = useState("");
  const [notes, setNotes] = useState("");

  // Simulation state
  const [simulated, setSimulated] = useState(false);
  const [simulatedInstallments, setSimulatedInstallments] = useState<SimulatedInstallment[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [enrichingAddress, setEnrichingAddress] = useState(false);
  const [addressStatus, setAddressStatus] = useState("");
  const [generatingBoletos, setGeneratingBoletos] = useState(false);
  const [credorRules, setCredorRules] = useState<CredorRulesResult | null>(null);

  // Missing fields dialog for pre-boleto validation
  const [missingFieldsOpen, setMissingFieldsOpen] = useState(false);
  const [missingFields, setMissingFields] = useState<Record<string, string>>({});
  const [foundFields, setFoundFields] = useState<Record<string, string>>({});
  const [savingMissingFields, setSavingMissingFields] = useState(false);
  const [cepLookupLoading, setCepLookupLoading] = useState(false);
  const [copiedTitles, setCopiedTitles] = useState(false);
  const [titlesOpen, setTitlesOpen] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Fetch credor rules and auto-fill honorários + aging discount
  useEffect(() => {
    if (!profile?.tenant_id || !credor) return;
    fetchCredorRules(profile.tenant_id, credor).then((rules) => {
      if (rules) {
        setCredorRules(rules);
        setJurosPercent(String(rules.juros_mes || 0));
        setMultaPercent(String(rules.multa || 0));

        // Auto-calculate honorários from grade based on effective balance (after payments)
        const totalOriginal = pendentes.reduce((s, c) => {
          const bruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
          const pago = Number(c.valor_pago) || 0;
          const saldoExplicito = Number(c.valor_saldo) || 0;
          const valorEfetivo = saldoExplicito > 0 ? saldoExplicito : Math.max(0, bruto - pago);
          return s + valorEfetivo;
        }, 0);
        if (rules.honorarios_grade && rules.honorarios_grade.length > 0) {
          const matchedTier = rules.honorarios_grade.find((tier: any) => {
            const parts = (tier.faixa || "").split("-").map(Number);
            if (parts.length !== 2) return false;
            return totalOriginal >= parts[0] && totalOriginal <= parts[1];
          });
          if (matchedTier) {
            setHonorariosPercent(String(Number(matchedTier.honorario) || 0));
          }
        }

        // Auto-calculate discount from aging tiers based on max delay
        const refDate = new Date();
        const maxAtraso = pendentes.reduce((max, c) => {
          const venc = new Date(c.data_vencimento + "T00:00:00");
          const atraso = Math.max(0, Math.floor((refDate.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
          return Math.max(max, atraso);
        }, 0);

        if (rules.aging_discount_tiers && rules.aging_discount_tiers.length > 0) {
          const matchedAging = rules.aging_discount_tiers.find((tier: any) =>
            maxAtraso >= (tier.min_days || 0) && maxAtraso <= (tier.max_days || Infinity)
          );
          setDescontoPercent(matchedAging ? String(Number(matchedAging.discount_percent) || 0) : "0");
        } else {
          setDescontoPercent("0");
        }
      }
    });
  }, [profile?.tenant_id, credor]);

  // Pre-fill from reactivated agreement
  useEffect(() => {
    if (!reactivateFrom) return;

    // Discount
    if (reactivateFrom.discount_percent != null) {
      setDescontoPercent(String(reactivateFrom.discount_percent));
      setDiscountSource("percent");
    }

    // Installments
    if (reactivateFrom.new_installments) {
      setNumParcelas(reactivateFrom.new_installments);
    }

    // Notes
    const originalDate = new Date(reactivateFrom.created_at).toLocaleDateString("pt-BR");
    setNotes(`Reativação do acordo de ${originalDate}`);

    // Reconstruct entradas from custom_installment_values
    const civ = reactivateFrom.custom_installment_values as Record<string, any> | null;
    if (civ) {
      const newEntradas: EntradaItem[] = [];
      // First entrada
      if (civ.entrada && Number(civ.entrada) > 0) {
        newEntradas.push({
          date: "",
          value: String(civ.entrada),
          method: civ.entrada_method || "BOLETO",
        });
      }
      // Additional entradas (entrada_2, entrada_3, ...)
      let idx = 2;
      while (civ[`entrada_${idx}`] !== undefined) {
        if (Number(civ[`entrada_${idx}`]) > 0) {
          newEntradas.push({
            date: "",
            value: String(civ[`entrada_${idx}`]),
            method: civ[`entrada_${idx}_method`] || "BOLETO",
          });
        }
        idx++;
      }
      if (newEntradas.length > 0) {
        setEntradas(newEntradas);
      }

      // Payment method from installments
      if (civ["1_method"]) {
        setFormaPagto(civ["1_method"]);
      }
    }
  }, [reactivateFrom]);

  // ─── Rascunho do acordo (sessionStorage com TTL de 30 minutos) ───
  // Persiste parâmetros para evitar perda de trabalho em re-render/navegação acidental.
  const draftKey = `agreement-draft:${cpf}:${credor}`;
  const DRAFT_TTL_MS = 30 * 60 * 1000;
  type DraftPayload = {
    ts: number;
    entradas: EntradaItem[];
    numParcelas: number | "";
    formaPagto: string;
    intervalo: string;
    firstDueDate: string;
    jurosPercent: string;
    multaPercent: string;
    honorariosPercent: string;
    descontoPercent: string;
    descontoReais: string;
    discountSource: "percent" | "amount";
    notes: string;
    calcDate: string;
  };
  const [draft, setDraft, clearDraft] = useSessionStorage<DraftPayload | null>(draftKey, null);
  const [draftRestoreOpen, setDraftRestoreOpen] = useState(false);
  const [draftDismissed, setDraftDismissed] = useState(false);

  // On mount: se houver rascunho válido (não expirado), oferecer restauração.
  useEffect(() => {
    if (!draft) return;
    if (reactivateFrom) return; // reativação tem prioridade
    if (Date.now() - draft.ts > DRAFT_TTL_MS) {
      clearDraft();
      return;
    }
    setDraftRestoreOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreDraft = () => {
    if (!draft) return;
    setEntradas(draft.entradas);
    setNumParcelas(draft.numParcelas);
    setFormaPagto(draft.formaPagto);
    setIntervalo(draft.intervalo);
    setFirstDueDate(draft.firstDueDate);
    setJurosPercent(draft.jurosPercent);
    setMultaPercent(draft.multaPercent);
    setHonorariosPercent(draft.honorariosPercent);
    setDescontoPercent(draft.descontoPercent);
    setDescontoReais(draft.descontoReais);
    setDiscountSource(draft.discountSource);
    setNotes(draft.notes);
    setCalcDate(draft.calcDate);
    setDraftRestoreOpen(false);
    toast.success("Rascunho restaurado");
  };

  const discardDraft = () => {
    clearDraft();
    setDraftRestoreOpen(false);
    setDraftDismissed(true);
  };

  // Reset simulation when params change + salvar rascunho (debounced via useEffect natural)
  useEffect(() => {
    setSimulated(false);
    setSimulatedInstallments([]);
  }, [selectedIds, jurosPercent, multaPercent, honorariosPercent, descontoPercent, entradas, numParcelas, firstDueDate, formaPagto, intervalo]);

  // Auto-save rascunho sempre que houver mudança significativa após o usuário interagir
  useEffect(() => {
    if (draftRestoreOpen) return; // não sobrescreve enquanto o usuário decide
    // Só salva se há algo "trabalhado": parcelas > 0 ou entrada > 0 ou notas
    const hasWork =
      (typeof numParcelas === "number" && numParcelas > 0) ||
      entradas.some((e) => parseDecimal(e.value) > 0) ||
      notes.trim().length > 0;
    if (!hasWork) return;
    setDraft({
      ts: Date.now(),
      entradas,
      numParcelas,
      formaPagto,
      intervalo,
      firstDueDate,
      jurosPercent,
      multaPercent,
      honorariosPercent,
      descontoPercent,
      descontoReais,
      discountSource,
      notes,
      calcDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entradas, numParcelas, formaPagto, intervalo, firstDueDate, jurosPercent, multaPercent, honorariosPercent, descontoPercent, descontoReais, discountSource, notes, calcDate, draftRestoreOpen]);

  const numEntrada = entradas.reduce((sum, e) => sum + parseDecimal(e.value), 0);

  // Per-row calculations
  const rowCalcs = useMemo(() => {
    const refDate = new Date(calcDate + "T00:00:00");
    return pendentes.map((c) => {
      const venc = new Date(c.data_vencimento + "T00:00:00");
      const atraso = Math.max(0, Math.floor((refDate.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24)));
      const mesesAtraso = Math.max(0, (refDate.getFullYear() - venc.getFullYear()) * 12 + (refDate.getMonth() - venc.getMonth()));
      const valorBruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
      const valorPago = Number(c.valor_pago) || 0;
      const saldoExplicito = Number(c.valor_saldo) || 0;
      const valorOriginal = saldoExplicito > 0 ? saldoExplicito : Math.max(0, valorBruto - valorPago);
      const valorBase = valorOriginal;
      const jP = parseDecimal(jurosPercent);
      const mP = parseDecimal(multaPercent);
      const hP = parseDecimal(honorariosPercent);
      const jurosVal = valorBase * (jP / 100) * mesesAtraso;
      const multaVal = atraso > 0 ? valorBase * (mP / 100) : 0;
      const honorariosVal = valorBase * (hP / 100);
      const total = valorBase + jurosVal + multaVal + honorariosVal;
      return { id: c.id, atraso, valorOriginal, valorPago, valorBase, jurosVal, multaVal, honorariosVal, total };
    });
  }, [pendentes, calcDate, jurosPercent, multaPercent, honorariosPercent]);

  // Totals from selected rows
  const totals = useMemo(() => {
    const selected = rowCalcs.filter((r) => selectedIds.has(r.id));
    const totalOriginal = selected.reduce((s, r) => s + r.valorOriginal, 0);
    const totalBase = selected.reduce((s, r) => s + r.valorBase, 0);
    const totalJuros = selected.reduce((s, r) => s + r.jurosVal, 0);
    const totalMulta = selected.reduce((s, r) => s + r.multaVal, 0);
    const totalHonorarios = selected.reduce((s, r) => s + r.honorariosVal, 0);
    const totalBruto = selected.reduce((s, r) => s + r.total, 0);

    let descontoVal: number;
    if (discountSource === "amount") {
      descontoVal = Math.round(Math.min(parseDecimal(descontoReais), totalBruto) * 100) / 100;
    } else {
      const pct = parseDecimal(descontoPercent);
      descontoVal = Math.round(totalBruto * (pct / 100) * 100) / 100;
    }
    const totalAtualizado = Math.round(Math.max(0, totalBruto - descontoVal) * 100) / 100;
    return { totalOriginal, totalBase, totalJuros, totalMulta, totalHonorarios, totalBruto, descontoVal, totalAtualizado };
  }, [rowCalcs, selectedIds, descontoPercent, descontoReais, discountSource]);

  const remainingAfterEntrada = Math.max(0, totals.totalAtualizado - numEntrada);
  const nP = typeof numParcelas === "number" ? numParcelas : 1;
  const installmentValue = nP > 0 ? Math.round((remainingAfterEntrada / nP) * 100) / 100 : 0;

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === pendentes.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pendentes.map((c) => c.id)));
  };

  const handleSimulate = useCallback(() => {
    const nPSim = typeof numParcelas === "number" ? numParcelas : 0;

    if (nPSim > 0 && !firstDueDate) {
      toast.error("Informe a data do 1º vencimento");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Selecione ao menos um título");
      return;
    }

    const validEntradas = entradas.filter(e => parseDecimal(e.value) > 0 && e.date);

    if (nPSim === 0 && validEntradas.length === 0) {
      toast.error("Informe ao menos uma entrada com data e valor");
      return;
    }

    const installments: SimulatedInstallment[] = [];

    // Add each entrada as individual installment
    validEntradas.forEach((ent, idx) => {
      installments.push({
        number: 0,
        method: ent.method,
        dueDate: ent.date,
        value: parseDecimal(ent.value),
        label: validEntradas.length > 1 ? `Entrada ${idx + 1}` : "Entrada",
      });
    });

    if (nPSim > 0) {
      const baseDate = new Date(firstDueDate + "T00:00:00");
      for (let i = 0; i < nPSim; i++) {
        const d = new Date(baseDate);
        if (intervalo === "mensal") {
          d.setMonth(d.getMonth() + i);
        } else if (intervalo === "quinzenal") {
          d.setDate(d.getDate() + i * 15);
        } else {
          d.setDate(d.getDate() + i * 7);
        }
        installments.push({
          number: i + 1,
          method: formaPagto,
          dueDate: d.toISOString().split("T")[0],
          value: installmentValue,
        });
      }
    }

    setSimulatedInstallments(installments);
    setSimulated(true);
  }, [firstDueDate, selectedIds, entradas, formaPagto, numParcelas, intervalo, installmentValue]);

  // Out-of-standard detection
  const outOfStandard = useMemo(() => {
    if (!credorRules) return { isOut: false, reasons: [] as string[] };
    const reasons: string[] = [];
    const pctVal = parseDecimal(descontoPercent);
    if (credorRules.desconto_maximo > 0 && pctVal > credorRules.desconto_maximo) {
      reasons.push(`Desconto ${pctVal}% excede máx ${credorRules.desconto_maximo}%`);
    }
    const nPCheck = typeof numParcelas === "number" ? numParcelas : 1;
    if (credorRules.parcelas_max > 0 && nPCheck > credorRules.parcelas_max) {
      reasons.push(`Parcelas ${nPCheck}x excede máx ${credorRules.parcelas_max}x`);
    }
    return { isOut: reasons.length > 0, reasons };
  }, [credorRules, descontoPercent, numParcelas]);

  /** Check required fields for boleto generation using canonical profile */
  const checkRequiredFields = useCallback(async () => {
    let consolidated: Record<string, string> = {};
    const fields = ["email", "phone", "cep", "endereco", "bairro", "cidade", "uf"] as const;

    if (profile?.tenant_id) {
      try {
        const cp = await getClientProfile(profile.tenant_id, cpf);
        for (const field of fields) {
          consolidated[field] = (cp as any)[field] || "";
        }
      } catch {
        // Fallback to clients array
        for (const field of fields) {
          consolidated[field] = "";
          for (const c of clients) {
            const val = (c as any)[field];
            if (val && String(val).trim()) {
              consolidated[field] = String(val).trim();
              break;
            }
          }
        }
      }
    } else {
      for (const field of fields) {
        consolidated[field] = "";
        for (const c of clients) {
          const val = (c as any)[field];
          if (val && String(val).trim()) {
            consolidated[field] = String(val).trim();
            break;
          }
        }
      }
    }

    const missing: Record<string, string> = {};
    const labels: Record<string, string> = {
      email: "E-mail", phone: "Telefone", cep: "CEP",
      endereco: "Endereço", bairro: "Bairro", cidade: "Cidade", uf: "UF",
    };
    for (const field of fields) {
      if (!consolidated[field]) missing[field] = "";
    }
    return { consolidated, missing, labels };
  }, [clients, cpf, profile?.tenant_id]);

  /** Save missing fields to clients + canonical profile, then re-run the official agreement flow */
  const handleSaveMissingFields = async () => {
    if (!profile?.tenant_id) return;
    setSavingMissingFields(true);
    try {
      const rawCpf = cpf.replace(/\D/g, "");
      const updatePayload: Record<string, string> = {};
      for (const [key, val] of Object.entries(missingFields)) {
        if (val.trim()) updatePayload[key] = val.trim();
      }
      const stillMissing = Object.keys(missingFields).filter((k) => !updatePayload[k]);
      if (stillMissing.length > 0) {
        const labels: Record<string, string> = {
          email: "E-mail", phone: "Telefone", cep: "CEP",
          endereco: "Endereço", bairro: "Bairro", cidade: "Cidade", uf: "UF",
        };
        toast.error(`Preencha: ${stillMissing.map((k) => labels[k] || k).join(", ")}`);
        setSavingMissingFields(false);
        return;
      }

      // Persist in clients (retrocompat) + client_profiles (canonical)
      await supabase
        .from("clients")
        .update(updatePayload)
        .or(`cpf.eq.${rawCpf},cpf.eq.${formatCPF(rawCpf)}`)
        .eq("tenant_id", profile.tenant_id);
      await upsertClientProfile(profile.tenant_id, rawCpf, updatePayload, "manual");

      setMissingFieldsOpen(false);
      setMissingFields({});
      setFoundFields({});
      toast.success("Dados salvos. Gerando acordo...");

      // Re-run the canonical agreement flow — pre-flight will now pass.
      await handleConfirmedSubmit({ skipMissingCheck: true });
    } catch (err: any) {
      toast.error("Erro ao salvar dados: " + (err.message || "Erro desconhecido"));
    } finally {
      setSavingMissingFields(false);
    }
  };

  // Validação leve antes de abrir o diálogo de confirmação.
  // Não toca no banco; apenas garante que há simulação válida.
  const handleSubmit = () => {
    if (!user || !profile?.tenant_id) { toast.error("Usuário não autenticado"); return; }
    if (!simulated) { toast.error("Simule o acordo antes de gravar"); return; }
    if (submitting || enrichingAddress || generatingBoletos) return;
    setConfirmOpen(true);
  };

  const handleConfirmedSubmit = async (options?: { skipMissingCheck?: boolean; markBoletoPendente?: boolean }) => {
    if (!user || !profile?.tenant_id) { toast.error("Usuário não autenticado"); return; }
    if (!simulated) { toast.error("Simule o acordo antes de gravar"); return; }

    const skipMissingCheck = options?.skipMissingCheck === true;
    const markBoletoPendente = options?.markBoletoPendente === true;

    setSubmitting(true);
    try {
      // Pre-flight: ensure address fields exist BEFORE creating the agreement.
      // Skipped when re-entering after the operator filled missing fields manually,
      // or when explicitly marking the agreement as boleto_pendente.
      if (!skipMissingCheck) {
        try {
          const pre = await checkRequiredFields();
          if (Object.keys(pre.missing).length > 0) {
            setEnrichingAddress(true);
            setAddressStatus("Buscando endereço no MaxSystem...");
            await enrichClientAddress(cpf, profile.tenant_id, (msg) => setAddressStatus(msg));
            setAddressStatus("");
            setEnrichingAddress(false);
            // Re-check: if still missing, open the dialog instead of falling into boleto_pendente
            const post = await checkRequiredFields();
            if (Object.keys(post.missing).length > 0) {
              setFoundFields(post.consolidated);
              setMissingFields(post.missing);
              setMissingFieldsOpen(true);
              setSubmitting(false);
              return;
            }
          }
        } catch (enrichErr) {
          console.warn("[address-enrichment] pre-flight failed (non-blocking):", enrichErr);
        } finally {
          setEnrichingAddress(false);
          setAddressStatus("");
        }
      }

      // Build custom installment maps for multiple entradas
      const customDates: Record<string, string> = {};
      const customValues: Record<string, number> = {};
      const validEntradas = entradas.filter(e => parseDecimal(e.value) > 0 && e.date);
      validEntradas.forEach((ent, idx) => {
        const key = idx === 0 ? "entrada" : `entrada_${idx + 1}`;
        customDates[key] = ent.date;
        customValues[key] = parseDecimal(ent.value);
        customValues[`${key}_method`] = ent.method as any;
      });

      // Persist payment method for each installment (so reopen restores formaPagto
      // and Edge Function can skip non-BOLETO installments)
      const nParc = typeof numParcelas === "number" ? numParcelas : 0;
      for (let i = 1; i <= nParc; i++) {
        customValues[`${i}_method`] = formaPagto as any;
      }

      const data: AgreementFormData = {
        client_cpf: cpf,
        client_name: clientName,
        credor,
        original_total: totals.totalOriginal,
        proposed_total: totals.totalAtualizado,
        discount_percent: totals.totalBruto > 0 ? Math.round((totals.descontoVal / totals.totalBruto) * 100 * 100) / 100 : 0,
        new_installments: typeof numParcelas === "number" ? numParcelas : 0,
        new_installment_value: (typeof numParcelas === "number" && numParcelas > 0) ? installmentValue : 0,
        first_due_date: firstDueDate || (validEntradas.length > 0 ? validEntradas[0].date : new Date().toISOString().split("T")[0]),
        entrada_value: numEntrada > 0 ? numEntrada : undefined,
        entrada_date: validEntradas.length > 0 ? validEntradas[0].date : undefined,
        custom_installment_dates: Object.keys(customDates).length > 0 ? customDates : undefined,
        custom_installment_values: Object.keys(customValues).length > 0 ? customValues : undefined,
        notes: notes || undefined,
      };

      const agreement = await createAgreement(data, user.id, profile.tenant_id, outOfStandard.isOut ? {
        requiresApproval: true,
        approvalReason: outOfStandard.reasons.join("; "),
      } : undefined);

      toast.success(outOfStandard.isOut ? "Solicitação de liberação enviada!" : "Acordo gravado com sucesso!");

      // If user explicitly chose "Pular (sem boleto)": mark as boleto_pendente and skip generation
      if (agreement && !outOfStandard.isOut && markBoletoPendente) {
        try {
          await supabase
            .from("agreements")
            .update({ boleto_pendente: true } as any)
            .eq("id", agreement.id);
          const { logAction } = await import("@/services/auditService");
          logAction({
            action: "acordo_criado_sem_boleto",
            entity_type: "agreement",
            entity_id: agreement.id,
            details: {
              cpf,
              credor,
              campos_faltantes: Object.keys(missingFields),
            },
          });
        } catch (e) {
          console.warn("Erro ao marcar boleto_pendente:", e);
        }
      }

      // Generate boletos in BACKGROUND (fire-and-forget) — modal closes immediately,
      // user is notified via toast when generation completes. UI atualiza via Realtime
      // na tabela negociarie_cobrancas (aba Acordos).
      if (agreement && !outOfStandard.isOut && !markBoletoPendente) {
        toast.info("Gerando boletos em segundo plano…");
        supabase.functions
          .invoke("generate-agreement-boletos", { body: { agreement_id: agreement.id } })
          .then(({ data: boletoResult, error: boletoError }) => {
            if (boletoError) {
              console.error("Boleto generation error:", boletoError);
              toast.error("Falha ao gerar boletos automaticamente. Use 'Reemitir boletos' na aba Acordos.");
              return;
            }
            if (boletoResult?.boleto_pendente) {
              toast.info("Boletos pendentes — preencha os dados cadastrais do cliente.");
              return;
            }
            const skipped = Number(boletoResult?.skipped_non_boleto || 0);
            const ok = Number(boletoResult?.success || 0);
            const fail = Number(boletoResult?.failed || 0);
            const skippedMsg = skipped > 0 ? ` ${skipped} parcela(s) Cartão/PIX serão cobradas via link de pagamento.` : "";
            if (ok > 0 && fail === 0) {
              toast.success(`${ok} boleto(s) gerado(s).${skippedMsg}`);
            } else if (ok > 0 && fail > 0) {
              toast.warning(`${ok} boleto(s) gerado(s), ${fail} falha(s).${skippedMsg}`);
            } else if (fail > 0) {
              toast.error(`Falha ao gerar boletos: ${boletoResult?.errors?.[0] || "Erro desconhecido"}`);
            } else if (skipped > 0) {
              toast.success(`Acordo criado. ${skipped} parcela(s) Cartão/PIX serão cobradas via link de pagamento.`);
            }
          })
          .catch((boletoErr: any) => {
            console.error("Boleto edge function error:", boletoErr);
            toast.error("Falha ao gerar boletos: " + (boletoErr?.message || "Erro desconhecido"));
          });
      }


      // Limpa rascunho e fecha o fluxo IMEDIATAMENTE — geração roda em background
      clearDraft();
      onAgreementCreated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gravar acordo");
    } finally {
      setSubmitting(false);
      setEnrichingAddress(false);
      setAddressStatus("");
    }
  };

  const copyTitles = async () => {
    const selected = pendentes.filter((c) => selectedIds.has(c.id));
    const text = selected.map((c) => `${c.numero_parcela}/${c.total_parcelas} - ${formatDate(c.data_vencimento)} - ${formatCurrency(Number(c.valor_parcela) || 0)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTitles(true);
      toast.success("Títulos copiados!");
      setTimeout(() => setCopiedTitles(false), 1500);
    } catch {
      toast.error("Falha ao copiar");
    }
  };

  const simulatedTotal = simulatedInstallments.reduce((s, i) => s + i.value, 0);

  return (
    <div className="flex flex-col overflow-y-scroll flex-1 min-h-0 gap-2 pr-1">
      {hasActiveAgreement && (
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>
            Este cliente já possui um acordo vigente. Cancele o anterior para criar um novo.
          </AlertDescription>
        </Alert>
      )}

      {draftRestoreOpen && draft && !draftDismissed && (
        <Alert className="border-primary/40 bg-primary/5">
          <RotateCcw className="w-4 h-4" />
          <AlertDescription className="flex items-center justify-between gap-3 w-full">
            <span className="text-sm">
              Há um rascunho deste acordo salvo às{" "}
              <strong>
                {new Date(draft.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </strong>
              . Deseja restaurar?
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="button" size="sm" variant="default" onClick={restoreDraft} className="h-7 px-3 text-xs">
                Restaurar
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={discardDraft} className="h-7 px-2 text-xs">
                <XIcon className="w-3.5 h-3.5 mr-1" />
                Descartar
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* ── Section 1: Parameters Bar ── */}
      <Card className="flex-shrink-0">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Cálculo
            </CardTitle>
            <div className="flex items-center gap-1">
              <SimpleCalculator />
              <Button variant="ghost" size="sm" onClick={copyTitles} className="gap-1 text-xs">
                {copiedTitles ? <CheckCircle2 className="w-3 h-3 text-success animate-scale-in" /> : <Copy className="w-3 h-3" />}
                {copiedTitles ? "Copiado!" : "Copiar Títulos"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-0.5 min-w-[120px]">
              <Label className="text-[10px]">Data Cálculo</Label>
              <Input type="date" value={calcDate} onChange={(e) => setCalcDate(e.target.value)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Juros</Label>
              <Input type="text" inputMode="decimal" value={jurosPercent} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.,]/g, ""); const v = Number(raw.replace(",", ".")); if (raw !== "" && isNaN(v)) return; setJurosPercent(raw); }} onBlur={() => setJurosPercent(prev => prev === "" ? "0" : prev)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Multa</Label>
              <Input type="text" inputMode="decimal" value={multaPercent} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.,]/g, ""); const v = Number(raw.replace(",", ".")); if (raw !== "" && isNaN(v)) return; setMultaPercent(raw); }} onBlur={() => setMultaPercent(prev => prev === "" ? "0" : prev)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Honor.</Label>
              <Input type="text" inputMode="decimal" value={honorariosPercent} onChange={(e) => { const raw = e.target.value.replace(/[^0-9.,]/g, ""); const v = Number(raw.replace(",", ".")); if (raw !== "" && isNaN(v)) return; setHonorariosPercent(raw); }} onBlur={() => setHonorariosPercent(prev => prev === "" ? "0" : prev)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[80px]">
              <Label className="text-[10px]">% Desc.</Label>
              <Input type="text" inputMode="decimal" value={descontoPercent} onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.,]/g, "");
                if (raw === "") { setDescontoPercent(""); setDescontoReais(""); setDiscountSource("percent"); return; }
                const pct = Number(raw.replace(",", "."));
                if (isNaN(pct)) return;
                setDescontoPercent(raw);
                setDiscountSource("percent");
                const bruto = rowCalcs.filter((r) => selectedIds.has(r.id)).reduce((s, r) => s + r.total, 0);
                setDescontoReais(bruto > 0 ? String(Math.round(bruto * (pct / 100) * 100) / 100) : "0");
              }} onBlur={() => setDescontoPercent(prev => prev === "" ? "0" : prev)} className="h-7 text-xs px-2" />
            </div>
            <div className="space-y-0.5 w-[100px]">
              <Label className="text-[10px]">R$ Desc.</Label>
              <Input type="text" inputMode="decimal" value={descontoReais} onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.,]/g, "");
                if (raw === "") { setDescontoReais(""); setDescontoPercent(""); setDiscountSource("amount"); return; }
                const val = Number(raw.replace(",", "."));
                if (isNaN(val)) return;
                setDescontoReais(raw);
                setDiscountSource("amount");
                const bruto = rowCalcs.filter((r) => selectedIds.has(r.id)).reduce((s, r) => s + r.total, 0);
                setDescontoPercent(bruto > 0 ? String(Math.round((val / bruto) * 100 * 100) / 100) : "0");
              }} onBlur={() => setDescontoReais(prev => prev === "" ? "0" : prev)} className="h-7 text-xs px-2" />
            </div>
            {credorRules?.indice_correcao_monetaria && (
              <div className="flex items-center gap-1.5 whitespace-nowrap border border-border rounded-md px-2 py-1.5 bg-muted/50">
                <span className="text-[10px] text-muted-foreground">Índice</span>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{credorRules.indice_correcao_monetaria}</Badge>
              </div>
            )}
            <div className="flex items-center gap-2 whitespace-nowrap border border-primary/30 rounded-md px-3 py-1.5 bg-primary/10 ml-auto">
              <span className="text-xs font-medium text-muted-foreground">VALOR ATUALIZADO</span>
              <span className="text-lg font-bold text-primary">{formatCurrency(totals.totalAtualizado)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Two-column — Form + Simulation ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Agreement Form */}
        <Card className="flex flex-col">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-sm">Condições do Acordo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-3">
            {/* Dynamic entradas */}
            {entradas.map((ent, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_auto_auto] gap-2 items-end">
                <div className="space-y-0.5">
                  <Label className="text-[10px]">{entradas.length > 1 ? `Data Entrada ${idx + 1}` : "Data Entrada"}</Label>
                  <Input type="date" value={ent.date} onChange={(e) => {
                    const next = [...entradas];
                    next[idx] = { ...next[idx], date: e.target.value };
                    setEntradas(next);
                  }} className="h-7 text-xs px-2" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px]">{entradas.length > 1 ? `Valor Entrada ${idx + 1}` : "Valor Entrada"}</Label>
                  <Input type="text" inputMode="decimal" value={ent.value} onChange={(e) => {
                    const raw = e.target.value.replace(/[^0-9.,]/g, "");
                    const v = Number(raw.replace(",", "."));
                    if (raw !== "" && isNaN(v)) return;
                    const next = [...entradas];
                    next[idx] = { ...next[idx], value: raw };
                    setEntradas(next);
                  }} onBlur={() => {
                    const next = [...entradas];
                    next[idx] = { ...next[idx], value: next[idx].value === "" ? "0" : next[idx].value };
                    setEntradas(next);
                  }} className="h-7 text-xs px-2" placeholder="0,00" />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[10px]">{entradas.length > 1 ? `Pagto ${idx + 1}` : "Pagto Entrada"}</Label>
                  <Select value={ent.method} onValueChange={(val) => {
                    const next = [...entradas];
                    next[idx] = { ...next[idx], method: val };
                    setEntradas(next);
                  }}>
                    <SelectTrigger className="h-7 text-xs min-w-[90px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="PIX">Pix</SelectItem>
                      <SelectItem value="CARTAO">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-1 pb-0.5">
                  {entradas.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEntradas(entradas.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  )}
                  {idx === entradas.length - 1 && (
                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEntradas([...entradas, { date: "", value: "0", method: "BOLETO" }])}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Parcelas</Label>
                <Input type="text" inputMode="numeric" value={numParcelas} onChange={(e) => { const v = e.target.value.replace(/[^0-9]/g, ""); setNumParcelas(v === "" ? "" : Number(v)); }} onBlur={() => setNumParcelas(prev => prev === "" ? 0 : prev)} className="h-7 text-xs px-2" />
              </div>
            </div>
            {(typeof numParcelas === "number" && numParcelas > 0) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Pagto Parcelas</Label>
                <Select value={formaPagto} onValueChange={setFormaPagto}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="PIX">Pix</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Intervalo</Label>
                <Select value={intervalo} onValueChange={setIntervalo}>
                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mensal">Mensal</SelectItem>
                    <SelectItem value="quinzenal">Quinzenal</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Vencto 1ª Parc.</Label>
                <Input type="date" value={firstDueDate} onChange={(e) => setFirstDueDate(e.target.value)} className="h-7 text-xs px-2" />
              </div>
            </div>
            )}
            <div className="space-y-0.5">
              <Label className="text-[10px]">Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas..." rows={1} className="text-xs min-h-[28px]" />
            </div>
            <Button onClick={handleSimulate} className="w-full gap-2 h-8 text-xs bg-green-600 hover:bg-green-700 text-white" disabled={selectedIds.size === 0}>
              <Play className="w-3 h-3" />
              SIMULAR
            </Button>
          </CardContent>
        </Card>

        {/* Right: Simulation Results */}
        <Card className={`transition-opacity ${simulated ? "opacity-100" : "opacity-40"} flex flex-col overflow-hidden`}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {simulated ? "Simulação do Acordo" : "Clique em SIMULAR"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
            {simulated && simulatedInstallments.length > 0 ? (
              <>
                <div className="overflow-y-auto overflow-x-auto max-h-[30vh] flex-1 min-h-0">
                  <Table>
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow className="bg-muted/50 text-[11px]">
                        <TableHead className="px-3">Parcela</TableHead>
                        <TableHead className="px-3">Forma Pagto</TableHead>
                        <TableHead className="px-3">Vencimento</TableHead>
                        <TableHead className="px-3 text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {simulatedInstallments.map((inst, idx) => (
                        <TableRow key={`${inst.number}-${idx}`} className="text-xs">
                          <TableCell className="px-3 font-medium">
                            {inst.number === 0 ? (inst.label || "Entrada") : `${String(inst.number).padStart(2, "0")}/${String(numParcelas).padStart(2, "0")}`}
                          </TableCell>
                          <TableCell className="px-3">
                            <Badge variant="outline" className="text-[10px]">{inst.method}</Badge>
                          </TableCell>
                          <TableCell className="px-3">{formatDate(inst.dueDate)}</TableCell>
                          <TableCell className="px-3 text-right font-medium">{formatCurrency(inst.value)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t-2 bg-emerald-50 dark:bg-emerald-950/30 shrink-0">
                  <Table>
                    <TableBody>
                      <TableRow className="text-xs font-bold hover:bg-transparent">
                        <TableCell colSpan={3} className="px-3 text-right">Total do Acordo:</TableCell>
                        <TableCell className="px-3 text-right text-emerald-700 dark:text-emerald-400 text-sm">
                          {formatCurrency(simulatedTotal)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground text-xs">
                Preencha as condições e clique em <strong>SIMULAR</strong> para visualizar as parcelas.
              </div>
            )}
          </CardContent>
        </Card>
      </div>



      {/* ── Actions Bar ── */}
      {outOfStandard.isOut && (
        <Alert variant="destructive" className="border-orange-300 bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-300">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription className="text-xs">
            <strong>Acordo fora do padrão:</strong> {outOfStandard.reasons.join("; ")}.
            Será enviado para liberação.
          </AlertDescription>
        </Alert>
      )}

      {(enrichingAddress || generatingBoletos) && (
        <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 animate-fade-in">
          <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {generatingBoletos ? "Gerando boletos..." : "Validando dados do cliente..."}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {generatingBoletos
                ? "Aguarde enquanto emitimos os boletos no gateway."
                : "Estamos confirmando endereço e contato antes de formalizar o acordo."}
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          onClick={handleSubmit}
          disabled={submitting || generatingBoletos || enrichingAddress || !simulated || hasActiveAgreement}
          className="flex-1 gap-2 transition-opacity disabled:opacity-60"
          size="lg"
          variant={outOfStandard.isOut ? "outline" : "default"}
        >
          {submitting || generatingBoletos || enrichingAddress ? <Loader2 className="w-4 h-4 animate-spin" /> : outOfStandard.isOut ? <AlertTriangle className="w-4 h-4" /> : <FileCheck className="w-4 h-4" />}
          {generatingBoletos
            ? "Gerando boletos..."
            : enrichingAddress
              ? "Validando dados..."
              : submitting
                ? "Gravando..."
                : outOfStandard.isOut
                  ? "SOLICITAR LIBERAÇÃO"
                  : "GRAVAR ACORDO"}
        </Button>
      </div>

      {/* ── Section 2: Expanded Titles Table ── */}
      <Card className="flex-shrink-0">
        <CardContent className="p-0">
          {pendentes.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {hasActiveAgreement
                ? "Todos os títulos deste credor estão vinculados ao acordo vigente. Cancele o acordo existente para renegociar."
                : "Nenhum título pendente"}
            </div>
          ) : (
            <Collapsible open={titlesOpen} onOpenChange={setTitlesOpen}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm table-fixed">
                  <colgroup>
                    <col className="w-8" />
                    <col className="w-[60px]" />
                    <col className="w-[90px]" />
                    <col className="w-[55px]" />
                    <col className="w-[85px]" />
                    <col className="w-[80px]" />
                    <col className="w-[85px]" />
                    <col className="w-[75px]" />
                    <col className="w-[75px]" />
                    <col className="w-[80px]" />
                    <col className="w-[90px]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-muted/50 text-[11px] border-b">
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground">
                        <Checkbox checked={selectedIds.size === pendentes.length && pendentes.length > 0} onCheckedChange={toggleAll} />
                      </th>
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground">Parc</th>
                      <th className="px-2 py-2 text-left font-medium text-muted-foreground">Vencimento</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Atraso</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">V. Bruto</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">V. Pago</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Saldo</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Juros</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Multa</th>
                      <th className="px-2 py-2 text-right font-medium text-muted-foreground">Honorários</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground">
                        <CollapsibleTrigger asChild>
                          <button className="inline-flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ml-auto">
                            Total
                            <ChevronDown className={`h-3.5 w-3.5 text-orange-500 transition-transform ${titlesOpen ? "rotate-180" : ""}`} />
                          </button>
                        </CollapsibleTrigger>
                      </th>
                    </tr>
                  </thead>

                  <CollapsibleContent asChild>
                    <tbody>
                      <tr>
                        <td colSpan={11} className="p-0">
                          <div className="max-h-[25vh] overflow-y-auto">
                            <table className="w-full table-fixed">
                              <colgroup>
                                <col className="w-8" />
                                <col className="w-[60px]" />
                                <col className="w-[90px]" />
                                <col className="w-[55px]" />
                                <col className="w-[85px]" />
                                <col className="w-[80px]" />
                                <col className="w-[85px]" />
                                <col className="w-[75px]" />
                                <col className="w-[75px]" />
                                <col className="w-[80px]" />
                                <col className="w-[90px]" />
                              </colgroup>
                              <tbody>
                                {pendentes.map((c, idx) => {
                                  const row = rowCalcs[idx];
                                  const isSelected = selectedIds.has(c.id);
                                  const valorBruto = Number(c.valor_parcela) || Number(c.valor_saldo) || 0;
                                  return (
                                    <tr key={c.id} className={`text-xs border-b border-border ${isSelected ? "bg-primary/5" : "opacity-50"}`}>
                                      <td className="px-2 py-1.5">
                                        <Checkbox checked={isSelected} onCheckedChange={() => toggleId(c.id)} />
                                      </td>
                                      <td className="px-2 py-1.5 font-medium">{c.numero_parcela}/{c.total_parcelas}</td>
                                      <td className="px-2 py-1.5">{formatDate(c.data_vencimento)}</td>
                                      <td className="px-2 py-1.5 text-right text-muted-foreground">{row.atraso}</td>
                                      <td className="px-2 py-1.5 text-right">{formatCurrency(valorBruto)}</td>
                                      <td className="px-2 py-1.5 text-right text-blue-600 dark:text-blue-400">{formatCurrency(row.valorPago)}</td>
                                      <td className="px-2 py-1.5 text-right font-medium">{formatCurrency(row.valorOriginal)}</td>
                                      <td className="px-2 py-1.5 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.jurosVal)}</td>
                                      <td className="px-2 py-1.5 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.multaVal)}</td>
                                      <td className="px-2 py-1.5 text-right text-orange-600 dark:text-orange-400">{formatCurrency(row.honorariosVal)}</td>
                                      <td className="px-2 py-1.5 text-right font-semibold">{formatCurrency(row.total)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </CollapsibleContent>

                  <tfoot>
                    <tr className="bg-muted/30 text-xs font-semibold border-t-2">
                      <td className="px-2 py-2" />
                      <td colSpan={3} className="px-2 py-2 text-right">Totais ({selectedIds.size} títulos)</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">—</td>
                      <td className="px-2 py-2 text-right">{formatCurrency(totals.totalOriginal)}</td>
                      <td className="px-2 py-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalJuros)}</td>
                      <td className="px-2 py-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalMulta)}</td>
                      <td className="px-2 py-2 text-right text-orange-600 dark:text-orange-400">{formatCurrency(totals.totalHonorarios)}</td>
                      <td className="px-2 py-2 text-right font-semibold">{formatCurrency(totals.totalBruto)}</td>
                    </tr>
                    {parseDecimal(descontoPercent) > 0 && (
                      <tr className="text-xs border-t">
                        <td colSpan={10} className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400">Desconto ({parseDecimal(descontoPercent)}%)</td>
                        <td className="px-2 py-2 text-right text-emerald-600 dark:text-emerald-400 font-semibold">- {formatCurrency(totals.descontoVal)}</td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </Collapsible>
          )}
        </CardContent>
      </Card>


      <Dialog open={missingFieldsOpen} onOpenChange={(open) => {
        if (!open) {
          setMissingFieldsOpen(false);
          setPendingAgreement(null);
          onAgreementCreated();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
              Quase lá! Complete os dados para gerar o boleto
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O acordo foi criado com sucesso. {Object.keys(missingFields).length === 1
              ? "Apenas o campo abaixo precisa ser preenchido para gerar o boleto:"
              : "Preencha os campos faltantes abaixo para gerar os boletos:"}
          </p>

          {/* Show found fields */}
          {(() => {
            const labelMap: Record<string, string> = {
              email: "E-mail", phone: "Telefone", cep: "CEP",
              endereco: "Endereço", bairro: "Bairro", cidade: "Cidade", uf: "UF",
            };
            const found = Object.entries(foundFields).filter(([key, val]) => val && !missingFields.hasOwnProperty(key));
            return found.length > 0 ? (
              <div className="bg-muted/50 rounded-md p-3 space-y-1">
                <p className="text-[10px] uppercase font-medium text-muted-foreground mb-1">Dados encontrados</p>
                {found.map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-3 h-3 text-green-600 flex-shrink-0" />
                    <span className="text-muted-foreground">{labelMap[key] || key}:</span>
                    <span className="font-medium truncate">{String(val)}</span>
                  </div>
                ))}
              </div>
            ) : null;
          })()}

          <div className="space-y-3 py-2">
            <p className="text-[10px] uppercase font-medium text-muted-foreground">Campos faltantes</p>
            {Object.keys(missingFields).map((field) => {
              const labelMap: Record<string, string> = {
                email: "E-mail", phone: "Telefone", cep: "CEP",
                endereco: "Endereço", bairro: "Bairro", cidade: "Cidade", uf: "UF",
              };
              const isCep = field === "cep";
              return (
                <div key={field} className="space-y-1">
                  <Label className="text-xs font-medium">{labelMap[field] || field}</Label>
                  <div className="relative">
                    <Input
                      value={missingFields[field]}
                      onChange={(e) => setMissingFields((prev) => ({ ...prev, [field]: e.target.value }))}
                      onBlur={isCep ? async (e) => {
                        const cepVal = e.target.value;
                        if ((cepVal || "").replace(/\D/g, "").length !== 8) return;
                        setCepLookupLoading(true);
                        try {
                          const { lookupCep } = await import("@/lib/viaCep");
                          const data = await lookupCep(cepVal);
                          if (data) {
                            setMissingFields((prev) => ({
                              ...prev,
                              endereco: prev.endereco || data.logradouro || "",
                              bairro: prev.bairro || data.bairro || "",
                              cidade: prev.cidade || data.localidade || "",
                              uf: prev.uf || data.uf || "",
                            }));
                          }
                        } finally {
                          setCepLookupLoading(false);
                        }
                      } : undefined}
                      placeholder={`Informe o ${(labelMap[field] || field).toLowerCase()}`}
                      className="h-9"
                    />
                    {isCep && cepLookupLoading && (
                      <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={async () => {
              // Mark agreement as boleto_pendente
              if (pendingAgreement?.id) {
                try {
                  await supabase
                    .from("agreements")
                    .update({ boleto_pendente: true } as any)
                    .eq("id", pendingAgreement.id);
                  const { logAction } = await import("@/services/auditService");
                  logAction({
                    action: "acordo_criado_sem_boleto",
                    entity_type: "agreement",
                    entity_id: pendingAgreement.id,
                    details: {
                      cpf,
                      credor,
                      campos_faltantes: Object.keys(missingFields),
                    },
                  });
                } catch (e) {
                  console.warn("Erro ao marcar boleto_pendente:", e);
                }
              }
              setMissingFieldsOpen(false);
              setPendingAgreement(null);
              onAgreementCreated();
            }}>
              Pular (sem boleto)
            </Button>
            <Button onClick={handleSaveMissingFields} disabled={savingMissingFields}>
              {savingMissingFields ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar e Gerar Boletos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmação obrigatória antes de formalizar ── */}
      <AlertDialog open={confirmOpen} onOpenChange={(o) => { if (!submitting && !enrichingAddress && !generatingBoletos) setConfirmOpen(o); }}>
        <AlertDialogContent
          className="max-w-lg"
          onEscapeKeyDown={(e) => { if (submitting || enrichingAddress || generatingBoletos) e.preventDefault(); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Confirmar formalização do acordo
            </AlertDialogTitle>
            <AlertDialogDescription>
              Revise os dados antes de gravar. Esta ação irá criar o acordo
              {outOfStandard.isOut ? " (com solicitação de liberação)" : " e gerar os boletos"}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid grid-cols-2 gap-3 text-sm py-2">
            <div className="col-span-2 rounded-md border bg-muted/40 p-3">
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Cliente</p>
              <p className="font-semibold truncate">{clientName}</p>
              <p className="text-xs text-muted-foreground">CPF: {formatCPF(cpf)}</p>
              <p className="text-xs text-muted-foreground">Credor: {credor}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Valor original</p>
              <p className="font-semibold">{formatCurrency(totals.totalOriginal)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Valor proposto</p>
              <p className="font-semibold text-primary">{formatCurrency(totals.totalAtualizado)}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Desconto</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totals.descontoVal)}
                {totals.totalBruto > 0 && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({Math.round((totals.descontoVal / totals.totalBruto) * 100 * 10) / 10}%)
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Entrada</p>
              <p className="font-semibold">{numEntrada > 0 ? formatCurrency(numEntrada) : "—"}</p>
            </div>

            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Parcelas</p>
              <p className="font-semibold">
                {(typeof numParcelas === "number" && numParcelas > 0)
                  ? `${numParcelas}x de ${formatCurrency(installmentValue)}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-medium text-muted-foreground">1º Vencimento</p>
              <p className="font-semibold">
                {firstDueDate
                  ? formatDate(firstDueDate)
                  : (entradas.find(e => e.date)?.date ? formatDate(entradas.find(e => e.date)!.date) : "—")}
              </p>
            </div>

            <div className="col-span-2">
              <p className="text-[10px] uppercase font-medium text-muted-foreground">Forma de pagamento</p>
              <p className="font-semibold">
                {(typeof numParcelas === "number" && numParcelas > 0) ? formaPagto : entradas[0]?.method || "—"}
              </p>
            </div>

            {outOfStandard.isOut && (
              <div className="col-span-2 rounded-md border border-orange-300 bg-orange-50 dark:bg-orange-950/20 p-2">
                <p className="text-xs text-orange-800 dark:text-orange-300">
                  <strong>Fora do padrão:</strong> {outOfStandard.reasons.join("; ")}.
                </p>
              </div>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Esta ação não pode ser desfeita automaticamente.
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting || enrichingAddress || generatingBoletos} autoFocus>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting || enrichingAddress || generatingBoletos}
              onClick={(e) => {
                e.preventDefault();
                setConfirmOpen(false);
                void handleConfirmedSubmit();
              }}
            >
              {submitting || enrichingAddress || generatingBoletos
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Processando...</>
                : "Confirmar e Formalizar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AgreementCalculator;
