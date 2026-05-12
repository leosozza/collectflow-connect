import { useState, useEffect } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import BaylersInstancesList from "./BaylersInstancesList";
import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const EvolutionTab = () => {
  const meta = INTEGRATIONS.evolution;
  const { tenant } = useTenant();
  const [hasInstance, setHasInstance] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("tenant_id", tenant.id)
      .eq("provider", "evolution")
      .limit(1)
      .then(({ data }) => setHasInstance(!!data && data.length > 0));
  }, [tenant?.id]);

  return (
    <IntegrationDetailLayout
      name={meta.name}
      category={meta.category}
      logoUrl={meta.logoUrl}
      fallbackIcon={meta.fallbackIcon}
      brandColor={meta.brandColor}
      description={meta.description}
      status={hasInstance ? "connected" : "not_configured"}
      requirements={meta.requirements}
      footer={
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setFormOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova instância
            </Button>
          </div>
          <BaylersInstancesList
            externalFormOpen={formOpen}
            onExternalFormClose={() => setFormOpen(false)}
          />
        </div>
      }
    />
  );
};

export default EvolutionTab;
