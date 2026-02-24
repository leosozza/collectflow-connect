import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { MultiSelect } from "@/components/ui/multi-select";
import { Campaign, METRIC_OPTIONS, PERIOD_OPTIONS } from "@/services/campaignService";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { Users, Building2 } from "lucide-react";

interface CampaignFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: any, credorIds: string[], participants: { operator_id: string; source_type: string; source_id: string | null }[]) => void;
  campaign?: Campaign | null;
  loading?: boolean;
}

const CampaignForm = ({ open, onClose, onSave, campaign, loading }: CampaignFormProps) => {
  const { tenant } = useTenant();
  const [title, setTitle] = useState(campaign?.title || "");
  const [description, setDescription] = useState(campaign?.description || "");
  const [metric, setMetric] = useState(campaign?.metric || "");
  const [period, setPeriod] = useState(campaign?.period || "");
  const [startDate, setStartDate] = useState(campaign?.start_date || "");
  const [endDate, setEndDate] = useState(campaign?.end_date || "");
  const [prize, setPrize] = useState(campaign?.prize_description || "");
  const [status, setStatus] = useState(campaign?.status || "ativa");

  const [selectedCredores, setSelectedCredores] = useState<string[]>([]);
  const [participantMode, setParticipantMode] = useState<"equipe" | "individual">("individual");
  const [selectedEquipes, setSelectedEquipes] = useState<string[]>([]);
  const [selectedOperators, setSelectedOperators] = useState<string[]>([]);

  // Fetch credores
  const { data: credores = [] } = useQuery({
    queryKey: ["credores-active", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("id, razao_social")
        .eq("tenant_id", tenant!.id)
        .eq("status", "ativo")
        .order("razao_social");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch equipes
  const { data: equipes = [] } = useQuery({
    queryKey: ["equipes-active", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("equipes")
        .select("id, nome")
        .eq("tenant_id", tenant!.id)
        .eq("status", "ativa")
        .order("nome");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Fetch operators
  const { data: operators = [] } = useQuery({
    queryKey: ["tenant-operators", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("tenant_id", tenant!.id)
        .order("full_name");
      return data || [];
    },
    enabled: !!tenant?.id,
  });

  // Load existing campaign credores and participants when editing
  useEffect(() => {
    if (campaign?.credores) {
      setSelectedCredores(campaign.credores.map((c) => c.credor_id));
    }
  }, [campaign]);

  useEffect(() => {
    if (campaign?.id && tenant?.id) {
      supabase
        .from("campaign_participants")
        .select("operator_id, source_type, source_id")
        .eq("campaign_id", campaign.id)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const first = data[0] as any;
            if (first.source_type === "equipe") {
              setParticipantMode("equipe");
              const equipeIds = [...new Set(data.map((d: any) => d.source_id).filter(Boolean))] as string[];
              setSelectedEquipes(equipeIds);
            } else {
              setParticipantMode("individual");
              setSelectedOperators(data.map((d: any) => d.operator_id));
            }
          }
        });
    }
  }, [campaign?.id, tenant?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    let participants: { operator_id: string; source_type: string; source_id: string | null }[] = [];

    if (participantMode === "equipe" && selectedEquipes.length > 0) {
      // Expand equipe members
      const { data: members } = await supabase
        .from("equipe_membros")
        .select("profile_id, equipe_id")
        .in("equipe_id", selectedEquipes);

      const seen = new Set<string>();
      for (const m of (members || []) as any[]) {
        if (!seen.has(m.profile_id)) {
          seen.add(m.profile_id);
          participants.push({
            operator_id: m.profile_id,
            source_type: "equipe",
            source_id: m.equipe_id,
          });
        }
      }
    } else {
      participants = selectedOperators.map((opId) => ({
        operator_id: opId,
        source_type: "individual",
        source_id: null,
      }));
    }

    onSave(
      {
        title,
        description: description || null,
        metric,
        period,
        start_date: startDate,
        end_date: endDate,
        prize_description: prize || null,
        status,
      },
      selectedCredores,
      participants
    );
  };

  const credorOptions = credores.map((c: any) => ({ value: c.id, label: c.razao_social }));
  const equipeOptions = equipes.map((e: any) => ({ value: e.id, label: e.nome }));
  const operatorOptions = operators.map((o: any) => ({ value: o.id, label: o.full_name || "Sem nome" }));

  const isValid = title && metric && period && startDate && endDate && selectedCredores.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Métrica *</Label>
              <Select value={metric} onValueChange={setMetric} required>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {METRIC_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Período *</Label>
              <Select value={period} onValueChange={setPeriod} required>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Início *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <Label>Data Fim *</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>

          {/* Credores */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> Credores *
            </Label>
            <MultiSelect
              options={credorOptions}
              selected={selectedCredores}
              onChange={setSelectedCredores}
              placeholder="Selecionar credores"
              allLabel="Todos os credores"
              className="w-full"
            />
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> Participantes
            </Label>
            <RadioGroup
              value={participantMode}
              onValueChange={(v) => setParticipantMode(v as "equipe" | "individual")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="equipe" id="mode-equipe" />
                <Label htmlFor="mode-equipe" className="font-normal cursor-pointer">Por Equipe</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="individual" id="mode-individual" />
                <Label htmlFor="mode-individual" className="font-normal cursor-pointer">Individual</Label>
              </div>
            </RadioGroup>

            {participantMode === "equipe" ? (
              <MultiSelect
                options={equipeOptions}
                selected={selectedEquipes}
                onChange={setSelectedEquipes}
                placeholder="Selecionar equipes"
                allLabel="Todas as equipes"
                className="w-full"
              />
            ) : (
              <MultiSelect
                options={operatorOptions}
                selected={selectedOperators}
                onChange={setSelectedOperators}
                placeholder="Selecionar operadores"
                allLabel="Todos os operadores"
                className="w-full"
                searchable
                searchPlaceholder="Buscar operador..."
              />
            )}
          </div>

          <div>
            <Label>Prêmio</Label>
            <Textarea value={prize} onChange={(e) => setPrize(e.target.value)} rows={2} placeholder="Descreva o prêmio..." />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ativa">Ativa</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="encerrada">Encerrada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={loading || !isValid}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignForm;
