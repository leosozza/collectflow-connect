import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";
import ReportFilters from "@/components/relatorios/ReportFilters";
import EvolutionChart from "@/components/relatorios/EvolutionChart";
import AgingReport from "@/components/relatorios/AgingReport";
import OperatorRanking from "@/components/relatorios/OperatorRanking";

const RelatoriosPage = () => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedCredor, setSelectedCredor] = useState("todos");
  const [selectedOperator, setSelectedOperator] = useState("todos");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: () => fetchClients(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return (data || []).map((p) => ({ id: p.id, name: p.full_name || "Sem nome" }));
    },
  });

  const credores = useMemo(() => {
    return [...new Set(clients.map((c) => c.credor))].sort();
  }, [clients]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      if (d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== "all" && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedCredor !== "todos" && c.credor !== selectedCredor) return false;
      if (selectedOperator !== "todos" && c.operator_id !== selectedOperator) return false;
      return true;
    });
  }, [clients, selectedYear, selectedMonth, selectedCredor, selectedOperator]);

  const exportExcel = () => {
    const rows = filteredClients.map((c) => ({
      Nome: c.nome_completo,
      CPF: c.cpf,
      Credor: c.credor,
      Parcela: `${c.numero_parcela}/${c.total_parcelas}`,
      "Valor Parcela": Number(c.valor_parcela),
      "Valor Pago": Number(c.valor_pago),
      Vencimento: c.data_vencimento,
      Status: c.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio_${selectedYear}_${selectedMonth}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Análise de desempenho e evolução da carteira</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportExcel}>
            <Download className="w-4 h-4 mr-1" /> Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <ReportFilters
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedCredor={selectedCredor}
        setSelectedCredor={setSelectedCredor}
        selectedOperator={selectedOperator}
        setSelectedOperator={setSelectedOperator}
        credores={credores}
        operators={profiles}
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Parcelas", value: filteredClients.length },
          { label: "Total Recebido", value: formatCurrency(filteredClients.filter((c) => c.status === "pago").reduce((s, c) => s + Number(c.valor_pago), 0)) },
          { label: "Total Quebra", value: formatCurrency(filteredClients.filter((c) => c.status === "quebrado").reduce((s, c) => s + Number(c.valor_parcela), 0)) },
          { label: "Pendentes", value: filteredClients.filter((c) => c.status === "pendente").length },
        ].map((item) => (
          <div key={item.label} className="bg-card rounded-xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-lg font-bold text-card-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <EvolutionChart clients={filteredClients} year={parseInt(selectedYear)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgingReport clients={filteredClients} />
        <OperatorRanking clients={filteredClients} operators={profiles} />
      </div>
    </div>
  );
};

export default RelatoriosPage;
