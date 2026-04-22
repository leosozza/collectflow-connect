import { useState, useEffect, useCallback } from "react";
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
import {
  fetchCollectionRules,
  createCollectionRule,
  updateCollectionRule,
  deleteCollectionRule,
  CollectionRule,
} from "@/services/automacaoService";
import { fetchEligibleInstances, EligibleInstance } from "@/services/whatsappCampaignService";

interface CredorReguaTabProps {
  credorId: string | undefined;
}

const TEMPLATE_VARS = ["{{nome}}", "{{cpf}}", "{{valor_parcela}}", "{{data_vencimento}}", "{{credor}}"];
const SAMPLE_DATA: Record<string, string> = {
  "{{nome}}": "João Silva",
  "{{cpf}}": "123.456.789-00",
  "{{valor_parcela}}": "R$ 350,00",
  "{{data_vencimento}}": "15/03/2026",
  "{{credor}}": "Empresa Exemplo",
};

const channelLabel: Record<string, string> = { whatsapp: "WhatsApp", email: "Email", both: "Ambos" };

const CredorReguaTab = ({ credorId }: CredorReguaTabProps) => {
  const { tenant } = useTenant();
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [instances, setInstances] = useState<EligibleInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<CollectionRule | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("whatsapp");
  const [daysOffset, setDaysOffset] = useState("0");
  const [instanceId, setInstanceId] = useState<string>("none");
  const [template, setTemplate] = useState(
    "Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}. Entre em contato para regularizar."
  );

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

  const resetForm = () => {
    setName("");
    setChannel("whatsapp");
    setDaysOffset("0");
    setInstanceId("none");
    setTemplate("Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}. Entre em contato para regularizar.");
    setEditingRule(null);
    setShowForm(false);
  };

  const openEdit = (rule: CollectionRule) => {
    setName(rule.name);
    setChannel(rule.channel);
    setDaysOffset(rule.days_offset.toString());
    setInstanceId(rule.instance_id || "none");
    setTemplate(rule.message_template);
    setEditingRule(rule);
    setShowForm(true);
  };

  const handleSave = async () => {
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
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        channel,
        days_offset: parsedDays,
        message_template: template,
        instance_id: instanceId === "none" ? null : instanceId,
      };
      if (editingRule) {
        await updateCollectionRule(editingRule.id, payload as any);
        toast.success("Regra atualizada!");
      } else {
        await createCollectionRule({ ...payload, tenant_id: tenant.id, credor_id: credorId, is_active: true } as any);
        toast.success("Regra criada!");
      }
      resetForm();
      await loadData();
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

  const preview = TEMPLATE_VARS.reduce(
    (text, v) => text.split(v).join(SAMPLE_DATA[v] || v),
    template
  );

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

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">{editingRule ? "Editar Regra" : "Nova Regra"}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome da regra</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Lembrete 3 dias antes" className="h-9" />
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

        <div className="space-y-1.5">
          <Label className="text-xs">Template da mensagem</Label>
          <div className="flex flex-wrap gap-1 mb-1">
            {TEMPLATE_VARS.map(v => (
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

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          <Button size="sm" variant="outline" onClick={resetForm}>Cancelar</Button>
        </div>
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
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-3 h-3 mr-1" /> Nova Regra
        </Button>
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
              <TableHead>Disparo</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Instância</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.sort((a, b) => a.days_offset - b.days_offset).map(rule => (
              <TableRow key={rule.id}>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {daysIcon(rule.days_offset)}
                    <span className="text-xs font-mono">D{rule.days_offset >= 0 ? "+" : ""}{rule.days_offset}</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm font-medium">{rule.name}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{channelLabel[rule.channel] || rule.channel}</Badge></TableCell>
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
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(rule)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(rule)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default CredorReguaTab;
