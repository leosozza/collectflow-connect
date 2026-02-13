import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Loader2, Ear } from "lucide-react";
import { toast } from "sonner";

interface SpyButtonProps {
  agentId: number;
  agentName: string;
  domain: string;
  apiToken: string;
  disabled?: boolean;
}

const SpyButton = ({ agentId, agentName, domain, apiToken, disabled }: SpyButtonProps) => {
  const [open, setOpen] = useState(false);
  const [extension, setExtension] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSpy = async () => {
    if (!extension && !phoneNumber) {
      toast.error("Informe um ramal ou telefone");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
        body: {
          action: "spy_agent",
          domain,
          api_token: apiToken,
          agent_id: agentId,
          extension: extension || undefined,
          phone_number: phoneNumber.replace(/\D/g, "") || undefined,
        },
      });
      if (error) throw error;
      toast.success(`Espionagem iniciada para ${agentName}. Aguarde a ligação no seu ramal.`);
      setOpen(false);
    } catch (err: any) {
      toast.error("Erro ao espionar: " + (err.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={`Espionar ${agentName}`}
      >
        <Ear className="w-4 h-4" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Espionar Agente</DialogTitle>
            <DialogDescription>
              Escute a ligação de <strong>{agentName}</strong> em tempo real. Informe seu ramal ou telefone para receber a chamada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Ramal</Label>
              <Input placeholder="Ex: 1001" value={extension} onChange={(e) => setExtension(e.target.value)} />
            </div>
            <div className="text-center text-xs text-muted-foreground">ou</div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input placeholder="DDD + Número" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSpy} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ear className="w-4 h-4" />}
              Espionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SpyButton;
