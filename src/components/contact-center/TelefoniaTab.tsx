import { Phone } from "lucide-react";
import ThreeCPlusPanel from "@/components/contact-center/threecplus/ThreeCPlusPanel";
import { cn } from "@/lib/utils";

const TelefoniaTab = () => {
  return (
    <div className="mt-4 space-y-4">
      <nav className="flex flex-wrap items-center gap-1 border-b border-border pb-px w-full">
        <button
          className={cn(
            "flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-all relative rounded-t-lg",
            "bg-primary/10 text-primary border-b-[3px] border-primary"
          )}
        >
          <Phone className="w-4 h-4 shrink-0" />
          <span>3CPlus</span>
        </button>
      </nav>

      <ThreeCPlusPanel />
    </div>
  );
};

export default TelefoniaTab;
