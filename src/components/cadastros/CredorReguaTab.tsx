import { useState, useEffect, useCallback, useRef } from "react";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock, MessageSquare, Mail, ArrowDown, ArrowUp, Minus, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  fetchCollectionRules,
  createCollectionRule,
  updateCollectionRule,
  deleteCollectionRule,
  CollectionRule,
  RuleType,
} from "@/services/automacaoService";
import { fetchEligibleInstances, EligibleInstance } from "@/services/whatsappCampaignService";

interface CredorReguaTabProps {
  credorId: string | undefined;
}

const WALLET_VARS = ["{{nome}}", "{{cpf}}", "{{credor}}", "{{valor}}", "{{data_vencimento}}"];
const AGREEMENT_VARS = ["{{nome}}", "{{cpf}}", "{{credor}}", "{{valor_parcela}}", "{{vencimento_parcela}}", "{{n_parcela}}", "{{total_parcelas}}", "{{linha_digitavel}}"];
const SAMPLE_DATA: Record<string, string> = {
  "{{nome}}": "João Silva",
  "{{cpf}}": "123.456.789-00",
  "{{credor}}": "Empresa Exemplo",
  "{{valor}}": "R$ 350,00",
  "{{data_vencimento}}": "15/03/2026",
  "{{valor_parcela}}": "R$ 350,00",
  "{{vencimento_parcela}}": "15/03/2026",
  "{{n_parcela}}": "2",
  "{{total_parcelas}}": "6",
  "{{linha_digitavel}}": "23793.38128 60082...",
};

const DEFAULT_TEMPLATES: Record<RuleType, string> = {
  wallet: "Olá {{nome}}, identificamos um débito em aberto no valor de {{valor}} com vencimento em {{data_vencimento}}. Entre em contato para regularizar.",
  agreement: "Olá {{nome}}, sua parcela {{n_parcela}}/{{total_parcelas}} no valor de {{valor_parcela}} vence em {{vencimento_parcela}}. Conte com a gente!",
};

const channelLabel: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", both: "Ambos" };
const ruleTypeLabel: Record<RuleType, string> = { wallet: "Carteira", agreement: "Acordo" };

