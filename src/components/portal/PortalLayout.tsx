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
      <header className="border-b bg-card sticky top-0 z-50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-9 w-auto" />
          ) : (
            <div
              className="h-9 w-9 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
              style={{ backgroundColor: color }}
            >
              {tenantName?.[0]?.toUpperCase() || "C"}
            </div>
          )}
          <span className="font-semibold text-foreground text-lg">{tenantName || "Portal"}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t bg-card py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Ambiente seguro e criptografado</span>
          </div>
          <span className="hidden sm:inline text-muted-foreground/50">•</span>
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span>Seus dados estão protegidos</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;
