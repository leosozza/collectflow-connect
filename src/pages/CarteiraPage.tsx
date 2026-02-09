import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClients, Client } from "@/services/clientService";
import CarteiraFilters from "@/components/carteira/CarteiraFilters";
import CarteiraTable from "@/components/carteira/CarteiraTable";
import { startOfDay, parseISO } from "date-fns";
import { format } from "date-fns";

const CarteiraPage = () => {
  const today = format(new Date(), "yyyy-MM-dd");
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [appliedFrom, setAppliedFrom] = useState(today);
  const [appliedTo, setAppliedTo] = useState(today);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const handleSearch = () => {
    setAppliedFrom(dateFrom);
    setAppliedTo(dateTo);
  };

  const handleClear = () => {
    setDateFrom("");
    setDateTo("");
    setAppliedFrom("");
    setAppliedTo("");
  };

  const filteredClients = useMemo(() => {
    const pending = clients.filter((c) => c.status === "pendente");

    if (!appliedFrom && !appliedTo) return pending;

    return pending.filter((c) => {
      const venc = c.data_vencimento;
      if (appliedFrom && venc < appliedFrom) return false;
      if (appliedTo && venc > appliedTo) return false;
      return true;
    });
  }, [clients, appliedFrom, appliedTo]);

  const overdueClients = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return clients.filter((c) => {
      if (c.status !== "pendente") return false;
      return c.data_vencimento < todayStr;
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
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onSearch={handleSearch}
        onClear={handleClear}
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
