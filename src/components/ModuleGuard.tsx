import { useModules } from "@/hooks/useModules";
import { useTenant } from "@/hooks/useTenant";
import { Lock } from "lucide-react";

interface ModuleGuardProps {
  module: string;
  children: React.ReactNode;
}

const ModuleGuard = ({ module, children }: ModuleGuardProps) => {
  const { isSuperAdmin } = useTenant();
  const { isModuleEnabled, isLoading } = useModules();

  if (isSuperAdmin || isLoading) return <>{children}</>;

  if (!isModuleEnabled(module)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Módulo não disponível</h2>
          <p className="text-muted-foreground">
            Este módulo não está habilitado para sua empresa. Entre em contato com o administrador da plataforma para solicitar a ativação.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ModuleGuard;
