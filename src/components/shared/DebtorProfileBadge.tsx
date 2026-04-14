import { useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { supabase } from "@/integrations/supabase/client";
import { recalcScoreForCpf } from "@/hooks/useScoreRecalc";
import { toast } from "sonner";
import { Loader2, UserCircle } from "lucide-react";

const PROFILES = [
  { value: "ocasional", label: "Ocasional", color: "hsl(142, 71%, 45%)", desc: "Atrasou, mas paga" },
  { value: "recorrente", label: "Recorrente", color: "hsl(45, 93%, 47%)", desc: "Sempre atrasa" },
  { value: "insatisfeito", label: "Insatisfeito", color: "hsl(25, 95%, 53%)", desc: "Reclamações/contestação" },
  { value: "resistente", label: "Resistente", color: "hsl(0, 84%, 60%)", desc: "Não quer pagar" },
] as const;

interface DebtorProfileBadgeProps {
  clientId: string;
  clientCpf: string;
  tenantId: string;
  currentProfile: string | null;
  onProfileChanged: (newProfile: string | null) => void;
}

const DebtorProfileBadge = ({ clientId, clientCpf, tenantId, currentProfile, onProfileChanged }: DebtorProfileBadgeProps) => {
  const [saving, setSaving] = useState(false);

  const current = PROFILES.find((p) => p.value === currentProfile);

  const handleSelect = async (value: string) => {
    if (saving) return;
    const newValue = value === currentProfile ? null : value;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("clients")
        .update({ debtor_profile: newValue } as any)
        .eq("id", clientId);
      if (error) throw error;

      await supabase.from("client_events").insert({
        client_cpf: clientCpf.replace(/\D/g, ""),
        tenant_id: tenantId,
        event_type: "debtor_profile_changed",
        event_source: "operator",
        event_channel: "whatsapp",
        event_value: newValue,
        metadata: { from: currentProfile, to: newValue },
      });

      onProfileChanged(newValue);
      recalcScoreForCpf(clientCpf);
      toast.success(newValue ? `Perfil alterado para ${PROFILES.find((p) => p.value === newValue)?.label}` : "Perfil removido");
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  return (
    <HoverCard openDelay={200} closeDelay={300}>
      <HoverCardTrigger asChild>
        <button className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-border hover:bg-accent/50 transition-colors w-full">
          {saving ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : current ? (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: current.color }} />
          ) : (
            <UserCircle className="w-3.5 h-3.5 text-muted-foreground" />
          )}
          <span className={current ? "font-medium" : "text-muted-foreground"}>
            {current ? current.label : "Definir perfil"}
          </span>
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-52 p-1.5" side="left">
        <p className="text-[10px] text-muted-foreground font-medium px-2 py-1">Perfil do Devedor</p>
        {PROFILES.map((p) => (
          <button
            key={p.value}
            onClick={() => handleSelect(p.value)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent/60 transition-colors ${
              p.value === currentProfile ? "bg-accent" : ""
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
            <div className="text-left">
              <div className="font-medium">{p.label}</div>
              <div className="text-[10px] text-muted-foreground">{p.desc}</div>
            </div>
          </button>
        ))}
      </HoverCardContent>
    </HoverCard>
  );
};

export default DebtorProfileBadge;
