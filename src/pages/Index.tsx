import { useAuth } from "@/hooks/useAuth";
import DashboardPage from "@/pages/DashboardPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";

const Index = () => {
  const { profile } = useAuth();

  if (profile?.role === "admin") {
    return <AdminDashboardPage />;
  }

  return <DashboardPage />;
};

export default Index;
