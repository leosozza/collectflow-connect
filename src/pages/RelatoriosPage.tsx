import { useState } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useTenant } from "@/hooks/useTenant";
import { ReportHub, ReportKey } from "@/components/relatorios/ReportHub";
import { PrestacaoContasView } from "@/components/relatorios/views/PrestacaoContasView";
import { CarteiraAnaliseView } from "@/components/relatorios/views/CarteiraAnaliseView";
import { NegociacoesDesempenhoView } from "@/components/relatorios/views/NegociacoesDesempenhoView";
import { AcionamentosCanaisView } from "@/components/relatorios/views/AcionamentosCanaisView";
import { Skeleton } from "@/components/ui/skeleton";

const HubSkeleton = () => (
  <div className="space-y-6">
    <div>
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-96 mt-2" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
    </div>
  </div>
);

const RelatoriosPage = () => {
  useScrollRestore();
  const { tenant } = useTenant();
  const [active, setActive] = useState<ReportKey | null>(null);

  const back = () => setActive(null);

  if (!tenant) return <HubSkeleton />;

  if (active === "prestacao") return <PrestacaoContasView onBack={back} />;
  if (active === "carteira") return <CarteiraAnaliseView onBack={back} />;
  if (active === "negociacoes") return <NegociacoesDesempenhoView onBack={back} />;
  if (active === "canais") return <AcionamentosCanaisView onBack={back} />;

  return <ReportHub onOpen={setActive} />;
};

export default RelatoriosPage;
