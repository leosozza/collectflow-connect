import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const TargetDataTenantTab = () => {
  const meta = INTEGRATIONS.targetdata;
  return (
    <IntegrationDetailLayout
      name={meta.name}
      category={meta.category}
      logoUrl={meta.logoUrl}
      fallbackIcon={meta.fallbackIcon}
      brandColor={meta.brandColor}
      description={meta.description}
      status="coming_soon"
      comingSoon={{ features: meta.comingSoonFeatures || [] }}
    />
  );
};

export default TargetDataTenantTab;
