import { useTenant } from "@/hooks/useTenant";
import RankingTab from "./RankingTab";
import CampaignsTab from "./CampaignsTab";
import AchievementsTab from "./AchievementsTab";

/**
 * Wrappers usados pelas rotas de gamificação para derivar automaticamente
 * `isAdmin` / `highlightCurrentUser` a partir do contexto de tenant.
 */
export const RankingRoute = () => {
  const { isTenantAdmin } = useTenant();
  return <RankingTab highlightCurrentUser={!isTenantAdmin} />;
};

export const CampaignsRoute = () => {
  const { isTenantAdmin } = useTenant();
  return <CampaignsTab highlightCurrentUser={!isTenantAdmin} />;
};

export const AchievementsRoute = () => {
  const { isTenantAdmin } = useTenant();
  return <AchievementsTab isAdmin={isTenantAdmin} />;
};
