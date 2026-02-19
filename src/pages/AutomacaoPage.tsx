import { useState, useEffect, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import {
  fetchCollectionRules,
  createCollectionRule,
  updateCollectionRule,
  deleteCollectionRule,
  CollectionRule,
} from "@/services/automacaoService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import RulesList from "@/components/automacao/RulesList";
import RuleForm from "@/components/automacao/RuleForm";
import MessageHistory from "@/components/automacao/MessageHistory";
import { Link } from "react-router-dom";
import DispositionAutomationsTab from "@/components/automacao/DispositionAutomationsTab";
import WorkflowListTab from "@/components/automacao/workflow/WorkflowListTab";
import GatilhosTab from "@/components/automacao/GatilhosTab";

const AutomacaoPage = () => {
  const { tenant, isTenantAdmin } = useTenant();
  const { toast } = useToast();
  const [rules, setRules] = useState<CollectionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<CollectionRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadRules = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const data = await fetchCollectionRules(tenant.id);
      setRules(data);
    } catch (err: any) {
      toast({ title: "Erro ao carregar regras", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [tenant, toast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  if (!isTenantAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  const handleSave = async (data: { name: string; channel: string; days_offset: number; message_template: string }) => {
    if (!tenant) return;
    setSaving(true);
    try {
      if (editingRule) {
        await updateCollectionRule(editingRule.id, data as any);
        toast({ title: "Regra atualizada!" });
      } else {
        await createCollectionRule({ ...data, tenant_id: tenant.id, is_active: true } as any);
        toast({ title: "Regra criada!" });
      }
      setShowForm(false);
      setEditingRule(null);
      await loadRules();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (rule: CollectionRule) => {
    try {
      await updateCollectionRule(rule.id, { is_active: !rule.is_active });
      await loadRules();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const handleDelete = async (rule: CollectionRule) => {
    if (!confirm(`Excluir regra "${rule.name}"?`)) return;
    try {
      await deleteCollectionRule(rule.id);
      toast({ title: "Regra excluída!" });
      await loadRules();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Automação de Cobrança</h1>
        <p className="text-muted-foreground">Configure regras automáticas de notificação e acompanhe envios</p>
      </div>

      <Tabs defaultValue="fluxos">
        <TabsList>
          <TabsTrigger value="fluxos">Fluxos</TabsTrigger>
          <TabsTrigger value="gatilhos">Gatilhos</TabsTrigger>
          <TabsTrigger value="regras">Regras</TabsTrigger>
          <TabsTrigger value="pos-tabulacao">Pós-Tabulação</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="config">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxos">
          <WorkflowListTab />
        </TabsContent>

        <TabsContent value="gatilhos">
          <GatilhosTab />
        </TabsContent>

        <TabsContent value="regras" className="space-y-4">
          {showForm || editingRule ? (
            <RuleForm
              rule={editingRule}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingRule(null); }}
              saving={saving}
            />
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Nova Regra
                </Button>
              </div>
              {loading ? (
                <div className="text-center py-12 text-muted-foreground">Carregando...</div>
              ) : (
                <RulesList
                  rules={rules}
                  onEdit={(r) => setEditingRule(r)}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="pos-tabulacao">
          <DispositionAutomationsTab />
        </TabsContent>

        <TabsContent value="historico">
          <MessageHistory />
        </TabsContent>

        <TabsContent value="config">
          <div className="rounded-lg border bg-card p-6 text-center space-y-3">
            <p className="text-muted-foreground">As configurações de WhatsApp foram movidas para a página de Integrações.</p>
            <Link to="/integracao" className="text-primary hover:underline font-medium">
              Ir para Integrações →
            </Link>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AutomacaoPage;
