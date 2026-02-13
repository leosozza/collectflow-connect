import { ReactNode } from "react";
import { Shield, Lock } from "lucide-react";

interface PortalLayoutProps {
  children: ReactNode;
  tenantName?: string;
  tenantLogo?: string | null;
  primaryColor?: string;
}

const PortalLayout = ({ children, tenantName, tenantLogo, primaryColor }: PortalLayoutProps) => {
  const color = primaryColor || "#2563eb";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
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
          <span className="font-semibold text-slate-900 text-lg">{tenantName || "Portal"}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span>Ambiente seguro e criptografado</span>
          </div>
          <span className="hidden sm:inline text-slate-300">•</span>
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
