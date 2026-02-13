import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface BaylersInstanceFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string }) => void;
  saving: boolean;
  tenantName: string;
}

const BaylersInstanceForm = ({ open, onClose, onSave, saving, tenantName }: BaylersInstanceFormProps) => {
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
    }
  }, [open]);

  const instanceNamePreview = name.trim() ? `${tenantName} - ${name.trim()}` : "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Instância</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Instância *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Agente 01, Cobrança"
              autoFocus
            />
          </div>
          {instanceNamePreview && (
            <div className="rounded-md bg-muted p-3">
              <p className="text-xs text-muted-foreground mb-1">Nome na Evolution API:</p>
              <p className="text-sm font-medium">{instanceNamePreview}</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!name.trim() || saving}
            onClick={() => onSave({ name: name.trim() })}
          >
            {saving ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BaylersInstanceForm;
