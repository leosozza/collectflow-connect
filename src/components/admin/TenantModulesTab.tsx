import { useState, useEffect } from "react";
import {
  getSystemModules,
  getTenantModules,
  toggleModule,
  bulkToggleModules,
  getAutoEnableModules,
  getAutoDisableModules,
  SystemModule,
} from "@/services/moduleService";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, Building2, ChevronRight } from "lucide-react";

interface TenantModulesTabProps {
  tenantId: string;
  tenantName: string;
}

const PRESETS = [
  {
    label: "Assessoria de Cobrança",
    icon: Zap,
    description: "CRM + Contact Center + WhatsApp + Telefonia + Gamificação + IA",
    slugs: ["contact_center", "whatsapp", "telefonia", "gamificacao", "ia_negociacao_whatsapp", "ia_negociacao_telefonia"],
  },
  {
    label: "Empresa Final",
    icon: Building2,
    description: "CRM + Contact Center + WhatsApp + Telefonia + IA",
    slugs: ["contact_center", "whatsapp", "telefonia", "ia_negociacao_whatsapp", "ia_negociacao_telefonia"],
  },
];

const categoryLabels: Record<string, string> = {
  core: "Core",
  comunicacao: "Comunicação",
  produtividade: "Produtividade",
  negociacao: "Negociação",
  analytics: "Analytics",
  engajamento: "Engajamento",
  financeiro: "Financeiro",
  tecnico: "Técnico",
  ia: "Inteligência Artificial",
};

const TenantModulesTab = ({ tenantId, tenantName }: TenantModulesTabProps) => {
  const { toast } = useToast();
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [applyingPreset, setApplyingPreset] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const [allModules, tenantMods] = await Promise.all([
        getSystemModules(),
        getTenantModules(tenantId),
      ]);
      setModules(allModules);
      const map: Record<string, boolean> = {};
      allModules.forEach((m) => {
        if (m.is_core) map[m.id] = true;
      });
      tenantMods.forEach((tm) => {
        map[tm.module_id] = tm.enabled;
      });
      setEnabledMap(map);
    } catch {
      toast({ title: "Erro ao carregar módulos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tenantId) load();
  }, [tenantId]);

  // Only manageable (non-core) modules
  const manageableModules = modules.filter((m) => !m.is_core);

  // Separate into root modules and sub-modules
  const rootModules = manageableModules.filter((m) => !m.parent_slug);
  const getChildren = (parentSlug: string) =>
    manageableModules.filter((m) => m.parent_slug === parentSlug);

  const handleToggle = async (mod: SystemModule, enabled: boolean) => {
    setToggling(mod.id);
    try {
      if (enabled) {
        // Auto-enable dependencies
        const autoEnable = getAutoEnableModules(mod.slug, enabledMap, modules);
        for (const dep of autoEnable) {
          await toggleModule(tenantId, dep.id, true);
          setEnabledMap((prev) => ({ ...prev, [dep.id]: true }));
        }
        if (autoEnable.length > 0) {
          toast({
            title: "Dependências ativadas automaticamente",
            description: autoEnable.map((d) => d.name).join(", "),
          });
        }
        await toggleModule(tenantId, mod.id, true);
        setEnabledMap((prev) => ({ ...prev, [mod.id]: true }));
        toast({ title: `${mod.name} ativado` });
      } else {
        // Cascade disable dependents
        const autoDisable = getAutoDisableModules(mod.slug, enabledMap, modules);
        for (const dep of autoDisable) {
          await toggleModule(tenantId, dep.id, false);
          setEnabledMap((prev) => ({ ...prev, [dep.id]: false }));
        }
        if (autoDisable.length > 0) {
          toast({
            title: "Módulos dependentes desativados",
            description: autoDisable.map((d) => d.name).join(", "),
          });
        }
        await toggleModule(tenantId, mod.id, false);
        setEnabledMap((prev) => ({ ...prev, [mod.id]: false }));
        toast({ title: `${mod.name} desativado` });
      }
    } catch {
      toast({ title: "Erro ao alterar módulo", variant: "destructive" });
    } finally {
      setToggling(null);
    }
  };

  const applyPreset = async (preset: typeof PRESETS[number]) => {
    setApplyingPreset(true);
    try {
      // Disable all manageable modules first
      const disableIds = manageableModules
        .filter((m) => enabledMap[m.id])
        .map((m) => m.id);
      if (disableIds.length > 0) {
        await bulkToggleModules([tenantId], disableIds, false);
      }

      // Enable preset modules
      const enableIds = manageableModules
        .filter((m) => preset.slugs.includes(m.slug))
        .map((m) => m.id);
      if (enableIds.length > 0) {
        await bulkToggleModules([tenantId], enableIds, true);
      }

      toast({ title: `Preset "${preset.label}" aplicado com sucesso` });
      await load();
    } catch {
      toast({ title: "Erro ao aplicar preset", variant: "destructive" });
    } finally {
      setApplyingPreset(false);
    }
  };

  const renderModuleRow = (mod: SystemModule, indent = false) => {
    const enabled = enabledMap[mod.id] ?? false;
    return (
      <div
        key={mod.id}
        className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
          indent ? "ml-6 border-dashed" : ""
        } ${enabled ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}
      >
        <div className="flex items-center gap-3">
          {indent && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{mod.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {categoryLabels[mod.category] || mod.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{mod.description || "-"}</p>
            {mod.depends_on?.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                Depende de: {mod.depends_on.join(", ")}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={enabled ? "default" : "secondary"} className="text-[10px]">
            {enabled ? "Ativo" : "Inativo"}
          </Badge>
          <Switch
            checked={enabled}
            disabled={toggling === mod.id || applyingPreset}
            onCheckedChange={(v) => handleToggle(mod, v)}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Presets */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Presets de Ativação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <Button
                key={preset.label}
                variant="outline"
                className="h-auto py-3 px-4 flex flex-col items-start gap-1"
                disabled={applyingPreset}
                onClick={() => applyPreset(preset)}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{preset.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-normal">
                  {preset.description}
                </span>
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {/* Module hierarchy */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Módulos — {tenantName}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            CRM e funcionalidades core estão sempre ativas. Gerencie apenas os módulos adicionais abaixo.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {rootModules.map((mod) => {
            const children = getChildren(mod.slug);
            return (
              <div key={mod.id} className="space-y-2">
                {renderModuleRow(mod)}
                {children.map((child) => renderModuleRow(child, true))}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

export default TenantModulesTab;
