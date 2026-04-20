import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Pencil, Ban, RotateCcw, Plus, Check, X, Phone as PhoneIcon, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchPhoneMetadata,
  promotePhoneToHot,
  togglePhoneInactive,
  updatePhoneNumber,
  updatePhoneObservation,
  type PhoneSlot,
} from "@/services/clientPhoneService";

interface PhoneListProps {
  tenantId: string;
  cpf: string;
  credor: string;
  phone: string | null;
  phone2: string | null;
  phone3: string | null;
}

const SLOTS: PhoneSlot[] = ["phone", "phone2", "phone3"];

const WhatsAppDot = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="WhatsApp">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const onlyDigits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

export const PhoneList = ({ tenantId, cpf, credor, phone, phone2, phone3 }: PhoneListProps) => {
  const queryClient = useQueryClient();
  const values: Record<PhoneSlot, string | null> = { phone, phone2, phone3 };
  const cleanCpf = onlyDigits(cpf);

  const { data: metadata } = useQuery({
    queryKey: ["phone_metadata", tenantId, cpf, credor],
    queryFn: () => fetchPhoneMetadata({ tenantId, cpf, credor }),
    enabled: !!tenantId && !!cpf && !!credor,
  });

  // Busca quais números têm WhatsApp validado (via client_phones)
  const { data: waPhones = [] } = useQuery({
    queryKey: ["client_phones_wa", tenantId, cleanCpf],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_phones")
        .select("phone_number, phone_last10, is_whatsapp")
        .eq("tenant_id", tenantId)
        .eq("cpf", cleanCpf)
        .eq("is_whatsapp", true);
      return data || [];
    },
    enabled: !!tenantId && !!cleanCpf,
  });

  const waLast10Set = useMemo(() => {
    const s = new Set<string>();
    waPhones.forEach((p: any) => {
      const last10 = p.phone_last10 || onlyDigits(p.phone_number).slice(-10);
      if (last10) s.add(last10);
    });
    return s;
  }, [waPhones]);

  const isWhatsApp = (val: string | null) => {
    if (!val) return false;
    return waLast10Set.has(onlyDigits(val).slice(-10));
  };

  const [busy, setBusy] = useState<PhoneSlot | null>(null);
  const [editingNumber, setEditingNumber] = useState<PhoneSlot | null>(null);
  const [numberDraft, setNumberDraft] = useState("");
  const [obsDrafts, setObsDrafts] = useState<Record<PhoneSlot, string>>({
    phone: "",
    phone2: "",
    phone3: "",
  });

  useEffect(() => {
    if (metadata) {
      setObsDrafts({
        phone: metadata.phone.observacao ?? "",
        phone2: metadata.phone2.observacao ?? "",
        phone3: metadata.phone3.observacao ?? "",
      });
    }
  }, [metadata]);

  const refreshAll = async () => {
    await queryClient.invalidateQueries();
  };

  const findNextEmptySlot = (): PhoneSlot | null => {
    for (const s of SLOTS) {
      if (!values[s]) return s;
    }
    return null;
  };

  const handlePromote = async (slot: PhoneSlot) => {
    if (slot === "phone") return;
    setBusy(slot);
    try {
      await promotePhoneToHot({ tenantId, cpf, credor, slotOrigem: slot });
      toast.success("Número quente atualizado");
      await refreshAll();
    } catch (e: any) {
      toast.error("Erro ao marcar como quente", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleToggleInactive = async (slot: PhoneSlot) => {
    const current = metadata?.[slot].is_inactive ?? false;
    setBusy(slot);
    try {
      const { promotedFrom } = await togglePhoneInactive({
        tenantId, cpf, credor, slot, isInactive: !current,
      });
      toast.success(current ? "Número reativado" : "Número inativado", {
        description: promotedFrom ? "Outro número foi promovido a quente." : undefined,
      });
      await refreshAll();
    } catch (e: any) {
      toast.error("Erro ao alterar status", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const startEditNumber = (slot: PhoneSlot) => {
    setEditingNumber(slot);
    setNumberDraft(values[slot] ?? "");
  };

  const handleSaveNumber = async (slot: PhoneSlot) => {
    setBusy(slot);
    try {
      await updatePhoneNumber({
        tenantId, cpf, credor, slot, newValue: numberDraft.trim() || null,
      });
      toast.success("Número atualizado");
      setEditingNumber(null);
      await refreshAll();
    } catch (e: any) {
      toast.error("Erro ao salvar número", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveObs = async (slot: PhoneSlot) => {
    const value = obsDrafts[slot].trim() || null;
    if ((metadata?.[slot].observacao ?? null) === value) return;
    try {
      await updatePhoneObservation({ tenantId, cpf, credor, slot, observacao: value });
      await queryClient.invalidateQueries({ queryKey: ["phone_metadata", tenantId, cpf, credor] });
    } catch (e: any) {
      toast.error("Erro ao salvar observação", { description: e?.message });
    }
  };

  const handleAddNew = () => {
    const slot = findNextEmptySlot();
    if (!slot) return;
    startEditNumber(slot);
  };

  const visibleSlots = SLOTS.filter((s) => values[s]);
  const nextEmpty = findNextEmptySlot();
  const totalCount = visibleSlots.length;
  const waCount = visibleSlots.filter((s) => isWhatsApp(values[s])).length;

  return (
    <div className="inline-block">
      <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Telefones</p>

      <HoverCard openDelay={120} closeDelay={150}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border/60 bg-card hover:bg-muted/40 transition-colors group"
          >
            <PhoneIcon className="w-3.5 h-3.5 text-muted-foreground" />
            {totalCount === 0 ? (
              <span className="text-xs text-muted-foreground">Nenhum cadastrado</span>
            ) : (
              <>
                <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                  {values.phone ? formatPhone(values.phone) : "—"}
                </span>
                {waCount > 0 && (
                  <WhatsAppDot className="w-3.5 h-3.5 text-green-600 shrink-0" />
                )}
              </>
            )}
            <ChevronDown className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground transition-colors" />
          </button>
        </HoverCardTrigger>

        <HoverCardContent align="start" className="w-[460px] p-2">
          <div className="space-y-1">
            {visibleSlots.map((slot) => {
              const isHot = slot === "phone";
              const meta = metadata?.[slot];
              const inactive = meta?.is_inactive ?? false;
              const value = values[slot];
              const isEditingThis = editingNumber === slot;
              const wa = isWhatsApp(value);

              return (
                <div
                  key={slot}
                  className={cn(
                    "flex items-center gap-1.5 px-1.5 py-1 rounded hover:bg-muted/40 transition-colors",
                    inactive && "opacity-60"
                  )}
                >
                  {/* Hot icon / promote */}
                  <button
                    type="button"
                    disabled={inactive || busy === slot || isHot}
                    onClick={() => !isHot && handlePromote(slot)}
                    title={isHot ? "Número quente atual" : inactive ? "Inativo" : "Marcar como quente"}
                    className={cn(
                      "shrink-0 inline-flex items-center justify-center w-5 h-5 rounded transition-colors",
                      !isHot && !inactive && "hover:bg-orange-500/10",
                      (inactive || isHot) && "cursor-default"
                    )}
                  >
                    <Flame
                      className={cn(
                        "w-3.5 h-3.5",
                        isHot && !inactive ? "text-orange-500 fill-orange-500/30" : "text-muted-foreground/40"
                      )}
                    />
                  </button>

                  {/* Number (or inline edit) */}
                  <div className={cn("shrink-0", isEditingThis ? "w-44" : "w-auto")}>
                    {isEditingThis ? (
                      <div className="flex items-center gap-0.5">
                        <Input
                          autoFocus
                          value={numberDraft}
                          onChange={(e) => setNumberDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveNumber(slot);
                            if (e.key === "Escape") setEditingNumber(null);
                          }}
                          placeholder="(11) 99999-9999"
                          className="h-6 text-xs px-1.5"
                        />
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleSaveNumber(slot)}>
                          <Check className="w-3 h-3 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingNumber(null)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <span className={cn("text-sm font-medium text-foreground whitespace-nowrap", inactive && "line-through")}>
                        {value ? formatPhone(value) : "—"}
                      </span>
                    )}
                  </div>

                  {/* Actions + WhatsApp agrupados */}
                  <div className="flex items-center shrink-0 ml-1 -space-x-0.5">
                    {wa && <WhatsAppDot className="w-3.5 h-3.5 text-green-600 mr-0.5" />}
                    {!isEditingThis && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => startEditNumber(slot)}
                        title="Editar número"
                        aria-label="Editar número"
                        disabled={busy === slot}
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={() => handleToggleInactive(slot)}
                      title={inactive ? "Reativar número" : "Inativar número"}
                      aria-label={inactive ? "Reativar número" : "Inativar número"}
                      disabled={busy === slot}
                    >
                      {inactive ? (
                        <RotateCcw className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Ban className="w-3 h-3 text-destructive/70" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Linha em edição para slot vazio (add) */}
            {nextEmpty && editingNumber === nextEmpty && !values[nextEmpty] && (
              <div className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-dashed border-border bg-muted/20">
                <Flame className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                <div className="w-44 shrink-0">
                  <div className="flex items-center gap-0.5">
                    <Input
                      autoFocus
                      value={numberDraft}
                      onChange={(e) => setNumberDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveNumber(nextEmpty);
                        if (e.key === "Escape") setEditingNumber(null);
                      }}
                      placeholder="(11) 99999-9999"
                      className="h-6 text-xs px-1.5"
                    />
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => handleSaveNumber(nextEmpty)}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditingNumber(null)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">Novo telefone</span>
              </div>
            )}

            {nextEmpty && editingNumber !== nextEmpty && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground w-full justify-start"
                onClick={handleAddNew}
              >
                <Plus className="w-3 h-3" />
                Adicionar telefone
              </Button>
            )}

            {visibleSlots.length === 0 && !editingNumber && (
              <p className="text-xs text-muted-foreground italic px-1.5">Nenhum telefone cadastrado</p>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
};

export default PhoneList;
