import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInDays } from "date-fns";
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
  const [selectedStatus, setSelectedStatus] = useState("todos");
  const [selectedTipoDivida, setSelectedTipoDivida] = useState("todos");
  const [selectedTipoDevedor, setSelectedTipoDevedor] = useState("todos");
  const [quitacaoDe, setQuitacaoDe] = useState("");
  const [quitacaoAte, setQuitacaoAte] = useState("");

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

  // Fetch agreements with credor info for derived status
  const { data: agreements = [] } = useQuery({
    queryKey: ["agreements-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agreements").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: credoresData = [] } = useQuery({
    queryKey: ["credores-report"],
    queryFn: async () => {
      const { data, error } = await supabase.from("credores").select("razao_social, prazo_dias_acordo");
      if (error) throw error;
      return data || [];
    },
  });

  const credores = useMemo(() => {
    return [...new Set(clients.map((c) => c.credor))].sort();
  }, [clients]);

  // Build a map: credor name -> prazo_dias_acordo
  const credorPrazoMap = useMemo(() => {
    const map = new Map<string, number>();
    credoresData.forEach((c: any) => map.set(c.razao_social, c.prazo_dias_acordo ?? 30));
    return map;
  }, [credoresData]);

  // Derive agreement status: pago / pendente / quebra (exclude cancelled)
  const agreementDerivedStatus = useMemo(() => {
    const today = new Date();
    return agreements.filter((a: any) => a.status !== "cancelled").map((a: any) => {
      const cpf = a.client_cpf?.replace(/\D/g, "") || "";
      const prazo = credorPrazoMap.get(a.credor) ?? 30;
      const firstDue = parseISO(a.first_due_date);
      const daysSinceFirstDue = differenceInDays(today, firstDue);

      let derivedStatus: "pago" | "pendente" | "quebra";
      if (a.status === "approved" || a.status === "completed") {
        // Check if all installments for this CPF/credor are paid
        const relatedClients = clients.filter(
          (c) => c.cpf.replace(/\D/g, "") === cpf && c.credor === a.credor
        );
        const allPaid = relatedClients.length > 0 && relatedClients.every((c) => c.status === "pago");
        if (allPaid) {
          derivedStatus = "pago";
        } else if (daysSinceFirstDue > prazo) {
          derivedStatus = "quebra";
        } else {
          derivedStatus = "pendente";
        }
      } else if (a.status === "pending") {
        if (daysSinceFirstDue > prazo) {
          derivedStatus = "quebra";
        } else {
          derivedStatus = "pendente";
        }
      } else {
        // rejected/cancelled – treat as quebra
        derivedStatus = "quebra";
      }

      return { cpf, credor: a.credor, derivedStatus };
    });
  }, [agreements, clients, credorPrazoMap]);

  // CPFs matching selected agreement status filter
  const agreementFilteredCpfs = useMemo(() => {
    if (selectedStatus === "todos") return null;
    const cpfs = new Set<string>();
    agreementDerivedStatus
      .filter((a) => a.derivedStatus === selectedStatus)
      .forEach((a) => cpfs.add(a.cpf));
    return cpfs;
  }, [selectedStatus, agreementDerivedStatus]);

  // Base set: all CPFs that have at least one active agreement (exclude cancelled/rejected)
  const allAgreementCpfs = useMemo(() => {
    return new Set(agreements.filter((a: any) => a.status !== "cancelled" && a.status !== "rejected").map((a: any) => a.client_cpf?.replace(/\D/g, "")));
  }, [agreements]);

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      // Only include clients that have agreements
      if (!allAgreementCpfs.has(c.cpf.replace(/\D/g, ""))) return false;
      const d = parseISO(c.data_vencimento);
      if (d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== "all" && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedCredor !== "todos" && c.credor !== selectedCredor) return false;
      if (selectedOperator !== "todos" && c.operator_id !== selectedOperator) return false;
      if (selectedTipoDivida !== "todos" && (c as any).tipo_divida_id !== selectedTipoDivida) return false;
      if (selectedTipoDevedor !== "todos" && (c as any).tipo_devedor_id !== selectedTipoDevedor) return false;
      if (quitacaoDe && (!(c as any).data_quitacao || (c as any).data_quitacao < quitacaoDe)) return false;
      if (quitacaoAte && (!(c as any).data_quitacao || (c as any).data_quitacao > quitacaoAte)) return false;
      // Agreement status filter (pago/pendente/quebra)
      if (agreementFilteredCpfs !== null && !agreementFilteredCpfs.has(c.cpf.replace(/\D/g, ""))) return false;
      return true;
    });
  }, [clients, selectedYear, selectedMonth, selectedCredor, selectedOperator, selectedTipoDivida, selectedTipoDevedor, quitacaoDe, quitacaoAte, agreementFilteredCpfs, allAgreementCpfs]);

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
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
        selectedTipoDivida={selectedTipoDivida}
        setSelectedTipoDivida={setSelectedTipoDivida}
        selectedTipoDevedor={selectedTipoDevedor}
        setSelectedTipoDevedor={setSelectedTipoDevedor}
        quitacaoDe={quitacaoDe}
        setQuitacaoDe={setQuitacaoDe}
        quitacaoAte={quitacaoAte}
        setQuitacaoAte={setQuitacaoAte}
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
