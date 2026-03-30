import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff } from "lucide-react";

interface WuzApiInstanceFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; serverUrl: string; userToken: string; providerCategory: string }) => void;
  saving: boolean;
}

const WuzApiInstanceForm = ({ open, onClose, onSave, saving }: WuzApiInstanceFormProps) => {
  const [name, setName] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [userToken, setUserToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [providerCategory, setProviderCategory] = useState("unofficial");

  useEffect(() => {
    if (open) {
      setName("");
      setServerUrl("");
      setUserToken("");
      setShowToken(false);
      setProviderCategory("unofficial");
    }
  }, [open]);

  const isValid = name.trim() && serverUrl.trim() && userToken.trim();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Instância WuzAPI</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Instância *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Cobrança 01"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>URL do Servidor *</Label>
            <Input
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://seu-servidor.com"
            />
            <p className="text-xs text-muted-foreground">URL base do seu servidor WuzAPI</p>
          </div>
          <div className="space-y-2">
            <Label>Token do Usuário *</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                value={userToken}
                onChange={(e) => setUserToken(e.target.value)}
                placeholder="Token de autenticação"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Header "Token" para autenticação na API</p>
          </div>
          <div className="space-y-2">
            <Label>Categoria do Provedor</Label>
            <Select value={providerCategory} onValueChange={setProviderCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unofficial">Não-oficial</SelectItem>
                <SelectItem value="official_meta">Oficial Meta</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Define se a instância usa API oficial Meta ou não-oficial</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!isValid || saving}
            onClick={() => onSave({ name: name.trim(), serverUrl: serverUrl.trim(), userToken: userToken.trim(), providerCategory })}
          >
            {saving ? "Criando..." : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WuzApiInstanceForm;
