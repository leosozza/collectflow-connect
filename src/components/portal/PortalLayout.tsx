import { ReactNode } from "react";
import { Shield, Lock } from "lucide-react";

interface PortalLayoutProps {
  children: ReactNode;
  tenantName?: string;
  tenantLogo?: string | null;
  primaryColor?: string;
}

const PortalLayout = ({ children, tenantName, tenantLogo, primaryColor }: PortalLayoutProps) => {
  const color = primaryColor || "#F97316";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card sticky top-0 z-50 border-b border-border/50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-8 w-auto" />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: color }}
            >
              {tenantName?.[0]?.toUpperCase() || "C"}
            </div>
          )}
          <span className="font-semibold text-foreground">{tenantName || "Portal"}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-5 mt-12">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Ambiente seguro e criptografado</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/30">•</span>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>Seus dados estão protegidos</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;
