import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { upsertCredor } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, Copy, Upload, ImageIcon, FileText, Bold, Italic, Underline, Heading1, Heading2, List, Type, Link } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import CredorReguaTab from "./CredorReguaTab";
import AtendimentoFieldsConfig from "./AtendimentoFieldsConfig";
import CustomFieldsConfig from "./CustomFieldsConfig";
import CredorScriptsTab from "./CredorScriptsTab";
import CredorDebtorCategoriesConfig from "./CredorDebtorCategoriesConfig";
import CredorDocumentTemplates from "./CredorDocumentTemplates";
import TipoDividaList from "./TipoDividaList";
import PaymentMethodsConfig from "./PaymentMethodsConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

const BANCOS = ["Banco do Brasil", "Itaú", "Bradesco", "Santander", "Caixa Econômica", "Nubank", "Inter", "Sicoob", "Sicredi", "Safra", "BTG Pactual", "Outro"];
const GATEWAYS = ["Negociarie", "Asaas", "Mercado Pago", "PagSeguro", "Outro"];

import { TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";

const VARIAVEIS = [
  "{nome_devedor}", "{cpf_devedor}", "{valor_divida}", "{valor_acordo}", "{quantidade_parcelas}",
  "{valor_parcela}", "{data_vencimento}", "{desconto_concedido}", "{razao_social_credor}", "{cnpj_credor}",
  "{data_atual}", "{valor_pago}", "{numero_parcela}", "{total_parcelas}", "{data_acordo}", "{data_pagamento}",
];

interface CredorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any;
}

const FORMATTING_TOOLS = [
  { icon: Bold, label: "Negrito", prefix: "**", suffix: "**" },
  { icon: Italic, label: "Itálico", prefix: "_", suffix: "_" },
  { icon: Underline, label: "Sublinhado", prefix: "__", suffix: "__" },
  { icon: Heading1, label: "Título 1", prefix: "# ", suffix: "" },
  { icon: Heading2, label: "Título 2", prefix: "## ", suffix: "" },
  { icon: List, label: "Lista", prefix: "• ", suffix: "" },
  { icon: Type, label: "Texto Grande", prefix: "### ", suffix: "" },
];

