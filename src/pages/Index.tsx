import { useTenant } from "@/hooks/useTenant";
import DashboardPage from "@/pages/DashboardPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

const Index = () => {
  const { isTenantAdmin } = useTenant();

  if (isTenantAdmin) {
    return <AdminDashboardPage />;
  }

  return <DashboardPage />;
};

export default Index;
