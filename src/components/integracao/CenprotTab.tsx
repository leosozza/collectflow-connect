import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const CenprotTab = () => {
  const meta = INTEGRATIONS.cenprot;
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

export default CenprotTab;