const CredorForm = ({ open, onOpenChange, editing }: CredorFormProps) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<any>({});
  const [honorarios, setHonorarios] = useState<any[]>([]);
  const [openTemplateDialog, setOpenTemplateDialog] = useState<string | null>(null);
  const [enderecoOpen, setEnderecoOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (open) {
      setOpenTemplateDialog(null);
      if (editing) {
        const editData = { ...editing };
        // Item 1: fallback to defaults for empty templates
        Object.entries(TEMPLATE_DEFAULTS).forEach(([key, defaultVal]) => {
          if (!editData[key]) editData[key] = defaultVal;
        });
        setForm(editData);
        setHonorarios(editing.honorarios_grade || []);
        setEnderecoOpen(!!(editing.cep || editing.endereco || editing.numero || editing.bairro || editing.cidade || editing.uf));
      } else {
        setForm({
          status: "ativo", tipo_conta: "corrente", gateway_ambiente: "producao", gateway_status: "ativo",
          parcelas_min: 1, parcelas_max: 12, entrada_minima_valor: 0, entrada_minima_tipo: "percent",
          desconto_maximo: 0, juros_mes: 0, multa: 0,
          ...Object.fromEntries(Object.entries(TEMPLATE_DEFAULTS).map(([k, v]) => [k, v])),
        });
        setHonorarios([]);
      }
    }
  }, [open, editing]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const applyMask = (value: string, mask: "cnpj" | "phone") => {
    const n = value.replace(/\D/g, "");
    if (mask === "cnpj") {
      return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5").slice(0, 18);
    }
    return n.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => upsertCredor(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["credores"] }); toast.success("Credor salvo!"); onOpenChange(false); },
    onError: () => toast.error("Erro ao salvar credor"),
  });

  const [savingGrade, setSavingGrade] = useState(false);
  const [savingAging, setSavingAging] = useState(false);
  const [savingNegociacao, setSavingNegociacao] = useState(false);

  const handleSaveNegociacao = async () => {
    if (!editing?.id) return;
    setSavingNegociacao(true);
    try {
      const { error } = await supabase
        .from("credores" as any)
        .update({
          parcelas_min: parseInt(form.parcelas_min) || 1,
          parcelas_max: parseInt(form.parcelas_max) || 12,
          entrada_minima_valor: parseFloat(form.entrada_minima_valor) || 0,
          entrada_minima_tipo: form.entrada_minima_tipo || "percent",
          desconto_maximo: parseFloat(form.desconto_maximo) || 0,
          juros_mes: parseFloat(form.juros_mes) || 0,
          multa: parseFloat(form.multa) || 0,
          prazo_dias_acordo: parseInt(form.prazo_dias_acordo) || 30,
          indice_correcao_monetaria: form.indice_correcao_monetaria || null,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["credores"] });
      toast.success("Regras de negociação salvas!");
    } catch {
      toast.error("Erro ao salvar regras");
    } finally {
      setSavingNegociacao(false);
    }
  };

  const handleSaveGrade = async () => {
    if (!editing?.id) return;
    setSavingGrade(true);
    try {
      await upsertCredor({ id: editing.id, tenant_id: tenant!.id, honorarios_grade: honorarios });
      queryClient.invalidateQueries({ queryKey: ["credores"] });
      toast.success("Grade de honorários salva!");
    } catch {
      toast.error("Erro ao salvar grade");
    } finally {
      setSavingGrade(false);
    }
  };

  const handleSaveAgingTiers = async () => {
    if (!editing?.id) return;
    setSavingAging(true);
    try {
      await upsertCredor({ id: editing.id, tenant_id: tenant!.id, aging_discount_tiers: agingTiers });
      queryClient.invalidateQueries({ queryKey: ["credores"] });
      toast.success("Faixas de aging salvas!");
    } catch {
      toast.error("Erro ao salvar faixas");
    } finally {
      setSavingAging(false);
    }
  };

  const handleSave = () => {
    if (!form.razao_social?.trim()) { toast.error("Razão Social obrigatória"); return; }
    if (!form.cnpj?.replace(/\D/g, "") || form.cnpj.replace(/\D/g, "").length < 14) { toast.error("CNPJ inválido"); return; }
    saveMutation.mutate({
      ...(editing?.id ? { id: editing.id } : {}),
      tenant_id: tenant!.id,
      ...form,
      cnpj: form.cnpj?.replace(/\D/g, ""),
      honorarios_grade: honorarios,
      aging_discount_tiers: agingTiers,
    });
  };

  const addHonorario = () => setHonorarios(prev => [...prev, { faixa: "", honorario: 0, valor_fixo: 0 }]);
  const removeHonorario = (i: number) => setHonorarios(prev => prev.filter((_, idx) => idx !== i));
  const updateHonorario = (i: number, key: string, val: any) => setHonorarios(prev => prev.map((h, idx) => idx === i ? { ...h, [key]: val } : h));

  const insertVariable = (field: string, variable: string) => {
    const ta = textareaRefs.current[field];
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const text = form[field] || "";
      const newText = text.substring(0, start) + variable + text.substring(end);
      set(field, newText);
      setTimeout(() => {
        ta.focus();
        ta.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      set(field, (form[field] || "") + variable);
    }
  };

  const applyFormatting = (field: string, prefix: string, suffix: string) => {
    const ta = textareaRefs.current[field];
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const text = form[field] || "";
    const selected = text.substring(start, end);
    const replacement = selected ? `${prefix}${selected}${suffix}` : `${prefix}texto${suffix}`;
    const newText = text.substring(0, start) + replacement + text.substring(end);
    set(field, newText);
    setTimeout(() => {
      ta.focus();
      const cursorPos = start + replacement.length;
      ta.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const [agingTiers, setAgingTiers] = useState<any[]>([]);

  useEffect(() => {
    if (open && editing) {
      setAgingTiers(editing.aging_discount_tiers || []);
    } else if (open) {
      setAgingTiers([]);
    }
  }, [open, editing]);

  const addAgingTier = () => setAgingTiers(prev => [...prev, { min_days: 0, max_days: 59, discount_percent: 0 }]);
  const removeAgingTier = (i: number) => setAgingTiers(prev => prev.filter((_, idx) => idx !== i));
  const updateAgingTier = (i: number, key: string, val: any) => setAgingTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [key]: val } : t));

  const TEMPLATES = [
    { key: "template_acordo", label: "Carta de Acordo" },
    { key: "template_recibo", label: "Recibo de Pagamento" },
    { key: "template_quitacao", label: "Carta de Quitação" },
    { key: "template_descricao_divida", label: "Descrição de Dívida" },
    { key: "template_notificacao_extrajudicial", label: "Notificação Extrajudicial" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>{editing ? "Editar Credor" : "Novo Credor"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
        <TabsList className="w-full flex-wrap">
            <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="bancario" className="flex-1">Bancário</TabsTrigger>
            <TabsTrigger value="negociacao" className="flex-1">Negociação</TabsTrigger>
            <TabsTrigger value="regua" className="flex-1">Régua</TabsTrigger>
            <TabsTrigger value="personalizacao" className="flex-1">Personalização</TabsTrigger>
            <TabsTrigger value="assinatura" className="flex-1">Assinatura</TabsTrigger>
            <TabsTrigger value="portal" className="flex-1">Portal</TabsTrigger>
          </TabsList>

          {/* ABA 1 - DADOS CADASTRAIS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Razão Social *</Label><Input value={form.razao_social || ""} onChange={e => set("razao_social", e.target.value)} /></div>
              <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia || ""} onChange={e => set("nome_fantasia", e.target.value)} /></div>
              <div><Label>CNPJ *</Label><Input value={applyMask(form.cnpj || "", "cnpj")} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual || ""} onChange={e => set("inscricao_estadual", e.target.value)} /></div>
              <div><Label>Contato Responsável</Label><Input value={form.contato_responsavel || ""} onChange={e => set("contato_responsavel", e.target.value)} /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} /></div>
              <div><Label>Telefone *</Label><Input value={applyMask(form.telefone || "", "phone")} onChange={e => set("telefone", e.target.value)} placeholder="(00) 00000-0000" /></div>
            </div>



            <Collapsible
              open={enderecoOpen}
              onOpenChange={setEnderecoOpen}
              className="border-t border-border pt-4"
            >
              <CollapsibleTrigger className="flex items-center gap-2 w-full cursor-pointer group">
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${enderecoOpen ? "rotate-0" : "-rotate-90"}`} />
                <p className="text-sm font-medium text-foreground">Endereço</p>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-3 gap-4">
                  <div><Label>CEP</Label><Input value={form.cep || ""} onChange={e => set("cep", e.target.value)} /></div>
                  <div className="col-span-2"><Label>Rua</Label><Input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} /></div>
                  <div><Label>Número</Label><Input value={form.numero || ""} onChange={e => set("numero", e.target.value)} /></div>
                  <div><Label>Complemento</Label><Input value={form.complemento || ""} onChange={e => set("complemento", e.target.value)} /></div>
                  <div><Label>Bairro</Label><Input value={form.bairro || ""} onChange={e => set("bairro", e.target.value)} /></div>
                  <div><Label>Cidade</Label><Input value={form.cidade || ""} onChange={e => set("cidade", e.target.value)} /></div>
                  <div><Label>UF</Label><Input value={form.uf || ""} onChange={e => set("uf", e.target.value)} maxLength={2} /></div>
                </div>
              </CollapsibleContent>
            </Collapsible>

          </TabsContent>

          {/* ABA 2 - BANCÁRIO / GATEWAY - Item 9: removed footer message */}
          <TabsContent value="bancario" className="space-y-4 mt-4">
            <p className="text-sm font-medium text-foreground">Dados Bancários</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Banco</Label>
                <Select value={form.banco || ""} onValueChange={v => set("banco", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Agência</Label><Input value={form.agencia || ""} onChange={e => set("agencia", e.target.value)} /></div>
              <div><Label>Conta</Label><Input value={form.conta || ""} onChange={e => set("conta", e.target.value)} /></div>
              <div>
                <Label>Tipo de Conta</Label>
                <Select value={form.tipo_conta || "corrente"} onValueChange={v => set("tipo_conta", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Chave PIX</Label><Input value={form.pix_chave || ""} onChange={e => set("pix_chave", e.target.value)} /></div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Gateway de Pagamento</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gateway Ativo</Label>
                  <Select value={form.gateway_ativo || ""} onValueChange={v => set("gateway_ativo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{GATEWAYS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Token / API Key</Label><Input value={form.gateway_token || ""} onChange={e => set("gateway_token", e.target.value)} type="password" /></div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={form.gateway_ambiente || "producao"} onValueChange={v => set("gateway_ambiente", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="producao">Produção</SelectItem><SelectItem value="homologacao">Homologação</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.gateway_status || "ativo"} onValueChange={v => set("gateway_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ABA 3 - NEGOCIAÇÃO */}
          <TabsContent value="negociacao" className="space-y-6 mt-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-foreground">Regras de Acordo</p>
                {editing?.id && (
                  <Button size="sm" variant="default" onClick={handleSaveNegociacao} disabled={savingNegociacao}>
                    {savingNegociacao ? "Salvando..." : "Salvar Regras"}
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Parcelas Mínimas</Label><Input type="number" value={form.parcelas_min ?? ""} onChange={e => set("parcelas_min", e.target.value === "" ? "" : parseInt(e.target.value))} onBlur={() => set("parcelas_min", parseInt(form.parcelas_min) || 1)} /></div>
                <div><Label>Parcelas Máximas</Label><Input type="number" value={form.parcelas_max ?? ""} onChange={e => set("parcelas_max", e.target.value === "" ? "" : parseInt(e.target.value))} onBlur={() => set("parcelas_max", parseInt(form.parcelas_max) || 12)} /></div>
                {/* Item 3: Replaced Switch with Select for entrada minima */}
                <div className="col-span-2">
                  <Label>Entrada Mínima</Label>
                  <div className="flex items-center gap-3 mt-1">
                    {form.entrada_minima_tipo === "fixed" ? (
                      <CurrencyInput
                        value={form.entrada_minima_valor ?? 0}
                        onValueChange={v => set("entrada_minima_valor", v)}
                        className="flex-1"
                      />
                    ) : (
                      <Input
                        type="number"
                        value={form.entrada_minima_valor ?? ""}
                        onChange={e => set("entrada_minima_valor", e.target.value === "" ? "" : parseFloat(e.target.value))}
                        onBlur={() => set("entrada_minima_valor", parseFloat(form.entrada_minima_valor) || 0)}
                        className="flex-1"
                      />
                    )}
                    <Select value={form.entrada_minima_tipo || "percent"} onValueChange={v => set("entrada_minima_tipo", v)}>
                      <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                        <SelectItem value="percent">Percentual (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Desconto Máximo (%)</Label><Input type="number" min={0} max={100} step={0.01} value={form.desconto_maximo ?? ""} onChange={e => set("desconto_maximo", e.target.value === "" ? "" : parseFloat(e.target.value))} onBlur={() => set("desconto_maximo", Math.min(100, Math.max(0, parseFloat(form.desconto_maximo) || 0)))} /></div>
                <div><Label>Juros ao Mês (%)</Label><Input type="number" min={0} step={0.01} value={form.juros_mes ?? ""} onChange={e => set("juros_mes", e.target.value === "" ? "" : parseFloat(e.target.value))} onBlur={() => set("juros_mes", Math.max(0, parseFloat(form.juros_mes) || 0))} /></div>
                <div><Label>Multa (%)</Label><Input type="number" min={0} step={0.01} value={form.multa ?? ""} onChange={e => set("multa", e.target.value === "" ? "" : parseFloat(e.target.value))} onBlur={() => set("multa", Math.max(0, parseFloat(form.multa) || 0))} /></div>
                <div><Label>Prazo para pagamento do acordo (dias)</Label><Input type="number" min={1} value={form.prazo_dias_acordo ?? ""} onChange={e => set("prazo_dias_acordo", e.target.value === "" ? "" : parseInt(e.target.value))} onBlur={() => set("prazo_dias_acordo", Math.max(1, parseInt(form.prazo_dias_acordo) || 30))} /></div>
              </div>

              {/* Índice de Correção Monetária */}
              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Índice de Correção Monetária</p>
                    <p className="text-xs text-muted-foreground">Índice oficial para atualização monetária da dívida</p>
                  </div>
                  <Switch
                    checked={!!form.indice_correcao_monetaria}
                    onCheckedChange={(checked) => set("indice_correcao_monetaria", checked ? "IPCA" : null)}
                  />
                </div>
                {form.indice_correcao_monetaria && (
                  <Select value={form.indice_correcao_monetaria} onValueChange={v => set("indice_correcao_monetaria", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o índice" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TJ/SP">Taxa de Juros - São Paulo (TJ/SP)</SelectItem>
                      <SelectItem value="TJ/MG">Taxa de Juros - Minas Gerais (TJ/MG)</SelectItem>
                      <SelectItem value="TJ/RJ">Taxa de Juros - Rio de Janeiro (Lei 11.690/2009)</SelectItem>
                      <SelectItem value="TJ/PR">Taxa de Juros - Paraná (TJ/PR)</SelectItem>
                      <SelectItem value="INPC">Índice Nacional de Preços ao Consumidor (INPC)</SelectItem>
                      <SelectItem value="IGPM">Índice Geral de Preços do Mercado (IGPM)</SelectItem>
                      <SelectItem value="INCC">Índice Nacional de Custo da Construção (INCC)</SelectItem>
                      <SelectItem value="IPCA">Índice de Preços ao Consumidor Amplo (IPCA)</SelectItem>
                      <SelectItem value="UFIR">Unidade Fiscal de Referência (UFIR)</SelectItem>
                      <SelectItem value="SELIC">Sistema Especial de Liquidação e Custódia (SELIC)</SelectItem>
                      <SelectItem value="IGP-DI">Índice Geral de Preços - Disponibilidade Interna (IGP-DI)</SelectItem>
                      <SelectItem value="TBF">Taxa Básica Financeira (TBF)</SelectItem>
                      <SelectItem value="TR">Taxa Referencial (TR)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Grade de Honorários - Collapsible */}
            <Collapsible defaultOpen={honorarios.length === 0} className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-foreground">Grade de Honorários</p>
                    <p className="text-xs text-muted-foreground">
                      {honorarios.length > 0 ? `${honorarios.length} faixa(s) salva(s)` : "Defina os honorários por percentual ou valor fixo."}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CollapsibleTrigger>
                <div className="flex gap-2">
                  {editing?.id && (
                    <Button size="sm" variant="default" onClick={handleSaveGrade} disabled={savingGrade}>
                      {savingGrade ? "Salvando..." : "Salvar Grade"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={addHonorario}><Plus className="w-3 h-3 mr-1" /> Adicionar Faixa</Button>
                </div>
              </div>
              <CollapsibleContent>
                {honorarios.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Faixa Recuperada</TableHead>
                        <TableHead>Honorários (%)</TableHead>
                        <TableHead>Valor Fixo (R$)</TableHead>
                        <TableHead className="w-12">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {honorarios.map((h, i) => (
                        <TableRow key={i}>
                          <TableCell><Input value={h.faixa} onChange={e => updateHonorario(i, "faixa", e.target.value)} placeholder="Ex: Até 50%" className="h-8" /></TableCell>
                          <TableCell><Input type="number" value={h.honorario} onChange={e => updateHonorario(i, "honorario", parseFloat(e.target.value) || 0)} className="h-8" placeholder="%" /></TableCell>
                          <TableCell><CurrencyInput value={h.valor_fixo || 0} onValueChange={v => updateHonorario(i, "valor_fixo", v)} className="h-8" /></TableCell>
                          <TableCell><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeHonorario(i)}><Trash2 className="w-3 h-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* Faixas de Desconto por Aging - Collapsible */}
            <Collapsible defaultOpen={agingTiers.length === 0} className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 cursor-pointer">
                  <div>
                    <p className="text-sm font-medium text-foreground">Faixas de Desconto por Aging</p>
                    <p className="text-xs text-muted-foreground">
                      {agingTiers.length > 0 ? `${agingTiers.length} faixa(s) salva(s)` : "Defina descontos automáticos por tempo de atraso."}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform [[data-state=open]_&]:rotate-180" />
                </CollapsibleTrigger>
                <div className="flex gap-2">
                  {editing?.id && (
                    <Button size="sm" variant="default" onClick={handleSaveAgingTiers} disabled={savingAging}>
                      {savingAging ? "Salvando..." : "Salvar Faixas"}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={addAgingTier}><Plus className="w-3 h-3 mr-1" /> Adicionar Faixa</Button>
                </div>
              </div>
              <CollapsibleContent>
                {agingTiers.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>De (dias)</TableHead>
                        <TableHead>Até (dias)</TableHead>
                        <TableHead>Desconto (%)</TableHead>
                        <TableHead className="w-12">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agingTiers.map((t, i) => (
                        <TableRow key={i}>
                          <TableCell><Input type="number" value={t.min_days} onChange={e => updateAgingTier(i, "min_days", parseInt(e.target.value) || 0)} className="h-8" /></TableCell>
                          <TableCell><Input type="number" value={t.max_days} onChange={e => updateAgingTier(i, "max_days", parseInt(e.target.value) || 0)} className="h-8" /></TableCell>
                          <TableCell><Input type="number" value={t.discount_percent} onChange={e => updateAgingTier(i, "discount_percent", parseFloat(e.target.value) || 0)} className="h-8" placeholder="%" /></TableCell>
                          <TableCell><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeAgingTier(i)}><Trash2 className="w-3 h-3" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CollapsibleContent>
            </Collapsible>



          </TabsContent>

          {/* ABA 4 - RÉGUA DE COBRANÇA */}
          <TabsContent value="regua" className="mt-4">
            <CredorReguaTab credorId={editing?.id} />
          </TabsContent>

          {/* ABA 5 - PERSONALIZAÇÃO */}
          <TabsContent value="personalizacao" className="space-y-0 mt-4">
            {/* 1. Modo da Carteira */}
            <Collapsible defaultOpen className="py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Modo da Carteira</h4>
                  <p className="text-xs text-muted-foreground">Define como os operadores acessam os clientes deste credor</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <RadioGroup
                  value={form.carteira_mode || "open"}
                  onValueChange={(v) => set("carteira_mode", v)}
                  className="flex gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="open" id="mode-open" />
                    <Label htmlFor="mode-open" className="cursor-pointer font-normal">Mar Aberto</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="assigned" id="mode-assigned" />
                    <Label htmlFor="mode-assigned" className="cursor-pointer font-normal">Atribuição</Label>
                  </div>
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-2">
                  {form.carteira_mode === "assigned"
                    ? "Operadores veem apenas clientes atribuídos a eles neste credor."
                    : "Todos os operadores com permissão podem ver todos os clientes deste credor."}
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* 2. Modelos de Documentos */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Modelos de Documentos</h4>
                  <p className="text-xs text-muted-foreground">Templates para acordo, recibo, quitação e descrição de dívida</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CredorDocumentTemplates form={form} set={set} credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 3. Campos Visíveis no Atendimento */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Campos Visíveis no Atendimento</h4>
                  <p className="text-xs text-muted-foreground">Defina quais informações do devedor o operador visualiza</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <AtendimentoFieldsConfig credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 4. Campos Personalizados */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Campos Personalizados</h4>
                  <p className="text-xs text-muted-foreground">Adicione campos específicos para a operação deste credor</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CustomFieldsConfig credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 5. Meios de Pagamento & Integração */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Meios de Pagamento & Integração</h4>
                  <p className="text-xs text-muted-foreground">Mapeie como o Rivo identifica os pagamentos vindos do cliente</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <PaymentMethodsConfig credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 6. Tipos de Dívida & Títulos */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Tipos de Dívida</h4>
                  <p className="text-xs text-muted-foreground">Gerencie as categorias de débitos aceitas para este credor</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <TipoDividaList credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 7. Categorização do Devedor */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Categorização do Devedor</h4>
                  <p className="text-xs text-muted-foreground">Defina categorias específicas para classificar os devedores deste credor</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CredorDebtorCategoriesConfig credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>

            {/* 6. Scripts de Abordagem */}
            <Collapsible className="border-t border-border py-4">
              <CollapsibleTrigger className="flex items-center justify-between w-full cursor-pointer group">
                <div className="text-left">
                  <h4 className="text-sm font-medium text-foreground">Scripts de Abordagem</h4>
                  <p className="text-xs text-muted-foreground">Modelos de texto para orientar o atendimento ao devedor</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 -rotate-90 group-data-[state=open]:rotate-0" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4">
                <CredorScriptsTab credorId={editing?.id} />
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>

          {/* ABA 5 - ASSINATURA DIGITAL */}
          <TabsContent value="assinatura" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">Assinatura Digital</p>
                  <p className="text-xs text-muted-foreground">Exigir assinatura digital nos acordos deste credor</p>
                </div>
                <Switch
                  checked={form.signature_enabled || false}
                  onCheckedChange={c => set("signature_enabled", c)}
                />
              </div>

              {form.signature_enabled && (
                <div className="space-y-3 p-4 rounded-lg border border-border">
                  <Label className="text-sm font-medium">Tipo de Assinatura</Label>
                  <RadioGroup
                    value={form.signature_type || "click"}
                    onValueChange={v => set("signature_type", v)}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="click" id="sig-click" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-click" className="text-sm font-medium cursor-pointer">Aceite por Click</Label>
                        <p className="text-xs text-muted-foreground">O devedor confirma com um clique simples. Rápido e prático.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="facial" id="sig-facial" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-facial" className="text-sm font-medium cursor-pointer">Reconhecimento Facial</Label>
                        <p className="text-xs text-muted-foreground">Captura de fotos via webcam com detecção facial em tempo real.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="draw" id="sig-draw" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-draw" className="text-sm font-medium cursor-pointer">Assinatura na Tela</Label>
                        <p className="text-xs text-muted-foreground">O devedor desenha a assinatura manualmente na tela do dispositivo.</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                ℹ️ Quando ativa, a assinatura digital será obrigatória no portal do devedor antes de liberar o checkout para acordos deste credor.
              </p>
            </div>
          </TabsContent>

          {/* ABA 6 - PORTAL WHITE-LABEL - Items 6, 7, 8 */}
          <TabsContent value="portal" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">Portal Personalizado</p>
                  <p className="text-xs text-muted-foreground">Ativar branding personalizado deste credor no Portal do Devedor</p>
                </div>
                <Switch checked={form.portal_enabled || false} onCheckedChange={v => set("portal_enabled", v)} />
              </div>

              {form.portal_enabled && (
                <div className="space-y-4 animate-fade-in">
                  {/* Item 7: Redesigned Portal Link */}
                  {tenant?.slug && (
                    <Card className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <Link className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">Link do Portal</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">
                              {`${window.location.origin}/portal/${tenant.slug}`}
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="gap-1.5 shrink-0 ml-3"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/portal/${tenant.slug}`);
                            toast.success("Link copiado!");
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </Button>
                      </div>
                    </Card>
                  )}

                  {/* Item 8: Optimized layout - Logo + Color grouped */}
                  <div className="grid grid-cols-[auto_1fr] gap-4 items-start">
                    {/* Logo Upload */}
                    <div
                      className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors overflow-hidden shrink-0"
                      onClick={() => logoInputRef.current?.click()}
                    >
                      {form.portal_logo_url ? (
                        <img src={form.portal_logo_url} alt="Logo preview" className="w-full h-full object-contain" />
                      ) : (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageIcon className="w-5 h-5" />
                          <span className="text-[9px]">Logo</span>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept=".png,.jpg,.jpeg,.svg,.webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 2 * 1024 * 1024) {
                            toast.error("Imagem deve ter no máximo 2MB");
                            return;
                          }
                          setUploadingLogo(true);
                          try {
                            const credorId = editing?.id || "new";
                            const ext = file.name.split(".").pop();
                            const path = `credor-logos/${credorId}/${Date.now()}.${ext}`;
                            const { error: uploadError } = await supabase.storage
                              .from("avatars")
                              .upload(path, file, { upsert: true });
                            if (uploadError) throw uploadError;
                            const { data: urlData } = supabase.storage
                              .from("avatars")
                              .getPublicUrl(path);
                            set("portal_logo_url", urlData.publicUrl);
                            toast.success("Logo enviado com sucesso!");
                          } catch (err) {
                            console.error(err);
                            toast.error("Erro ao enviar logo");
                          } finally {
                            setUploadingLogo(false);
                            e.target.value = "";
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={uploadingLogo}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingLogo ? "Enviando..." : "Upload"}
                        </Button>
                        <Input
                          value={form.portal_logo_url || ""}
                          onChange={e => set("portal_logo_url", e.target.value)}
                          placeholder="Ou cole a URL do logo..."
                          className="text-xs flex-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs shrink-0">Cor Primária</Label>
                        <Input type="color" value={form.portal_primary_color || "#F97316"} onChange={e => set("portal_primary_color", e.target.value)} className="w-10 h-8 p-0.5 cursor-pointer" />
                        <Input value={form.portal_primary_color || ""} onChange={e => set("portal_primary_color", e.target.value)} placeholder="#F97316" className="flex-1 text-xs" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <Label className="text-xs">Título do Hero</Label>
                      <Input value={form.portal_hero_title || ""} onChange={e => set("portal_hero_title", e.target.value)} placeholder="Ex: Negocie suas dívidas com até 90% de desconto" className="text-xs" />
                    </div>
                    <div>
                      <Label className="text-xs">Subtítulo do Hero</Label>
                      <Input value={form.portal_hero_subtitle || ""} onChange={e => set("portal_hero_subtitle", e.target.value)} placeholder="Consulte suas pendências e encontre as melhores condições" className="text-xs" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar Credor"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CredorForm;
