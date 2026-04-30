import { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useHasRivoAgreement } from "@/hooks/useHasRivoAgreement";
import { applyAutoProfileFromDisposition } from "@/services/debtorProfileAutoService";

interface DispositionType {
  id: string;
  key: string;
  label: string;
  color: string;
  sort_order: number;
}

interface DispositionSelectorProps {
  conversationId: string;
  tenantId: string;
  clientCpf?: string | null;
  /** Optimistic notify parent when local assignments change (add/remove). */
  onAssignmentsChanged?: (
    conversationId: string,
    assignedDispositionTypeIds: string[]
  ) => void;
}

const CPC_CPE_KEYS = ["cpc", "cpe"];
const EM_DIA_KEYS = ["em_dia", "wa_em_dia"];
const EM_DIA_BLOCKED_TITLE =
  "Cliente possui acordo no Rivo — esta tabulação é apenas para clientes em dia com pagamentos originais";

const DispositionSelector = ({ conversationId, tenantId, clientCpf, onAssignmentsChanged }: DispositionSelectorProps) => {
  const { data: hasAgreement = false } = useHasRivoAgreement(clientCpf, tenantId);
  const { profile } = useAuth();
  const [dispositions, setDispositions] = useState<DispositionType[]>([]);
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const loadDispositions = useCallback(async () => {
    const { data } = await supabase
      .from("call_disposition_types")
      .select("id, key, label, color, sort_order")
      .eq("tenant_id", tenantId)
      .eq("channel", "whatsapp")
      .eq("active", true)
      .order("sort_order");
    setDispositions((data as DispositionType[]) || []);
  }, [tenantId]);

  const loadAssignments = useCallback(async () => {
    const { data } = await supabase
      .from("conversation_disposition_assignments" as any)
      .select("disposition_type_id")
      .eq("conversation_id", conversationId);
    const idArr = (data || []).map((d: any) => d.disposition_type_id as string);
    const ids = new Set(idArr);
    setAssignedIds(ids);
    onAssignmentsChanged?.(conversationId, idArr);
  }, [conversationId, onAssignmentsChanged]);

  useEffect(() => {
    if (!tenantId) return;
    loadDispositions();
  }, [tenantId, loadDispositions]);

  useEffect(() => {
    if (!conversationId) return;
    loadAssignments();
  }, [conversationId, loadAssignments]);

  const isCpcCpe = (d: DispositionType) => CPC_CPE_KEYS.includes(d.key);

  const handleToggle = async (disposition: DispositionType) => {
    if (EM_DIA_KEYS.includes(disposition.key) && hasAgreement && !assignedIds.has(disposition.id)) {
      toast.error(EM_DIA_BLOCKED_TITLE);
      return;
    }
    setLoading(true);
    try {
      const isAssigned = assignedIds.has(disposition.id);

      if (isAssigned) {
        // Remove
        await supabase
          .from("conversation_disposition_assignments" as any)
          .delete()
          .eq("conversation_id", conversationId)
          .eq("disposition_type_id", disposition.id);
      } else {
        // If selecting CPC or CPE, remove the other one first
        if (isCpcCpe(disposition)) {
          const otherKey = disposition.key === "cpc" ? "cpe" : "cpc";
          const other = dispositions.find((d) => d.key === otherKey);
          if (other && assignedIds.has(other.id)) {
            await supabase
              .from("conversation_disposition_assignments" as any)
              .delete()
              .eq("conversation_id", conversationId)
              .eq("disposition_type_id", other.id);
          }
        }

        // Insert
        await supabase
          .from("conversation_disposition_assignments" as any)
          .insert({
            conversation_id: conversationId,
            disposition_type_id: disposition.id,
            assigned_by: profile?.user_id || profile?.id,
          } as any);
      }

      // Auto-fill debtor profile (only if currently NULL) when assigning a disposition.
      if (!isAssigned && clientCpf && tenantId) {
        void applyAutoProfileFromDisposition({
          tenantId,
          cpf: clientCpf,
          dispositionKey: disposition.key,
          channel: "whatsapp",
        });
      }

      await loadAssignments();
    } catch (err: any) {
      if (!err?.message?.includes("duplicate")) {
        toast.error("Erro ao atualizar tabulação");
      }
    } finally {
      setLoading(false);
    }
  };

  const cpcCpeDispositions = dispositions.filter(isCpcCpe);
  const otherDispositions = dispositions.filter((d) => !isCpcCpe(d));

  if (dispositions.length === 0) return null;

  return (
    <Card className="mb-3">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-xs flex items-center gap-1">
          <ClipboardCheck className="w-3 h-3" />
          Tabulações
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
        {/* CPC / CPE section */}
        {cpcCpeDispositions.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground mb-1">
              Identificação do Contato
            </div>
            <div className="flex gap-1 flex-wrap">
              {cpcCpeDispositions.map((d) => {
                const active = assignedIds.has(d.id);
                return (
                  <button
                    key={d.id}
                    disabled={loading}
                    onClick={() => handleToggle(d)}
                    className="transition-all"
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="text-[10px] cursor-pointer hover:opacity-80 transition-all"
                      style={
                        active
                          ? { backgroundColor: d.color, color: "#fff", borderColor: d.color }
                          : { borderColor: d.color, color: d.color }
                      }
                    >
                      {d.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Other dispositions */}
        {otherDispositions.length > 0 && (
          <div>
            <div className="text-[10px] font-medium text-muted-foreground mb-1">
              Status
            </div>
            <div className="flex gap-1 flex-wrap">
              {otherDispositions.map((d) => {
                const active = assignedIds.has(d.id);
                const blocked = EM_DIA_KEYS.includes(d.key) && hasAgreement && !active;
                return (
                  <button
                    key={d.id}
                    disabled={loading || blocked}
                    onClick={() => handleToggle(d)}
                    title={blocked ? EM_DIA_BLOCKED_TITLE : undefined}
                    className={`transition-all ${blocked ? "cursor-not-allowed" : ""}`}
                  >
                    <Badge
                      variant={active ? "default" : "outline"}
                      className={`text-[10px] hover:opacity-80 transition-all ${blocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                      style={
                        active
                          ? { backgroundColor: d.color, color: "#fff", borderColor: d.color }
                          : { borderColor: d.color, color: d.color }
                      }
                    >
                      {d.label}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DispositionSelector;
