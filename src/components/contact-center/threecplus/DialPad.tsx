import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, PhoneOff, LogIn, LogOut } from "lucide-react";
import { toast } from "sonner";

interface DialPadProps {
  domain: string;
  apiToken: string;
  agentId?: number;
}

const keys = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const DialPad = ({ domain, apiToken, agentId }: DialPadProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [inManualMode, setInManualMode] = useState(false);
  const [calling, setCalling] = useState(false);
  const [toggling, setToggling] = useState(false);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const handleKeyPress = (key: string) => {
    setPhoneNumber((prev) => prev + key);
  };

  const handleBackspace = () => {
    setPhoneNumber((prev) => prev.slice(0, -1));
  };

  const handleEnterManual = async () => {
    setToggling(true);
    try {
      await invoke("manual_call_enter");
      setInManualMode(true);
      toast.success("Modo manual ativado");
    } catch {
      toast.error("Erro ao entrar no modo manual");
    } finally {
      setToggling(false);
    }
  };

  const handleExitManual = async () => {
    setToggling(true);
    try {
      await invoke("manual_call_exit");
      setInManualMode(false);
      toast.success("Modo manual desativado");
    } catch {
      toast.error("Erro ao sair do modo manual");
    } finally {
      setToggling(false);
    }
  };

  const handleDial = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Digite um número");
      return;
    }
    setCalling(true);
    try {
      if (inManualMode) {
        await invoke("manual_call_dial", { phone_number: phoneNumber });
      } else if (agentId) {
        await invoke("click2call", { agent_id: agentId, phone_number: phoneNumber });
      } else {
        toast.error("Entre no modo manual ou vincule um agente");
        setCalling(false);
        return;
      }
      toast.success("Ligação iniciada");
    } catch {
      toast.error("Erro ao discar");
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
      <h3 className="text-sm font-semibold text-card-foreground text-center">Teclado Telefônico</h3>

      {/* Phone number display */}
      <div className="flex gap-1">
        <Input
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value.replace(/[^\d*#+ ]/g, ""))}
          placeholder="Digite o número"
          className="text-center text-lg font-mono tracking-wider h-10"
        />
        {phoneNumber && (
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleBackspace}>
            ⌫
          </Button>
        )}
      </div>

      {/* Keypad grid */}
      <div className="grid grid-cols-3 gap-1.5">
        {keys.flat().map((key) => (
          <Button
            key={key}
            variant="outline"
            className="h-11 text-lg font-semibold"
            onClick={() => handleKeyPress(key)}
          >
            {key}
          </Button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-2">
        <Button
          className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={handleDial}
          disabled={calling || !phoneNumber.trim()}
        >
          <Phone className="w-4 h-4" />
          {calling ? "Discando..." : "Ligar"}
        </Button>
        <Button
          variant="destructive"
          className="gap-1.5"
          onClick={() => {
            setPhoneNumber("");
            toast.info("Número limpo");
          }}
        >
          <PhoneOff className="w-4 h-4" />
          Limpar
        </Button>
      </div>

      {/* Manual mode toggle */}
      <Button
        variant="outline"
        size="sm"
        className={`w-full gap-1.5 text-xs ${inManualMode ? "border-amber-500 text-amber-600" : ""}`}
        onClick={inManualMode ? handleExitManual : handleEnterManual}
        disabled={toggling}
      >
        {inManualMode ? <LogOut className="w-3.5 h-3.5" /> : <LogIn className="w-3.5 h-3.5" />}
        {toggling ? "Aguarde..." : inManualMode ? "Sair do Modo Manual" : "Entrar no Modo Manual"}
      </Button>
    </div>
  );
};

export default DialPad;