const CredorReguaTab = ({ credorId }: CredorReguaTabProps) => {
  const { tenant } = useTenant();
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [instances, setInstances] = useState<EligibleInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CollectionRule | null>(null);
  const [saving, setSaving] = useState(false);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [ruleType, setRuleType] = useState<RuleType>("wallet");
  const [daysOffset, setDaysOffset] = useState("0");
  const [instanceId, setInstanceId] = useState<string>("none");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATES.wallet);
  const [filterType, setFilterType] = useState<"all" | RuleType>("all");
  const [sendTimeStart, setSendTimeStart] = useState("09:00");
  const [sendTimeEnd, setSendTimeEnd] = useState("18:00");
  const [minDelay, setMinDelay] = useState("8");
  const [maxDelay, setMaxDelay] = useState("15");
  const [dailyCap, setDailyCap] = useState("");

  const loadData = useCallback(async () => {
    if (!tenant || !credorId) return;
    setLoading(true);
    try {
      const [rulesData, instancesData] = await Promise.all([
        fetchCollectionRules(tenant.id, credorId),
        fetchEligibleInstances(tenant.id),
      ]);
      setRules(rulesData);
      setInstances(instancesData);
    } catch {
      toast.error("Erro ao carregar régua de cobrança");
    } finally {
      setLoading(false);
    }
  }, [tenant, credorId]);

  useEffect(() => { loadData(); }, [loadData]);

  const resetFormFields = () => {
    setName("");
    setDaysOffset("0");
    setTemplate(DEFAULT_TEMPLATES[ruleType]);
  };

  const closeAndReset = () => {
    setName("");
    setChannel("whatsapp");
    setRuleType("wallet");
    setDaysOffset("0");
    setInstanceId("none");
    setTemplate(DEFAULT_TEMPLATES.wallet);
    setSendTimeStart("09:00");
    setSendTimeEnd("18:00");
    setMinDelay("8");
    setMaxDelay("15");
    setDailyCap("");
    setEditingRule(null);
    setShowForm(false);
  };

  const isDirty = () => {
    const defaults = Object.values(DEFAULT_TEMPLATES).map((t) => t.trim());
    return name.trim().length > 0 || (template.trim().length > 0 && !defaults.includes(template.trim()));
  };

  const tryClose = () => {
    if (isDirty() && !editingRule) {
      if (!confirm("Descartar esta regra? As alterações não foram salvas.")) return;
    }
    closeAndReset();
  };

  const openNew = () => {
    setEditingRule(null);
    setName("");
    setChannel("whatsapp");
    setRuleType("wallet");
    setDaysOffset("0");
    setInstanceId("none");
    setTemplate(DEFAULT_TEMPLATES.wallet);
    setSendTimeStart("09:00");
    setSendTimeEnd("18:00");
    setMinDelay("8");
    setMaxDelay("15");
    setDailyCap("");
    setShowForm(true);
  };

  const handleRuleTypeChange = (newType: RuleType) => {
    const defaults = Object.values(DEFAULT_TEMPLATES).map((t) => t.trim());
    if (defaults.includes(template.trim()) || template.trim() === "") {
      setTemplate(DEFAULT_TEMPLATES[newType]);
    }
    setRuleType(newType);
  };

  const openEdit = (rule: CollectionRule) => {
    setName(rule.name);
    setChannel(rule.channel);
    setRuleType(rule.rule_type || "wallet");
    setDaysOffset(rule.days_offset.toString());
    setInstanceId(rule.instance_id || "none");
    setTemplate(rule.message_template);
    setSendTimeStart((rule.send_time_start || "09:00").slice(0, 5));
    setSendTimeEnd((rule.send_time_end || "18:00").slice(0, 5));
    setMinDelay(String(rule.min_delay_seconds ?? 8));
    setMaxDelay(String(rule.max_delay_seconds ?? 15));
    setDailyCap(rule.daily_cap ? String(rule.daily_cap) : "");
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleSave = async (closeAfter: boolean) => {
    if (!tenant || !credorId) return;
    if (!name.trim()) {
      toast.error("Informe um nome para a regra");
      return;
    }
    const parsedDays = parseInt(daysOffset);
    if (Number.isNaN(parsedDays)) {
      toast.error("Dias precisa ser um número (negativo, zero ou positivo)");
      return;
    }
    if (!template.trim()) {
      toast.error("Informe o template da mensagem");
      return;
    }
    // Validações de agendamento e anti-ban
    const startMin = (() => { const [h,m] = sendTimeStart.split(":").map(Number); return h*60+m; })();
    const endMin = (() => { const [h,m] = sendTimeEnd.split(":").map(Number); return h*60+m; })();
    if (!(startMin < endMin)) {
      toast.error("Horário inicial deve ser menor que o final");
      return;
    }
    const minD = parseInt(minDelay);
    const maxD = parseInt(maxDelay);
    if (Number.isNaN(minD) || minD < 3) {
      toast.error("Delay mínimo precisa ser ≥ 3 segundos");
      return;
    }
    if (Number.isNaN(maxD) || maxD < minD) {
      toast.error("Delay máximo precisa ser ≥ delay mínimo");
      return;
    }
    let capVal: number | null = null;
    if (dailyCap.trim() !== "") {
      const c = parseInt(dailyCap);
      if (Number.isNaN(c) || c <= 0) {
        toast.error("Limite diário precisa ser um número > 0 (ou vazio)");
        return;
      }
      capVal = c;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        channel,
        rule_type: ruleType,
        days_offset: parsedDays,
        message_template: template,
        instance_id: instanceId === "none" ? null : instanceId,
        send_time_start: `${sendTimeStart}:00`,
        send_time_end: `${sendTimeEnd}:00`,
        min_delay_seconds: minD,
        max_delay_seconds: maxD,
        daily_cap: capVal,
      };
      console.log("[CredorReguaTab] saving rule payload:", { ...payload, tenant_id: tenant.id, credor_id: credorId, editing: !!editingRule });
      if (editingRule) {
        await updateCollectionRule(editingRule.id, payload as any);
        await loadData();
        toast.success("Regra atualizada!");
        closeAndReset();
      } else {
        await createCollectionRule({ ...payload, tenant_id: tenant.id, credor_id: credorId, is_active: true } as any);
        await loadData();
        if (closeAfter) {
          toast.success("Regra criada!");
          closeAndReset();
        } else {
          toast.success("Regra criada — pronto para a próxima");
          resetFormFields();
          setTimeout(() => nameInputRef.current?.focus(), 50);
        }
      }
    } catch (err: any) {
      console.error("[CredorReguaTab] save error:", err);
      const msg = err?.message || err?.error_description || err?.hint || "Erro ao salvar regra";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: CollectionRule) => {
    try {
      await updateCollectionRule(rule.id, { is_active: !rule.is_active });
      await loadData();
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleDelete = async (rule: CollectionRule) => {
    if (!confirm(`Excluir regra "${rule.name}"?`)) return;
    try {
      await deleteCollectionRule(rule.id);
      toast.success("Regra excluída!");
      await loadData();
    } catch { toast.error("Erro ao excluir"); }
  };

  const daysLabel = (d: number) => {
    if (d < 0) return `${Math.abs(d)} dia(s) antes do vencimento`;
    if (d === 0) return "No dia do vencimento";
    return `${d} dia(s) após o vencimento`;
  };

  const daysIcon = (d: number) => {
    if (d < 0) return <ArrowUp className="w-3 h-3 text-blue-500" />;
    if (d === 0) return <Minus className="w-3 h-3 text-yellow-500" />;
    return <ArrowDown className="w-3 h-3 text-red-500" />;
  };

  const currentVars = ruleType === "agreement" ? AGREEMENT_VARS : WALLET_VARS;
  const preview = currentVars.reduce(
    (text, v) => text.split(v).join(SAMPLE_DATA[v] || v),
    template
  );

  const filteredRules = filterType === "all" ? rules : rules.filter((r) => (r.rule_type || "wallet") === filterType);

  const getInstanceName = (id: string | null) => {
    if (!id) return null;
    return instances.find((i) => i.id === id)?.name || null;
  };

  const showInstanceSelect = channel === "whatsapp" || channel === "both";

  if (!credorId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Salve o credor primeiro para configurar a régua de cobrança.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Régua de Cobrança</p>
          <p className="text-xs text-muted-foreground">Configure disparos automáticos antes e depois do vencimento</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="wallet">Carteira</SelectItem>
              <SelectItem value="agreement">Acordo</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" type="button" onClick={openNew}>
            <Plus className="w-3 h-3 mr-1" /> Nova Regra
          </Button>
        </div>
      </div>

      {/* Visual timeline */}
      {rules.length > 0 && (
        <div className="relative flex items-end gap-1 py-4 px-2 bg-muted/30 rounded-lg overflow-x-auto">
          {rules.sort((a, b) => a.days_offset - b.days_offset).map((rule) => (
            <div key={rule.id} className="flex flex-col items-center min-w-[60px] flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                rule.is_active ? (rule.days_offset < 0 ? "bg-blue-100 text-blue-700" : rule.days_offset === 0 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700") : "bg-muted text-muted-foreground"
              }`}>
                {rule.channel === "whatsapp" ? <MessageSquare className="w-3.5 h-3.5" /> : rule.channel === "email" ? <Mail className="w-3.5 h-3.5" /> : "📨"}
              </div>
              <div className="w-px h-3 bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground">
                D{rule.days_offset >= 0 ? "+" : ""}{rule.days_offset}
              </span>
              <span className="text-[9px] text-muted-foreground truncate max-w-[56px]">{rule.name}</span>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">Carregando...</div>
      ) : rules.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma regra configurada.</p>
          <p className="text-xs">Crie regras para disparar mensagens automáticas.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Disparo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Instância</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRules.sort((a, b) => a.days_offset - b.days_offset).map(rule => {
              const rt = (rule.rule_type || "wallet") as RuleType;
              const startH = (rule.send_time_start || "09:00").slice(0, 5);
              const endH = (rule.send_time_end || "18:00").slice(0, 5);
              return (
              <TableRow key={rule.id}>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-xs ${rt === "agreement" ? "border-primary text-primary" : "border-accent-foreground/40"}`}
                  >
                    {ruleTypeLabel[rt]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {daysIcon(rule.days_offset)}
                    <span className="text-xs font-mono">D{rule.days_offset >= 0 ? "+" : ""}{rule.days_offset}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">{rule.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{channelLabel[rule.channel] || rule.channel}</Badge></TableCell>
                <TableCell>
                  <span className="text-xs font-mono text-muted-foreground">{startH}–{endH}</span>
                  {rule.daily_cap ? (
                    <span className="ml-1 text-[10px] text-muted-foreground">(máx {rule.daily_cap}/dia)</span>
                  ) : null}
                </TableCell>
                <TableCell>
                  {getInstanceName(rule.instance_id) ? (
                    <Badge variant="secondary" className="text-xs flex items-center gap-1 w-fit">
                      <Smartphone className="w-3 h-3" />
                      {getInstanceName(rule.instance_id)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell><Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule)} /></TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" type="button" className="h-7 w-7" onClick={() => openEdit(rule)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" type="button" className="h-7 w-7" onClick={() => handleDelete(rule)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={showForm} onOpenChange={(open) => { if (!open) tryClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Cobrança"}</DialogTitle>
            <DialogDescription>
              Configure quando e como uma mensagem automática será disparada para esta carteira.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo de régua</Label>
              <RadioGroup value={ruleType} onValueChange={(v) => handleRuleTypeChange(v as RuleType)} className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="wallet" id="rt-wallet" />
                  <span>Título da Carteira</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <RadioGroupItem value="agreement" id="rt-agreement" />
                  <span>Parcela de Acordo</span>
                </label>
              </RadioGroup>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {ruleType === "wallet"
                  ? "Dispara para clientes com título original em aberto (sem acordo ativo)."
                  : "Dispara para parcelas de acordos vigentes que ainda não foram pagas."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da regra</Label>
                <Input ref={nameInputRef} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lembrete 3 dias antes" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Canal</Label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="both">Ambos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Dias em relação ao vencimento</Label>
                <Input type="number" value={daysOffset} onChange={e => setDaysOffset(e.target.value)} min={-30} max={90} className="h-9 w-32" />
                <p className="text-xs text-muted-foreground">{daysLabel(parseInt(daysOffset) || 0)}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Negativo = antes do vencimento (prevenção). 0 = no dia. Positivo = após (cobrança).
                </p>
              </div>
              {showInstanceSelect && (
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1">
                    <Smartphone className="w-3 h-3" /> Instância WhatsApp
                  </Label>
                  <Select value={instanceId} onValueChange={setInstanceId}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma (padrão)</SelectItem>
                      {instances.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name} ({inst.provider_category === "unofficial" ? "Não oficial" : "Oficial"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Instância que executará o disparo desta regra</p>
                </div>
              )}
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs font-semibold">Agendamento e Boas Práticas (Anti-Ban)</Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Janela de envio (BRT)</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="time" value={sendTimeStart} onChange={e => setSendTimeStart(e.target.value)} className="h-8 w-[110px] text-xs" />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input type="time" value={sendTimeEnd} onChange={e => setSendTimeEnd(e.target.value)} className="h-8 w-[110px] text-xs" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Delay entre mensagens (s)</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={3} value={minDelay} onChange={e => setMinDelay(e.target.value)} className="h-8 w-[70px] text-xs" />
                    <span className="text-xs text-muted-foreground">a</span>
                    <Input type="number" min={3} value={maxDelay} onChange={e => setMaxDelay(e.target.value)} className="h-8 w-[70px] text-xs" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Limite diário de envios (opcional)</Label>
                <Input type="number" min={1} placeholder="Sem limite" value={dailyCap} onChange={e => setDailyCap(e.target.value)} className="h-8 w-[140px] text-xs" />
              </div>
              <p className="text-[11px] text-muted-foreground leading-tight">
                ℹ O sistema só dispara dentro da janela configurada (horário de Brasília) e aplica delay aleatório entre mensagens para evitar bloqueio do WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Template da mensagem</Label>
              <div className="flex flex-wrap gap-1 mb-1">
                {currentVars.map(v => (
                  <button key={v} type="button" onClick={() => setTemplate(t => t + " " + v)}
                    className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-accent transition-colors font-mono"
                  >{v}</button>
                ))}
              </div>
              <Textarea value={template} onChange={e => setTemplate(e.target.value)} rows={3} className="text-xs" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Preview</Label>
              <div className="p-2.5 rounded-md bg-muted text-xs whitespace-pre-wrap">{preview}</div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" size="sm" variant="outline" onClick={tryClose} disabled={saving}>
              Cancelar
            </Button>
            {!editingRule && (
              <Button type="button" size="sm" variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
                {saving ? "Salvando..." : "Salvar e criar outra"}
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => handleSave(true)} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CredorReguaTab;
