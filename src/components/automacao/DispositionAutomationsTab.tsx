import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  fetchAutomations,
  createAutomation,
  updateAutomation,
  deleteAutomation,
  DispositionAutomation,
  AUTOMATION_ACTION_TYPES,
} from "@/services/dispositionAutomationService";
import { DISPOSITION_TYPES } from "@/services/dispositionService";
import DispositionAutomationForm from "./DispositionAutomationForm";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Pencil, Trash2 } from "lucide-react";

const DispositionAutomationsTab = () => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [automations, setAutomations] = useState<DispositionAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DispositionAutomation | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await fetchAutomations(tenant.id);
      setAutomations(data);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenant, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (data: {
    disposition_type: string;
    action_type: string;
    action_config: Record<string, any>;
  }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      if (editing) {
        await updateAutomation(editing.id, data);
        toast({ title: "Automação atualizada!" });
      } else {
        await createAutomation({ ...data, tenant_id: tenant.id, is_active: true });
        toast({ title: "Automação criada!" });
      }
      setShowForm(false);
      setEditing(null);
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (auto: DispositionAutomation) => {
    try {
      await updateAutomation(auto.id, { is_active: !auto.is_active });
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (auto: DispositionAutomation) => {
    if (!confirm("Excluir esta automação?")) return;
    try {
      await deleteAutomation(auto.id);
      toast({ title: "Automação excluída!" });
      await load();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (showForm || editing) {
    return (
      <DispositionAutomationForm
        automation={editing}
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false);
          setEditing(null);
        }}
        saving={saving}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Automação
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : automations.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          Nenhuma automação configurada. Crie a primeira para disparar ações automáticas após tabulações.
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((auto) => (
            <Card key={auto.id}>
              <CardContent className="flex items-center justify-between py-4">
                <div className="flex items-center gap-4">
                  <Switch
                    checked={auto.is_active}
                    onCheckedChange={() => handleToggle(auto)}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {DISPOSITION_TYPES[auto.disposition_type as keyof typeof DISPOSITION_TYPES] || auto.disposition_type}
                      </Badge>
                      <span className="text-muted-foreground">→</span>
                      <Badge variant="secondary">
                        {AUTOMATION_ACTION_TYPES[auto.action_type as keyof typeof AUTOMATION_ACTION_TYPES] || auto.action_type}
                      </Badge>
                    </div>
                    {auto.action_config?.template && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                        {auto.action_config.template}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(auto)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(auto)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DispositionAutomationsTab;
