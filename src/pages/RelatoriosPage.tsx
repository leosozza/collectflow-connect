import { useState } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { ReportHub, ReportKey } from "@/components/relatorios/ReportHub";
import { PrestacaoContasView } from "@/components/relatorios/views/PrestacaoContasView";
import { CarteiraAnaliseView } from "@/components/relatorios/views/CarteiraAnaliseView";
import { NegociacoesDesempenhoView } from "@/components/relatorios/views/NegociacoesDesempenhoView";
import { AcionamentosCanaisView } from "@/components/relatorios/views/AcionamentosCanaisView";

const RelatoriosPage = () => {
  useScrollRestore();
  const [active, setActive] = useState<ReportKey | null>(null);

  const back = () => setActive(null);

  if (active === "prestacao") return <PrestacaoContasView onBack={back} />;
  if (active === "carteira") return <CarteiraAnaliseView onBack={back} />;
  if (active === "negociacoes") return <NegociacoesDesempenhoView onBack={back} />;
  if (active === "canais") return <AcionamentosCanaisView onBack={back} />;

  return <ReportHub onOpen={setActive} />;
};

export default RelatoriosPage;
