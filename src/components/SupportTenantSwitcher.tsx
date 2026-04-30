import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImpersonatedTenant } from "@/hooks/useImpersonatedTenant";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Headphones, Check, X } from "lucide-react";
import { logAction } from "@/services/auditService";

/**
 * Switcher do modo suporte do Super Admin.
 * Lista tenants (RLS já libera leitura para super admin).
 * Ao selecionar, grava em sessionStorage e dispara auditoria.
 */
export const SupportTenantSwitcher = () => {
  const { isSuperAdmin } = useTenant();
  const { tenantId, tenantName, setTenant, clear } = useImpersonatedTenant();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: tenants = [] } = useQuery({
    queryKey: ["support-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("id,name,slug")
        .order("name");
      if (error) throw error;
      return data as { id: string; name: string; slug: string }[];
    },
    enabled: isSuperAdmin,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return tenants;
    const q = search.toLowerCase();
    return tenants.filter(
      (t) => t.name?.toLowerCase().includes(q) || t.slug?.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  if (!isSuperAdmin) return null;

  const handleSelect = (t: { id: string; name: string }) => {
    setTenant(t.id, t.name);
    setOpen(false);
    logAction({
      action: "support_mode_enter",
      entity_type: "tenant",
      entity_id: t.id,
      details: {
        target_tenant_id: t.id,
        tenant_name: t.name,
        mode: "support_admin_global",
      },
    });
  };

  const handleClear = () => {
    if (tenantId) {
      logAction({
        action: "support_mode_exit",
        entity_type: "tenant",
        entity_id: tenantId,
        details: {
          target_tenant_id: tenantId,
          tenant_name: tenantName,
          mode: "support_admin_global",
        },
      });
    }
    clear();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={tenantId ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          <Headphones className="w-4 h-4" />
          {tenantId ? `Suporte: ${tenantName || "tenant"}` : "Modo suporte"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <div className="space-y-2">
          <Input
            placeholder="Buscar tenant…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
          {tenantId && (
            <button
              onClick={handleClear}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted"
            >
              <span className="flex items-center gap-2 text-destructive">
                <X className="w-3.5 h-3.5" /> Sair do modo suporte
              </span>
            </button>
          )}
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted"
              >
                <span className="truncate">{t.name}</span>
                {tenantId === t.id && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Nenhum tenant encontrado.
              </p>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
