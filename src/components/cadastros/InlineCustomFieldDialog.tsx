import { useState } from "react";
import { createCustomField, type CustomField } from "@/services/customFieldsService";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";

interface Props {
  tenantId: string;
  onCreated: (field: CustomField) => void;
}

const InlineCustomFieldDialog = ({ tenantId, onCreated }: Props) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState("text");
  const [saving, setSaving] = useState(false);

  const generateKey = (lbl: string) =>
    lbl
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

  const handleCreate = async () => {
    const key = generateKey(label);
    if (!key) {
      toast.error("Nome do campo inválido");
      return;
    }
    setSaving(true);
    try {
      const created = await createCustomField({
        tenant_id: tenantId,
        field_key: key,
        field_label: label.trim(),
        field_type: type,
      });
      qc.invalidateQueries({ queryKey: ["custom-fields"] });
      toast.success(`Campo "${label}" criado`);
      onCreated(created);
      setOpen(false);
      setLabel("");
      setType("text");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar campo");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-8 w-8 shrink-0"
        title="Novo Campo Personalizado"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Plus className="w-3.5 h-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Novo Campo Personalizado</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome do Campo *</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Nº Processo"
                autoFocus
              />
              {label && (
                <p className="text-[10px] text-muted-foreground">
                  Chave: <code className="bg-muted px-1 rounded">{generateKey(label)}</code>
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="select">Lista de opções</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!label.trim() || saving}>
              {saving ? "Criando..." : "Criar Campo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InlineCustomFieldDialog;
