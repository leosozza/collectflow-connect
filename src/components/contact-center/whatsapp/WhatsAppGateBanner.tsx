import { AlertTriangle, Check, X, UserCircle, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WhatsAppGateBannerProps {
  hasProfile: boolean;
  hasDisposition: boolean;
  inboundCount: number;
  threshold: number;
  onOpenSidebar: () => void;
  sidebarOpen: boolean;
}

const WhatsAppGateBanner = ({
  hasProfile,
  hasDisposition,
  inboundCount,
  threshold,
  onOpenSidebar,
  sidebarOpen,
}: WhatsAppGateBannerProps) => {
  const ensureSidebar = () => {
    if (!sidebarOpen) onOpenSidebar();
  };

  const focusProfile = () => {
    ensureSidebar();
    setTimeout(() => {
      const el = document.querySelector('[data-gate-anchor="debtor-profile"]') as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-amber-500");
      setTimeout(() => el?.classList.remove("ring-2", "ring-amber-500"), 1800);
    }, 120);
  };

  const focusDisposition = () => {
    ensureSidebar();
    setTimeout(() => {
      const el = document.querySelector('[data-gate-anchor="disposition"]') as HTMLElement | null;
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.classList.add("ring-2", "ring-amber-500");
      setTimeout(() => el?.classList.remove("ring-2", "ring-amber-500"), 1800);
    }, 120);
  };

  const Item = ({
    ok,
    label,
    icon: Icon,
    onClick,
  }: {
    ok: boolean;
    label: string;
    icon: any;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-md border text-xs font-medium transition-all
        ${ok
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "border-amber-500/50 bg-amber-500/10 text-amber-800 dark:text-amber-300 hover:bg-amber-500/20"
        }`}
    >
      {ok ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <X className="w-3.5 h-3.5" />
      )}
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="border-t border-amber-500/30 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Envio bloqueado — preenchimento obrigatório
          </p>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
            O cliente já enviou {inboundCount} mensagens (limite: {threshold}). Defina o perfil
            e ao menos uma tabulação para liberar o envio.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <Item
              ok={hasProfile}
              label={hasProfile ? "Perfil definido" : "Definir Perfil"}
              icon={UserCircle}
              onClick={focusProfile}
            />
            <Item
              ok={hasDisposition}
              label={hasDisposition ? "Tabulação OK" : "Selecionar Tabulação"}
              icon={ClipboardCheck}
              onClick={focusDisposition}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppGateBanner;
