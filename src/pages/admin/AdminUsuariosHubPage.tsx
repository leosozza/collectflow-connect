import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Shield, UserPlus } from "lucide-react";
import AdminUsuariosPage from "./AdminUsuariosPage";
import AdminEquipesPage from "./AdminEquipesPage";
import AdminPermissoesPage from "./AdminPermissoesPage";

const AdminUsuariosHubPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get("tab") || "usuarios";

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="w-6 h-6 text-primary" />
          Usuários
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie usuários, equipes e permissões da plataforma
        </p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="usuarios" className="gap-2">
            <UserPlus className="w-4 h-4" />
            Gestão de Usuários
          </TabsTrigger>
          <TabsTrigger value="equipes" className="gap-2">
            <Users className="w-4 h-4" />
            Gestão de Equipes
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2">
            <Shield className="w-4 h-4" />
            Permissões e Módulos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios">
          <AdminUsuariosPage />
        </TabsContent>
        <TabsContent value="equipes">
          <AdminEquipesPage />
        </TabsContent>
        <TabsContent value="permissoes">
          <AdminPermissoesPage />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminUsuariosHubPage;
