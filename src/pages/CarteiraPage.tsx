import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
import CarteiraFilters from "@/components/carteira/CarteiraFilters";
import CarteiraTable from "@/components/carteira/CarteiraTable";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";

export type FilterMode = "dia" | "semana" | "mes";

const CarteiraPage = () => {
  const [mode, setMode] = useState<FilterMode>("dia");
  const [referenceDate, setReferenceDate] = useState(new Date());

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const filteredClients = useMemo(() => {
    const pending = clients.filter((c) => c.status === "pendente");

    let start: Date;
    let end: Date;

    switch (mode) {
      case "dia":
        start = startOfDay(referenceDate);
        end = endOfDay(referenceDate);
        break;
      case "semana":
        start = startOfWeek(referenceDate, { weekStartsOn: 1 });
        end = endOfWeek(referenceDate, { weekStartsOn: 1 });
        break;
      case "mes":
        start = startOfMonth(referenceDate);
        end = endOfMonth(referenceDate);
        break;
    }

    return pending.filter((c) => {
      const venc = parseISO(c.data_vencimento);
      return isWithinInterval(venc, { start, end });
    });
  }, [clients, mode, referenceDate]);

  const overdueClients = useMemo(() => {
    const today = startOfDay(new Date());
    return clients.filter((c) => {
      if (c.status !== "pendente") return false;
      const venc = parseISO(c.data_vencimento);
      return venc < today;
    });
  }, [clients]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Carteira</h1>
        <p className="text-muted-foreground text-sm">
          Acompanhe os vencimentos e clientes inadimplentes
        </p>
      </div>

      <CarteiraFilters
        mode={mode}
        onModeChange={setMode}
        referenceDate={referenceDate}
        onDateChange={setReferenceDate}
      />

      <CarteiraTable
        clients={filteredClients}
        loading={isLoading}
        title="Clientes com Vencimento no Período"
      />

      <CarteiraTable
        clients={overdueClients}
        loading={isLoading}
        title="Clientes Inadimplentes"
        isOverdue
      />
    </div>
  );
};

export default CarteiraPage;
