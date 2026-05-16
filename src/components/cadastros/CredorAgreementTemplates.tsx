import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, Star, Sparkles, ArrowUp, ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  credorId: string;
  allowCustomProposal: boolean;
  onToggleCustomProposal: (v: boolean) => void;
}

interface Template {
  id: string;
  tenant_id: string;
  credor_id: string;
  nome: string;
  tipo: "avista" | "parcelado_com_entrada" | "parcelado_sem_entrada";
  desconto_percent: number;
  parcelas: number;
  entrada_percent: number | null;
  juros_mes_percent: number | null;
  ativo: boolean;
  destaque: boolean;
  ordem: number;
  descricao: string | null;
  aging_min_days: number | null;
  aging_max_days: number | null;
}

const EMPTY: Partial<Template> = {
  nome: "",
  tipo: "avista",
  desconto_percent: 50,
  parcelas: 1,
  entrada_percent: null,
  juros_mes_percent: 0,
  ativo: true,
  destaque: false,
  ordem: 0,
  descricao: "",
  aging_min_days: null,
  aging_max_days: null,
};

const AGING_PRESETS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Qualquer", min: null, max: null },
  { label: "0–30", min: 0, max: 30 },
  { label: "31–90", min: 31, max: 90 },
  { label: "91–180", min: 91, max: 180 },
  { label: "181–360", min: 181, max: 360 },
  { label: "360+", min: 361, max: null },
];

const formatAging = (min: number | null | undefined, max: number | null | undefined) => {
  if (min == null && max == null) return "Qualquer aging";
  if (min != null && max != null) return `${min}–${max} dias`;
  if (min != null) return `${min}+ dias`;
  return `até ${max} dias`;
};

const SAMPLE = 1000;

