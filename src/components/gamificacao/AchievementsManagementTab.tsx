import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { grantAchievement } from "@/services/gamificationService";
import {
  fetchAchievementTemplates, createAchievementTemplate,
  updateAchievementTemplate, deleteAchievementTemplate,
  AchievementTemplate, CRITERIA_OPTIONS,
} from "@/services/achievementTemplateService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Award, Pencil, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

const EMOJI_OPTIONS = ["🎯", "🔟", "🛡️", "🏆", "👑", "💰", "💎", "⭐", "🚀", "🔥", "🎖️", "🏅"];

const AchievementsManagementTab = () => {
  const { tenant } = useTenant();
  const qc = useQueryClient();
  const [subTab, setSubTab] = useState("templates");

  // ---- TEMPLATES STATE ----
  const [templateOpen, setTemplateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AchievementTemplate | null>(null);
  const [tTitle, setTTitle] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [tIcon, setTIcon] = useState("🎯");
  const [tCriteria, setTCriteria] = useState("manual");
  const [tCriteriaValue, setTCriteriaValue] = useState(0);
  const [tPoints, setTPoints] = useState(50);
  const [tCredorId, setTCredorId] = useState<string>("");

  // ---- GRANT STATE ----
  const [grantOpen, setGrantOpen] = useState(false);
  const [grantTemplateId, setGrantTemplateId] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");

  const { data: templates = [] } = useQuery({
    queryKey: ["achievement-templates", tenant?.id],
    queryFn: () => fetchAchievementTemplates(tenant!.id),
    enabled: !!tenant?.id,
  });

  const { data: credores = [] } = useQuery({
    queryKey: ["credores-active", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("id, razao_social")
        .eq("tenant_id", tenant!.id)
        .eq("status", "ativo")
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  const { data: allAchievements = [] } = useQuery({
    queryKey: ["all-achievements", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*, profiles!achievements_profile_id_fkey(full_name)")
        .eq("tenant_id", tenant!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Template CRUD
  const openTemplateForm = (t?: AchievementTemplate) => {
    if (t) {
      setEditingTemplate(t);
      setTTitle(t.title);
      setTDesc(t.description);
      setTIcon(t.icon);
      setTCriteria(t.criteria_type);
      setTCriteriaValue(t.criteria_value);
      setTPoints(t.points_reward);
      setTCredorId(t.credor_id || "");
    } else {
      setEditingTemplate(null);
      setTTitle("");
      setTDesc("");
      setTIcon("🎯");
      setTCriteria("manual");
      setTCriteriaValue(0);
      setTPoints(50);
      setTCredorId("");
    }
    setTemplateOpen(true);
  };

  const saveTemplateMut = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant!.id,
        credor_id: tCredorId || null,
        title: tTitle,
        description: tDesc,
        icon: tIcon,
        criteria_type: tCriteria,
        criteria_value: tCriteriaValue,
        points_reward: tPoints,
        is_active: true,
      };
      if (editingTemplate) {
        await updateAchievementTemplate(editingTemplate.id, payload);
      } else {
        await createAchievementTemplate(payload);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievement-templates"] });
      setTemplateOpen(false);
      toast.success(editingTemplate ? "Template atualizado!" : "Template criado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: deleteAchievementTemplate,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achievement-templates"] });
      toast.success("Template excluído!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Grant achievement from template
  const grantMut = useMutation({
    mutationFn: async () => {
      const template = templates.find((t) => t.id === grantTemplateId);
      if (!template) throw new Error("Template não encontrado");
      return grantAchievement({
        profile_id: selectedOperator,
        tenant_id: tenant!.id,
        title: template.title,
        description: template.description,
        icon: template.icon,
      });
    },
    onSuccess: (wasNew) => {
      qc.invalidateQueries({ queryKey: ["all-achievements"] });
      setGrantOpen(false);
      setGrantTemplateId("");
      setSelectedOperator("");
      toast.success(wasNew ? "Conquista concedida!" : "Operador já possui essa conquista.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const credorName = (id: string | null) =>
    id ? credores.find((c: any) => c.id === id)?.razao_social || "—" : "Global";

  return (
    <div className="space-y-4">
      <Tabs value={subTab} onValueChange={setSubTab}>
        <TabsList>
          <TabsTrigger value="templates" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Templates
          </TabsTrigger>
          <TabsTrigger value="concedidas" className="gap-1.5">
            <Award className="w-3.5 h-3.5" /> Concedidas
          </TabsTrigger>
        </TabsList>

        {/* TEMPLATES TAB */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openTemplateForm()} className="gap-1.5">
              <Plus className="w-4 h-4" /> Novo Template
            </Button>
          </div>

          <Card className="border-border">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Critério</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead className="w-16">Pts</TableHead>
                    <TableHead className="w-16">Ativo</TableHead>
                    <TableHead className="w-20"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.icon}</TableCell>
                      <TableCell className="font-medium">{t.title}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {CRITERIA_OPTIONS.find((c) => c.value === t.criteria_type)?.label || t.criteria_type}
                        {t.criteria_value > 0 && ` (${t.criteria_value})`}
                      </TableCell>
                      <TableCell className="text-xs">{credorName(t.credor_id)}</TableCell>
                      <TableCell>{t.points_reward}</TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "default" : "secondary"} className="text-[10px]">
                          {t.is_active ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openTemplateForm(t)}>
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteTemplateMut.mutate(t.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {templates.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nenhum template criado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONCEDIDAS TAB */}
        <TabsContent value="concedidas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setGrantOpen(true)} className="gap-1.5" disabled={templates.length === 0}>
              <Plus className="w-4 h-4" /> Conceder Conquista
            </Button>
          </div>

          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                Conquistas Concedidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allAchievements.map((a: any) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.icon || "🏅"}</TableCell>
                      <TableCell className="font-medium">{a.title}</TableCell>
                      <TableCell>{a.profiles?.full_name || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(a.earned_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  ))}
                  {allAchievements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Nenhuma conquista registrada.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Form Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Template" : "Novo Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={tTitle} onChange={(e) => setTTitle(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={tDesc} onChange={(e) => setTDesc(e.target.value)} />
            </div>
            <div>
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {EMOJI_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setTIcon(e)}
                    className={`text-xl p-1 rounded ${tIcon === e ? "bg-primary/20 ring-2 ring-primary" : "hover:bg-muted"}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Critério</Label>
                <Select value={tCriteria} onValueChange={setTCriteria}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CRITERIA_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor do Critério</Label>
                <Input type="number" min={0} value={tCriteriaValue} onChange={(e) => setTCriteriaValue(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Pontos</Label>
                <Input type="number" min={0} value={tPoints} onChange={(e) => setTPoints(Number(e.target.value))} />
              </div>
              <div>
                <Label>Credor</Label>
                <Select value={tCredorId || "__global__"} onValueChange={(v) => setTCredorId(v === "__global__" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__global__">Global (todos)</SelectItem>
                    {credores.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveTemplateMut.mutate()} disabled={!tTitle || saveTemplateMut.isPending}>
                {saveTemplateMut.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Grant Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder Conquista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template *</Label>
              <Select value={grantTemplateId} onValueChange={setGrantTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => t.is_active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.icon} {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Operador *</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {operators.map((op: any) => (
                    <SelectItem key={op.id} value={op.id}>{op.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => grantMut.mutate()}
                disabled={!selectedOperator || !grantTemplateId || grantMut.isPending}
              >
                {grantMut.isPending ? "Salvando..." : "Conceder"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AchievementsManagementTab;
