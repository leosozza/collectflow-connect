import { ReactNode } from "react";
import { Shield } from "lucide-react";

interface PortalLayoutProps {
  children: ReactNode;
  tenantName?: string;
  tenantLogo?: string | null;
  primaryColor?: string;
}

const PortalLayout = ({ children, tenantName, tenantLogo, primaryColor }: PortalLayoutProps) => {
  return (
    <div className="min-h-screen bg-muted/30 flex flex-col">
      {/* Header */}
      <header className="border-b bg-card shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {tenantLogo ? (
            <img src={tenantLogo} alt={tenantName} className="h-8 w-auto" />
          ) : (
            <div
              className="h-8 w-8 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-sm"
              style={{ backgroundColor: primaryColor || "hsl(24, 95%, 53%)" }}
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
      <footer className="border-t bg-card py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Shield className="w-4 h-4" />
          <span>Ambiente seguro • Seus dados estão protegidos</span>
        </div>
      </footer>
    </div>
  );
};

export default PortalLayout;
