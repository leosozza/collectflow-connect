import { useState } from "react";
import { Building2, Users, UserCheck, FileText, Database, UserCog, Cloud, Tags } from "lucide-react";
import CredorList from "@/components/cadastros/CredorList";
import EquipeList from "@/components/cadastros/EquipeList";
import TipoDevedorList from "@/components/cadastros/TipoDevedorList";
import TipoDividaList from "@/components/cadastros/TipoDividaList";
import TipoStatusList from "@/components/cadastros/TipoStatusList";
import UsersPage from "@/pages/UsersPage";
import IntegracaoPage from "@/pages/IntegracaoPage";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const sections = [
  { key: "credores", label: "Credores", icon: Building2 },
  { key: "usuarios", label: "Usuários", icon: UserCog },
  { key: "equipes", label: "Equipes", icon: Users },
  { key: "tipo_devedor", label: "Perfil do Devedor", icon: UserCheck },
  { key: "tipo_divida", label: "Tipo de Dívida", icon: FileText },
  { key: "tipo_status", label: "Tipo de Status", icon: Tags },
  { key: "integracao", label: "Integração", icon: Cloud },
];

const CadastrosPage = () => {
  const [active, setActive] = useState("credores");
  const { profile } = useAuth();

  return (
    <div className="flex gap-6 animate-fade-in">
      {/* Sub-navegação lateral */}
      <div className="w-56 flex-shrink-0">
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-bold text-foreground">Cadastros</h1>
        </div>
        <nav className="space-y-1">
          {sections.map(s => (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={cn(
                "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active === s.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">
            {sections.find(s => s.key === active)?.label}
          </h2>
        </div>
        {active === "credores" && <CredorList />}
        {active === "usuarios" && <UsersPage />}
        {active === "equipes" && <EquipeList />}
        {active === "tipo_devedor" && <TipoDevedorList />}
        {active === "tipo_divida" && <TipoDividaList />}
        {active === "tipo_status" && <TipoStatusList />}
        {active === "integracao" && <IntegracaoPage />}
      </div>
    </div>
  );
};

export default CadastrosPage;
