import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import {
  fetchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  WhatsAppTemplate,
  TEMPLATE_CATEGORIES,
  TEMPLATE_VARIABLES,
  SAMPLE_DATA,
} from "@/services/whatsappTemplateService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, MessageSquare, Eye } from "lucide-react";

const WhatsAppTemplatesTab = () => {
  const { tenant } = useTenant();
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState("cobranca");
  const [messageBody, setMessageBody] = useState(
    "Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}. Entre em contato para regularizar."
  );

  const loadTemplates = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const cat = filterCategory === "all" ? undefined : filterCategory;
      const data = await fetchTemplates(tenant.id, cat);
      setTemplates(data);
    } catch {
      toast.error("Erro ao carregar templates");
    } finally {
      setLoading(false);
    }
  }, [tenant, filterCategory]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const resetForm = () => {
    setName("");
    setCategory("cobranca");
    setMessageBody("Olá {{nome}}, sua parcela de {{valor_parcela}} vence em {{data_vencimento}}. Entre em contato para regularizar.");
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (t: WhatsAppTemplate) => {
    setName(t.name);
    setCategory(t.category);
    setMessageBody(t.message_body);
    setEditing(t);
    setShowForm(true);
  };

  const detectVariables = (body: string): string[] =>
    TEMPLATE_VARIABLES.filter((v) => body.includes(v));

  const handleSave = async () => {
    if (!tenant || !name.trim() || !messageBody.trim()) return;
    setSaving(true);
    try {
      const vars = detectVariables(messageBody);
      if (editing) {
        await updateTemplate(editing.id, { name, category, message_body: messageBody, variables: vars });
        toast.success("Template atualizado!");
      } else {
        await createTemplate({
          tenant_id: tenant.id,
          name,
          category,
          message_body: messageBody,
          variables: vars,
          is_active: true,
        });
        toast.success("Template criado!");
      }
      resetForm();
      await loadTemplates();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar template");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (t: WhatsAppTemplate) => {
    try {
      await updateTemplate(t.id, { is_active: !t.is_active });
      await loadTemplates();
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (t: WhatsAppTemplate) => {
    if (!confirm(`Excluir template "${t.name}"?`)) return;
    try {
      await deleteTemplate(t.id);
      toast.success("Template excluído!");
      await loadTemplates();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const preview = TEMPLATE_VARIABLES.reduce(
    (text, v) => text.split(v).join(SAMPLE_DATA[v] || v),
    messageBody
  );

  const categoryLabel = (cat: string) =>
    TEMPLATE_CATEGORIES.find((c) => c.value === cat)?.label || cat;

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            {editing ? "Editar Template" : "Novo Template WhatsApp"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do template</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Lembrete de vencimento"
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Corpo da mensagem</Label>
          <div className="flex flex-wrap gap-1 mb-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMessageBody((t) => t + " " + v)}
                className="text-xs px-1.5 py-0.5 rounded bg-muted hover:bg-accent transition-colors font-mono"
              >
                {v}
              </button>
            ))}
          </div>
          <Textarea
            value={messageBody}
            onChange={(e) => setMessageBody(e.target.value)}
            rows={4}
            className="text-xs"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs flex items-center gap-1">
            <Eye className="w-3 h-3" /> Preview
          </Label>
          <div className="p-3 rounded-md bg-muted text-xs whitespace-pre-wrap">{preview}</div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || !messageBody.trim()}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
          <Button size="sm" variant="outline" onClick={resetForm}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Templates WhatsApp
          </p>
          <p className="text-xs text-muted-foreground">
            Templates reutilizáveis para disparos em lote e automações
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="Filtrar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {TEMPLATE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="w-3 h-3 mr-1" /> Novo Template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Carregando...</div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum template cadastrado.</p>
          <p className="text-xs">Crie templates para usar nos disparos em lote.</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Variáveis</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="text-sm font-medium">{t.name}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {categoryLabel(t.category)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(t.variables || []).map((v) => (
                      <span key={v} className="text-[10px] font-mono bg-muted px-1 rounded">
                        {v}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch checked={t.is_active} onCheckedChange={() => handleToggle(t)} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
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

export default WhatsAppTemplatesTab;