const CredorAgreementTemplates = ({ credorId, allowCustomProposal, onToggleCustomProposal }: Props) => {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Partial<Template> | null>(null);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["credor-templates", credorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credor_agreement_templates" as any)
        .select("*")
        .eq("credor_id", credorId)
        .order("destaque", { ascending: false })
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Template[];
    },
    enabled: !!credorId,
  });

  const upsert = useMutation({
    mutationFn: async (tpl: Partial<Template>) => {
      const payload: any = {
        ...tpl,
        credor_id: credorId,
        tenant_id: tenant?.id,
      };
      // sanitize entrada
      if (payload.tipo !== "parcelado_com_entrada") payload.entrada_percent = null;
      const { error } = await supabase.from("credor_agreement_templates" as any).upsert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credor-templates", credorId] });
      setEditing(null);
      toast.success("Modelo salvo");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("credor_agreement_templates" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["credor-templates", credorId] });
      toast.success("Modelo removido");
    },
  });

  const reorder = async (id: string, dir: -1 | 1) => {
    const list = [...templates];
    const idx = list.findIndex((t) => t.id === id);
    const swap = idx + dir;
    if (swap < 0 || swap >= list.length) return;
    const a = list[idx], b = list[swap];
    await supabase.from("credor_agreement_templates" as any).update({ ordem: b.ordem }).eq("id", a.id);
    await supabase.from("credor_agreement_templates" as any).update({ ordem: a.ordem }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["credor-templates", credorId] });
  };

  const previewValue = (t: Partial<Template>) => {
    const disc = Number(t.desconto_percent || 0);
    const total = SAMPLE * (1 - disc / 100);
    const parcelas = Math.max(1, Number(t.parcelas || 1));
    return { total, perParcela: total / parcelas };
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-card border-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm text-foreground">Permitir proposta personalizada</p>
            <p className="text-xs text-muted-foreground">
              Se desativado, o devedor só pode escolher entre os modelos cadastrados abaixo.
            </p>
          </div>
          <Switch checked={allowCustomProposal} onCheckedChange={onToggleCustomProposal} />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Modelos de Acordo</p>
          <p className="text-xs text-muted-foreground">
            Cadastre 2+ ofertas que o devedor verá no portal (ex: à vista 80% off, 6x sem juros).
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing({ ...EMPTY, ordem: templates.length })}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar modelo
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : templates.length === 0 ? (
        <Card className="p-6 text-center bg-muted/30 border-dashed">
          <Sparkles className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhum modelo cadastrado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Sem modelos, o portal usará a geração dinâmica padrão.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t, idx) => {
            const p = previewValue(t);
            return (
              <Card key={t.id} className="p-3 bg-card border-border">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-0.5">
                    <button type="button" disabled={idx === 0} onClick={() => reorder(t.id, -1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button type="button" disabled={idx === templates.length - 1} onClick={() => reorder(t.id, 1)} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm text-foreground">{t.nome}</p>
                      {t.destaque && <Badge variant="default" className="bg-primary/15 text-primary text-[10px]"><Star className="w-2.5 h-2.5 mr-0.5" />Destaque</Badge>}
                      {!t.ativo && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                      <Badge variant="secondary" className="text-[10px] font-normal">{formatAging(t.aging_min_days, t.aging_max_days)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.parcelas === 1 ? "À vista" : `${t.parcelas}x`} · {t.desconto_percent}% desc
                      {t.entrada_percent ? ` · entrada ${t.entrada_percent}%` : ""}
                      {" · "}<span className="text-foreground">ex: {formatCurrency(p.total)}{t.parcelas > 1 ? ` (${t.parcelas}x ${formatCurrency(p.perParcela)})` : ""}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm(`Remover "${t.nome}"?`)) del.mutate(t.id); }}>
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar modelo" : "Novo modelo de acordo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nome do modelo</Label>
                <Input value={editing.nome || ""} onChange={(e) => setEditing({ ...editing, nome: e.target.value })} placeholder="Ex: À vista premium" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={editing.tipo} onValueChange={(v: any) => setEditing({ ...editing, tipo: v, parcelas: v === "avista" ? 1 : editing.parcelas })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="parcelado_sem_entrada">Parcelado sem entrada</SelectItem>
                    <SelectItem value="parcelado_com_entrada">Parcelado com entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Desconto (%)</Label>
                  <Input type="number" min={0} max={100} step="0.01" value={editing.desconto_percent ?? 0} onChange={(e) => setEditing({ ...editing, desconto_percent: Number(e.target.value) })} />
                </div>
                <div>
                  <Label className="text-xs">Parcelas</Label>
                  <Input type="number" min={1} max={60} value={editing.parcelas ?? 1} disabled={editing.tipo === "avista"} onChange={(e) => setEditing({ ...editing, parcelas: Number(e.target.value) })} />
                </div>
              </div>
              {editing.tipo === "parcelado_com_entrada" && (
                <div>
                  <Label className="text-xs">Entrada (%)</Label>
                  <Input type="number" min={0} max={100} step="0.01" value={editing.entrada_percent ?? 0} onChange={(e) => setEditing({ ...editing, entrada_percent: Number(e.target.value) })} />
                </div>
              )}
              <div>
                <Label className="text-xs">Juros mês (%) — opcional</Label>
                <Input type="number" min={0} step="0.01" value={editing.juros_mes_percent ?? 0} onChange={(e) => setEditing({ ...editing, juros_mes_percent: Number(e.target.value) })} />
              </div>

              {/* Aplicabilidade por aging */}
              <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Aplicabilidade por aging (dias em atraso)</Label>
                  <span className="text-[10px] text-muted-foreground">{formatAging(editing.aging_min_days, editing.aging_max_days)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {AGING_PRESETS.map((p) => {
                    const active = (editing.aging_min_days ?? null) === p.min && (editing.aging_max_days ?? null) === p.max;
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setEditing({ ...editing, aging_min_days: p.min, aging_max_days: p.max })}
                        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground border-border hover:border-primary/50"}`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">De (dias)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={editing.aging_min_days ?? ""}
                      onChange={(e) => setEditing({ ...editing, aging_min_days: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Até (dias, vazio = sem limite)</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="sem limite"
                      value={editing.aging_max_days ?? ""}
                      onChange={(e) => setEditing({ ...editing, aging_max_days: e.target.value === "" ? null : Number(e.target.value) })}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Modelo só aparece no portal se a dívida do devedor estiver nessa faixa de atraso. Deixe ambos vazios para liberar para qualquer aging.</p>
              </div>
              <div>
                <Label className="text-xs">Descrição (opcional)</Label>
                <Textarea rows={2} value={editing.descricao || ""} onChange={(e) => setEditing({ ...editing, descricao: e.target.value })} placeholder="Ex: Melhor opção para quitação imediata" />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.ativo} onCheckedChange={(v) => setEditing({ ...editing, ativo: v })} />
                  Ativo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch checked={!!editing.destaque} onCheckedChange={(v) => setEditing({ ...editing, destaque: v })} />
                  Destaque
                </label>
              </div>

              {/* Preview */}
              <Card className="p-3 bg-muted/30 border-dashed">
                <p className="text-[10px] uppercase text-muted-foreground mb-1">Preview (dívida exemplo R$ {SAMPLE.toFixed(2)})</p>
                {(() => {
                  const p = previewValue(editing);
                  return (
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">{editing.nome || "Modelo sem nome"}</span>
                      <span className="text-sm font-semibold text-primary">
                        {editing.parcelas && editing.parcelas > 1 ? `${editing.parcelas}x ${formatCurrency(p.perParcela)}` : formatCurrency(p.total)}
                      </span>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={() => {
              if (!editing) return;
              if (editing.aging_min_days != null && editing.aging_max_days != null && editing.aging_min_days > editing.aging_max_days) {
                toast.error("Aging 'De' não pode ser maior que 'Até'");
                return;
              }
              upsert.mutate(editing);
            }} disabled={upsert.isPending || !editing?.nome}>
              {upsert.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CredorAgreementTemplates;
