import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  fetchTenantDispositionTypes,
  createDispositionType,
  updateDispositionType,
  deleteDispositionType,
  DISPOSITION_TYPES,
  type DbDispositionType,
} from "@/services/dispositionService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const GROUP_OPTIONS = [
  { value: "resultado", label: "Resultado do Contato" },
  { value: "contato", label: "Erro de Cadastro" },
  { value: "outros", label: "Outros" },
];

interface FormState {
  id?: string;
  label: string;
  key: string;
  group_name: string;
  sort_order: number;
  active: boolean;
}

const emptyForm: FormState = {
  label: "",
  key: "",
  group_name: "resultado",
  sort_order: 0,
  active: true,
};

const CallDispositionTypesTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [autoKey, setAutoKey] = useState(true);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["call-disposition-types", tenantId],
    queryFn: async () => {
      const { data, error } = await (await import("@/integrations/supabase/client")).supabase
        .from("call_disposition_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as DbDispositionType[];
    },
    enabled: !!tenantId,
  });

  const createMut = useMutation({
    mutationFn: (p: Parameters<typeof createDispositionType>[0]) => createDispositionType(p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Categorização criada");
      setOpen(false);
    },
    onError: () => toast.error("Erro ao criar categorização"),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...p }: { id: string } & Parameters<typeof updateDispositionType>[1]) =>
      updateDispositionType(id, p),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Categorização atualizada");
      setOpen(false);
    },
    onError: () => toast.error("Erro ao atualizar"),
  });

  const deleteMut = useMutation({
    mutationFn: deleteDispositionType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      toast.success("Categorização removida");
    },
    onError: () => toast.error("Erro ao remover"),
  });

  const openNew = () => {
    setForm(emptyForm);
    setAutoKey(true);
    setOpen(true);
  };

  const openEdit = (t: DbDispositionType) => {
    setForm({
      id: t.id,
      label: t.label,
      key: t.key,
      group_name: t.group_name,
      sort_order: t.sort_order,
      active: t.active,
    });
    setAutoKey(false);
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) {
      toast.error("Informe o nome da categorização");
      return;
    }
    const key = form.key || slugify(form.label);
    if (form.id) {
      updateMut.mutate({ id: form.id, label: form.label, group_name: form.group_name, sort_order: form.sort_order, active: form.active });
    } else {
      createMut.mutate({ tenant_id: tenantId!, key, label: form.label, group_name: form.group_name, sort_order: form.sort_order });
    }
  };

  const defaults = Object.entries(DISPOSITION_TYPES).map(([key, label]) => ({ key, label }));
  const hasCustom = types.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {hasCustom
            ? `${types.length} categorização(ões) personalizada(s) configurada(s).`
            : "Nenhuma personalização. Usando padrões do sistema."}
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nova Categorização
        </Button>
      </div>

      {/* Defaults info */}
      {!hasCustom && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">Padrões do Sistema</p>
          <div className="flex flex-wrap gap-2">
            {defaults.map(d => (
              <Badge key={d.key} variant="secondary">{d.label}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Custom table */}
      {hasCustom && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Chave</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Ordem</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell className="text-muted-foreground text-xs font-mono">{t.key}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {GROUP_OPTIONS.find(g => g.value === t.group_name)?.label || t.group_name}
                  </Badge>
                </TableCell>
                <TableCell>{t.sort_order}</TableCell>
                <TableCell>
                  <Badge variant={t.active ? "default" : "secondary"}>
                    {t.active ? "Sim" : "Não"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteMut.mutate(t.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar" : "Nova"} Categorização</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.label}
                onChange={e => {
                  const label = e.target.value;
                  setForm(f => ({ ...f, label, ...(autoKey ? { key: slugify(label) } : {}) }));
                }}
                placeholder="Ex: CPC (Contato com a Pessoa Certa)"
              />
            </div>
            <div className="space-y-2">
              <Label>Chave (slug)</Label>
              <Input
                value={form.key}
                onChange={e => { setAutoKey(false); setForm(f => ({ ...f, key: e.target.value })); }}
                placeholder="cpc"
                disabled={!!form.id}
              />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={form.group_name} onValueChange={v => setForm(f => ({ ...f, group_name: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {GROUP_OPTIONS.map(g => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ordem</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
            {form.id && (
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={v => setForm(f => ({ ...f, active: v }))} />
                <Label>Ativo</Label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {form.id ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CallDispositionTypesTab;
