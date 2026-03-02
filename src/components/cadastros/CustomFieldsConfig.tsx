import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchCustomFields, createCustomField, updateCustomField, deleteCustomField, type CustomField } from "@/services/customFieldsService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Tags } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista de opções" },
];

const CustomFieldsConfig = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomField | null>(null);
  const [form, setForm] = useState({ field_key: "", field_label: "", field_type: "text", options: "" });

  const { data: fields = [], isLoading } = useQuery({
    queryKey: ["custom-fields", tenant?.id],
    queryFn: () => fetchCustomFields(tenant!.id),
    enabled: !!tenant?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof createCustomField>[0]) => createCustomField(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      toast.success("Campo criado com sucesso");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao criar campo"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<CustomField> }) => updateCustomField(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      toast.success("Campo atualizado");
      closeDialog();
    },
    onError: (err: any) => toast.error(err.message || "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCustomField,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["custom-fields"] });
      toast.success("Campo removido");
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditing(null);
    setForm({ field_key: "", field_label: "", field_type: "text", options: "" });
  };

  const openNew = () => {
    setEditing(null);
    setForm({ field_key: "", field_label: "", field_type: "text", options: "" });
    setDialogOpen(true);
  };

  const openEdit = (field: CustomField) => {
    setEditing(field);
    setForm({
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type,
      options: Array.isArray(field.options) ? field.options.join(", ") : "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.field_label.trim()) {
      toast.error("Nome do campo é obrigatório");
      return;
    }

    const key = form.field_key.trim() || form.field_label.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const options = form.field_type === "select"
      ? form.options.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

    if (editing) {
      updateMutation.mutate({
        id: editing.id,
        updates: { field_label: form.field_label, field_type: form.field_type, options },
      });
    } else {
      createMutation.mutate({
        tenant_id: tenant!.id,
        field_key: key,
        field_label: form.field_label.trim(),
        field_type: form.field_type,
        options,
      });
    }
  };

  const toggleActive = (field: CustomField) => {
    updateMutation.mutate({ id: field.id, updates: { is_active: !field.is_active } });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Campos Personalizados</h3>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Novo Campo
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Crie campos extras para armazenar informações adicionais dos clientes. Estes campos ficam disponíveis no mapeamento de importação.
      </p>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : fields.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum campo personalizado criado</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.field_label}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{field.field_key}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {FIELD_TYPES.find((t) => t.value === field.field_type)?.label || field.field_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={field.is_active} onCheckedChange={() => toggleActive(field)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(field)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(field.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(v) => !v && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Campo" : "Novo Campo Personalizado"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do Campo</Label>
              <Input
                placeholder="Ex: Nº Processo"
                value={form.field_label}
                onChange={(e) => setForm({ ...form, field_label: e.target.value })}
              />
            </div>
            {!editing && (
              <div>
                <Label>Chave (gerada automaticamente se vazio)</Label>
                <Input
                  placeholder="Ex: num_processo"
                  value={form.field_key}
                  onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                  className="font-mono"
                />
              </div>
            )}
            <div>
              <Label>Tipo</Label>
              <Select value={form.field_type} onValueChange={(v) => setForm({ ...form, field_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.field_type === "select" && (
              <div>
                <Label>Opções (separadas por vírgula)</Label>
                <Input
                  placeholder="Opção 1, Opção 2, Opção 3"
                  value={form.options}
                  onChange={(e) => setForm({ ...form, options: e.target.value })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomFieldsConfig;
