import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Pencil, Ban, RotateCcw, Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

export const PhoneList = ({ tenantId, cpf, credor, phone, phone2, phone3 }: PhoneListProps) => {
  const queryClient = useQueryClient();
  const values: Record<PhoneSlot, string | null> = { phone, phone2, phone3 };

  const { data: metadata } = useQuery({
    queryKey: ["phone_metadata", tenantId, cpf, credor],
    queryFn: () => fetchPhoneMetadata({ tenantId, cpf, credor }),
    enabled: !!tenantId && !!cpf && !!credor,
  });

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
    await Promise.all([
      queryClient.invalidateQueries(),
    ]);
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
        tenantId,
        cpf,
        credor,
        slot,
        isInactive: !current,
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
        tenantId,
        cpf,
        credor,
        slot,
        newValue: numberDraft.trim() || null,
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

  return (
    <div className="w-full">
      <p className="text-xs text-muted-foreground uppercase font-medium mb-2">Todos os Telefones</p>
      <div className="space-y-1.5">
        {visibleSlots.map((slot) => {
          const isHot = slot === "phone";
          const meta = metadata?.[slot];
          const inactive = meta?.is_inactive ?? false;
          const value = values[slot];
          const isEditingThis = editingNumber === slot;

          return (
            <div
              key={slot}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-md border border-border/50 bg-card hover:bg-muted/30 transition-colors",
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
                  "shrink-0 inline-flex items-center justify-center w-6 h-6 rounded transition-colors",
                  isHot ? "cursor-default" : "hover:bg-orange-500/10",
                  inactive && "cursor-not-allowed"
                )}
              >
                <Flame
                  className={cn(
                    "w-4 h-4",
                    isHot && !inactive
                      ? "text-orange-500 fill-orange-500/30"
                      : "text-muted-foreground/50"
                  )}
                />
              </button>

              {/* Number */}
              <div className="w-36 shrink-0">
                {isEditingThis ? (
                  <div className="flex items-center gap-1">
                    <Input
                      autoFocus
                      value={numberDraft}
                      onChange={(e) => setNumberDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveNumber(slot);
                        if (e.key === "Escape") setEditingNumber(null);
                      }}
                      placeholder="(11) 99999-9999"
                      className="h-7 text-xs"
                    />
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveNumber(slot)}>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingNumber(null)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "text-sm font-semibold text-foreground",
                      inactive && "line-through"
                    )}
                  >
                    {value ? formatPhone(value) : "—"}
                  </span>
                )}
              </div>

              {/* Observação */}
              <Input
                value={obsDrafts[slot]}
                onChange={(e) => setObsDrafts((d) => ({ ...d, [slot]: e.target.value }))}
                onBlur={() => handleSaveObs(slot)}
                placeholder="Observação (ex: Mãe, Pai, Trabalho)"
                className="h-7 text-xs flex-1 min-w-0"
                disabled={inactive}
              />

              {/* Actions */}
              <div className="flex items-center gap-0.5 shrink-0">
                {!isEditingThis && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => startEditNumber(slot)}
                    title="Editar número"
                    disabled={busy === slot}
                  >
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => handleToggleInactive(slot)}
                  title={inactive ? "Reativar número" : "Inativar número"}
                  disabled={busy === slot}
                >
                  {inactive ? (
                    <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                  ) : (
                    <Ban className="w-3.5 h-3.5 text-destructive/70" />
                  )}
                </Button>
              </div>
            </div>
          );
        })}

        {/* Linha em edição para slot vazio (add) */}
        {nextEmpty && editingNumber === nextEmpty && !values[nextEmpty] && (
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-md border border-dashed border-border bg-muted/20">
            <Flame className="w-4 h-4 text-muted-foreground/40 shrink-0" />
            <div className="w-36 shrink-0">
              <div className="flex items-center gap-1">
                <Input
                  autoFocus
                  value={numberDraft}
                  onChange={(e) => setNumberDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveNumber(nextEmpty);
                    if (e.key === "Escape") setEditingNumber(null);
                  }}
                  placeholder="(11) 99999-9999"
                  className="h-7 text-xs"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleSaveNumber(nextEmpty)}>
                  <Check className="w-3.5 h-3.5 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingNumber(null)}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <span className="text-xs text-muted-foreground flex-1">Novo telefone</span>
          </div>
        )}

        {/* Botão adicionar */}
        {nextEmpty && editingNumber !== nextEmpty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={handleAddNew}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar telefone
          </Button>
        )}

        {visibleSlots.length === 0 && !editingNumber && (
          <p className="text-sm text-muted-foreground italic">Nenhum telefone cadastrado</p>
        )}
      </div>
    </div>
  );
};

export default PhoneList;
