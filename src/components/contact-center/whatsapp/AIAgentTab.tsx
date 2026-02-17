import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Bot, Save, Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

const PERSONALITY_OPTIONS = [
  "Amigável", "Profissional", "Educado", "Engraçado",
  "Prestativo", "Empático", "Direto ao ponto", "Formal", "Perspicaz"
];

interface AIAgent {
  id: string;
  tenant_id: string;
  identifier: string;
  name: string;
  gender: string;
  personality: string[];
  context: string;
  is_default: boolean;
  is_active: boolean;
  profile_id: string | null;
  credor_id: string | null;
  created_at: string;
  updated_at: string;
}

const emptyAgent = (): Partial<AIAgent> => ({
  identifier: "",
  name: "",
  gender: "masculino",
  personality: [],
  context: "",
  is_default: false,
  is_active: true,
});

const AIAgentTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selected, setSelected] = useState<Partial<AIAgent> | null>(null);
  const [saving, setSaving] = useState(false);
  const [credores, setCredores] = useState<{ id: string; razao_social: string }[]>([]);

  const loadAgents = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("ai_agents" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at");
    setAgents((data || []) as unknown as AIAgent[]);
  };

  const loadCredores = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("credores")
      .select("id, razao_social")
      .eq("tenant_id", tenantId)
      .eq("status", "ativo");
    setCredores(data || []);
  };

  useEffect(() => {
    loadAgents();
    loadCredores();
  }, [tenantId]);

  const togglePersonality = (trait: string) => {
    if (!selected) return;
    const current = selected.personality || [];
    const updated = current.includes(trait)
      ? current.filter((t) => t !== trait)
      : [...current, trait];
    setSelected({ ...selected, personality: updated });
  };

  const handleSave = async () => {
    if (!selected || !tenantId) return;
    if (!selected.identifier?.trim()) {
      toast.error("Preencha o identificador do agente");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        identifier: selected.identifier,
        name: selected.name || "",
        gender: selected.gender || "masculino",
        personality: selected.personality || [],
        context: selected.context || "",
        is_default: selected.is_default || false,
        is_active: selected.is_active ?? true,
        credor_id: selected.credor_id || null,
      };

      if (selected.id) {
        const { error } = await supabase
          .from("ai_agents" as any)
          .update(payload as any)
          .eq("id", selected.id);
        if (error) throw error;
        toast.success("Agente atualizado!");
      } else {
        const { error } = await supabase
          .from("ai_agents" as any)
          .insert(payload as any);
        if (error) throw error;
        toast.success("Agente criado!");
      }
      await loadAgents();
      setSelected(null);
    } catch {
      toast.error("Erro ao salvar agente");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("ai_agents" as any).delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    toast.success("Agente excluído");
    if (selected?.id === id) setSelected(null);
    loadAgents();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* List existing agents */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" /> Agentes Inteligentes
        </h2>
        <Button size="sm" onClick={() => setSelected(emptyAgent())}>
          <Plus className="w-4 h-4 mr-1" /> Novo Agente
        </Button>
      </div>

      {agents.length > 0 && !selected && (
        <div className="grid gap-3">
          {agents.map((a) => (
            <Card key={a.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(a)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{a.identifier}</div>
                  <div className="text-sm text-muted-foreground">
                    {a.name || "Sem nome"} • {a.gender === "masculino" ? "♂" : "♀"} •{" "}
                    {(a.personality as string[])?.length || 0} traços
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.is_default && <Badge variant="secondary" className="text-xs">Padrão</Badge>}
                  <Badge variant={a.is_active ? "default" : "outline"} className="text-xs">
                    {a.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => { e.stopPropagation(); handleDelete(a.id); }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit/Create form */}
      {selected && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificador do Agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Identificador interno</Label>
                <Input
                  value={selected.identifier || ""}
                  onChange={(e) => setSelected({ ...selected, identifier: e.target.value })}
                  placeholder="Ex: agente-cobranca-01"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selected.is_active ?? true}
                    onCheckedChange={(v) => setSelected({ ...selected, is_active: v })}
                  />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={selected.is_default ?? false}
                    onCheckedChange={(v) => setSelected({ ...selected, is_default: v })}
                  />
                  <Label>Agente Padrão</Label>
                </div>
              </div>
              <div>
                <Label>Vincular a Credor</Label>
                <Select
                  value={selected.credor_id || "none"}
                  onValueChange={(v) => setSelected({ ...selected, credor_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um credor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {credores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personalidade</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Nome do agente (público)</Label>
                <Input
                  value={selected.name || ""}
                  onChange={(e) => setSelected({ ...selected, name: e.target.value })}
                  placeholder="Ex: Ana"
                />
              </div>
              <div>
                <Label>Gênero</Label>
                <Select
                  value={selected.gender || "masculino"}
                  onValueChange={(v) => setSelected({ ...selected, gender: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Personalidade</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PERSONALITY_OPTIONS.map((trait) => {
                    const active = (selected.personality || []).includes(trait);
                    return (
                      <Badge
                        key={trait}
                        variant={active ? "default" : "outline"}
                        className="cursor-pointer select-none"
                        onClick={() => togglePersonality(trait)}
                      >
                        {trait}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contexto e Conhecimento</CardTitle>
              <CardDescription className="flex items-start gap-1.5">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                O seu assistente saberá responder sobre tudo que está aqui, não economize nas informações. Tudo que você quer que ele saiba responder precisa estar aqui.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={selected.context || ""}
                onChange={(e) => setSelected({ ...selected, context: e.target.value })}
                placeholder="Insira aqui todas as informações sobre o credor, regras de negociação, valores, descontos permitidos, horários de atendimento..."
                className="min-h-[200px]"
              />
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-1" />
              {selected.id ? "Atualizar" : "Criar"} Agente
            </Button>
            <Button variant="outline" onClick={() => setSelected(null)}>Cancelar</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIAgentTab;
