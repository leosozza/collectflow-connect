import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import type { WhatsAppInstance } from "@/services/whatsappInstanceService";

interface BaylersInstanceFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; instance_url: string; api_key: string; instance_name: string }) => void;
  saving: boolean;
  instance?: WhatsAppInstance | null;
}

const BaylersInstanceForm = ({ open, onClose, onSave, saving, instance }: BaylersInstanceFormProps) => {
  const [name, setName] = useState("");
  const [instanceUrl, setInstanceUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [instanceName, setInstanceName] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (open) {
      setName(instance?.name || "");
      setInstanceUrl(instance?.instance_url || "");
      setApiKey(instance?.api_key || "");
      setInstanceName(instance?.instance_name || "");
      setShowKey(false);
    }
  }, [open, instance]);

  const canSave = instanceUrl.trim() && apiKey.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{instance ? "Editar Instância" : "Nova Instância Baylers"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome (apelido)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Cobrança, Vendas" />
          </div>
          <div className="space-y-2">
            <Label>URL da Instância *</Label>
            <Input value={instanceUrl} onChange={(e) => setInstanceUrl(e.target.value)} placeholder="https://minha-instancia.com" />
          </div>
          <div className="space-y-2">
            <Label>API Key *</Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Chave de API"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nome da Instância (API)</Label>
            <Input value={instanceName} onChange={(e) => setInstanceName(e.target.value)} placeholder="default" />
            <p className="text-xs text-muted-foreground">Nome técnico usado na chamada da API</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!canSave || saving}
            onClick={() => onSave({
              name: name.trim(),
              instance_url: instanceUrl.trim().replace(/\/+$/, ""),
              api_key: apiKey.trim(),
              instance_name: instanceName.trim() || "default",
            })}
          >
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BaylersInstanceForm;
