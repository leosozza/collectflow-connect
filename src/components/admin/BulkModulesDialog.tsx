import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSystemModules, bulkToggleModules, SystemModule } from "@/services/moduleService";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface BulkModulesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

const BulkModulesDialog = ({ open, onOpenChange }: BulkModulesDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [modules, setModules] = useState<SystemModule[]>([]);
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [action, setAction] = useState<"enable" | "disable">("enable");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(1);
      setSelectedTenants([]);
      setSelectedModules([]);
      setAction("enable");
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [mods, { data: tenantData }] = await Promise.all([
        getSystemModules(),
        supabase.from("tenants").select("id, name, slug").neq("status", "deleted").order("name"),
      ]);
      setModules(mods.filter((m) => !m.is_core));
      setTenants((tenantData || []) as TenantOption[]);
    } catch {
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleTenant = (id: string) => {
    setSelectedTenants((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const selectAllTenants = () => {
    setSelectedTenants(
      selectedTenants.length === tenants.length ? [] : tenants.map((t) => t.id)
    );
  };

  const execute = async () => {
    setExecuting(true);
    try {
      const result = await bulkToggleModules(selectedTenants, selectedModules, action === "enable");
      toast({
        title: "Operação concluída",
        description: `${result.success} alterações realizadas${result.errors > 0 ? `, ${result.errors} erros` : ""}`,
      });
      onOpenChange(false);
    } catch {
      toast({ title: "Erro ao executar", variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Liberar módulos em massa</DialogTitle>
          <DialogDescription>
            {step === 1 && "Passo 1: Selecione os tenants"}
            {step === 2 && "Passo 2: Selecione os módulos"}
            {step === 3 && "Passo 3: Confirme a ação"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="space-y-3">
                <Button variant="outline" size="sm" onClick={selectAllTenants}>
                  {selectedTenants.length === tenants.length ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {tenants.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <Checkbox
                        checked={selectedTenants.includes(t.id)}
                        onCheckedChange={() => toggleTenant(t.id)}
                      />
                      <span className="text-sm">{t.name}</span>
                      <span className="text-xs text-muted-foreground">({t.slug})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedTenants.length} selecionado(s)</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <div className="max-h-60 overflow-y-auto space-y-2 border rounded-lg p-3">
                  {modules.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1.5 rounded">
                      <Checkbox
                        checked={selectedModules.includes(m.id)}
                        onCheckedChange={() => toggleModule(m.id)}
                      />
                      <span className="text-sm">{m.name}</span>
                      <Badge variant="outline" className="text-xs">{m.category}</Badge>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{selectedModules.length} módulo(s) selecionado(s)</p>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <Label>Ação</Label>
                  <Select value={action} onValueChange={(v) => setAction(v as "enable" | "disable")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enable">Ativar módulos</SelectItem>
                      <SelectItem value="disable">Desativar módulos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-sm space-y-1">
                  <p><strong>{selectedTenants.length}</strong> tenant(s)</p>
                  <p><strong>{selectedModules.length}</strong> módulo(s)</p>
                  <p>Ação: <Badge variant={action === "enable" ? "default" : "secondary"}>{action === "enable" ? "Ativar" : "Desativar"}</Badge></p>
                  <p className="text-muted-foreground text-xs mt-2">
                    Total de {selectedTenants.length * selectedModules.length} operações
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && selectedTenants.length === 0) ||
                (step === 2 && selectedModules.length === 0)
              }
            >
              Próximo
            </Button>
          ) : (
            <Button onClick={execute} disabled={executing}>
              {executing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Executar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkModulesDialog;
