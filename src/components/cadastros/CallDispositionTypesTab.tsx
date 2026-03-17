import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  createDispositionType,
  updateDispositionType,
  deleteDispositionType,
  seedDefaultDispositionTypes,
  DEFAULT_DISPOSITION_LIST,
  type DbDispositionType,
} from "@/services/dispositionService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

const slugify = (text: string) =>
  text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const GROUP_OPTIONS = [
  { value: "resultado", label: "Resultado do Contato" },
  { value: "contato", label: "Erro de Cadastro" },
  { value: "outros", label: "Outros" },
];

interface FormState {
  id?: string;
  label: string;
  group_name: string;
  sort_order: number;
  active: boolean;
}

const emptyForm: FormState = { label: "", group_name: "resultado", sort_order: 0, active: true };

const CallDispositionTypesTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [seeded, setSeeded] = useState(false);

  const { data: types = [], isLoading } = useQuery({
    queryKey: ["call-disposition-types", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_disposition_types")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data || []) as DbDispositionType[];
    },
    enabled: !!tenantId,
  });

  // Auto-seed defaults when tenant has no records
  const seedMut = useMutation({
    mutationFn: () => seedDefaultDispositionTypes(tenantId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-disposition-types"] });
      setSeeded(true);
    },
  });

  useEffect(() => {
    if (!isLoading && tenantId && !seeded && !seedMut.isPending) {
      const missingDefaults = DEFAULT_DISPOSITION_LIST.some(
        d => !types.find(t => t.key === d.key)
      );
      if (missingDefaults) {
        seedMut.mutate();
      }
    }
  }, [isLoading, tenantId, types, seeded, seedMut.isPending]);

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
    setForm({ ...emptyForm, sort_order: types.length });
    setOpen(true);
  };

  const openEdit = (t: DbDispositionType) => {
    setForm({ id: t.id, label: t.label, group_name: t.group_name, sort_order: t.sort_order, active: t.active });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error("Informe o nome da categorização"); return; }
    if (form.id) {
      updateMut.mutate({ id: form.id, label: form.label, group_name: form.group_name, sort_order: form.sort_order, active: form.active });
    } else {
      createMut.mutate({ tenant_id: tenantId!, key: slugify(form.label), label: form.label, group_name: form.group_name, sort_order: form.sort_order });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {types.length > 0
            ? `${types.length} categorização(ões) configurada(s).`
            : "Carregando categorizações..."}
        </p>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Nova Categorização
        </Button>
      </div>

      {types.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Grupo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map(t => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.label}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {GROUP_OPTIONS.find(g => g.value === t.group_name)?.label || t.group_name}
                  </Badge>
                </TableCell>
                
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
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="Ex: CPC (Contato com a Pessoa Certa)"
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
