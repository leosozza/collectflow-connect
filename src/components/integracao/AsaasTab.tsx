import IntegrationDetailLayout from "./IntegrationDetailLayout";
import { INTEGRATIONS } from "./integrationsCatalog";

const AsaasTab = () => {
  const meta = INTEGRATIONS.asaas;
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

export default AsaasTab;
