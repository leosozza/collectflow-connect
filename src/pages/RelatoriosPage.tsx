import { useMemo } from "react";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "@/services/clientService";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { parseISO } from "date-fns";
import { useUrlState } from "@/hooks/useUrlState";
import { Client } from "@/services/clientService";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Printer } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import * as XLSX from "xlsx";
import ReportFilters from "@/components/relatorios/ReportFilters";
import EvolutionChart from "@/components/relatorios/EvolutionChart";
import AgingReport from "@/components/relatorios/AgingReport";
import PrestacaoContas from "@/components/relatorios/PrestacaoContas";

const RelatoriosPage = () => {
  useScrollRestore();
  const now = new Date();
  const { tenant } = useTenant();
  const [selectedYear, setSelectedYear] = useUrlState("year", now.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useUrlState("month", "all");
  const [selectedCredor, setSelectedCredor] = useUrlState("credor", "todos");
  const [selectedOperator, setSelectedOperator] = useUrlState("operator", "todos");
  const [selectedStatus, setSelectedStatus] = useUrlState("status", "todos");
  const [selectedTipoDivida, setSelectedTipoDivida] = useUrlState("tipoDivida", "todos");
  const [selectedTipoDevedor, setSelectedTipoDevedor] = useUrlState("tipoDevedor", "todos");
  const [quitacaoDe, setQuitacaoDe] = useUrlState("quitDe", "");
  const [quitacaoAte, setQuitacaoAte] = useUrlState("quitAte", "");

  const { data: clients = [] } = useQuery({
    queryKey: ["clients", tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const result = await fetchClients(tenant.id);
      return result.data;
    },
    enabled: !!tenant?.id,
  });

  // Isolamento por tenant nos operadores
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles", tenant?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, user_id, full_name").eq("tenant_id", tenant!.id);
      return (data || []).map((p: any) => ({ id: p.user_id, profileId: p.id, name: p.full_name || "Sem nome" }));
    },
    enabled: !!tenant?.id,
  });

  // === PAGAMENTO REAL CONSOLIDADO === via RPC get_agreement_financials
  const { data: agreements = [] } = useQuery({
    queryKey: ["agreement-financials-report", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_agreement_financials", { _tenant_id: tenant!.id });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        id: r.agreement_id,
        total_paid_real: Number(r.total_paid_real || 0),
        pending_balance_real: Number(r.pending_balance_real || 0),
        proposed_total: Number(r.proposed_total || 0),
        original_total: Number(r.original_total || 0),
      }));
    },
    enabled: !!tenant?.id,
  });

  const credores = useMemo(() => {
    return [...new Set(clients.map((c) => c.credor))].sort();
  }, [clients]);

  // Filter agreements by selected filters
  const filteredAgreements = useMemo(() => {
    return agreements.filter((a: any) => {
      if (a.status === "rejected") return false;
      const d = parseISO(a.created_at);
      if (d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== "all" && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedCredor !== "todos" && a.credor !== selectedCredor) return false;
      if (selectedOperator !== "todos" && a.created_by !== selectedOperator) return false;

      // Status filter mapping
      if (selectedStatus !== "todos") {
        if (selectedStatus === "pago" && a.status !== "completed") return false;
        if (selectedStatus === "pendente" && !["pending", "pending_approval", "approved", "overdue"].includes(a.status)) return false;
        if (selectedStatus === "quebra" && a.status !== "cancelled") return false;
      }

      return true;
    });
  }, [agreements, selectedYear, selectedMonth, selectedCredor, selectedOperator, selectedStatus]);

  // Filter clients for aging (still installment-based)
  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const d = parseISO(c.data_vencimento);
      if (d.getFullYear() !== parseInt(selectedYear)) return false;
      if (selectedMonth !== "all" && d.getMonth() !== parseInt(selectedMonth)) return false;
      if (selectedCredor !== "todos" && c.credor !== selectedCredor) return false;
      if (selectedOperator !== "todos" && c.operator_id !== selectedOperator) return false;
      if (selectedTipoDivida !== "todos" && (c as any).tipo_divida_id !== selectedTipoDivida) return false;
      if (selectedTipoDevedor !== "todos" && (c as any).tipo_devedor_id !== selectedTipoDevedor) return false;
      if (quitacaoDe && (!(c as any).data_quitacao || (c as any).data_quitacao < quitacaoDe)) return false;
      if (quitacaoAte && (!(c as any).data_quitacao || (c as any).data_quitacao > quitacaoAte)) return false;
      return true;
    });
  }, [clients, selectedYear, selectedMonth, selectedCredor, selectedOperator, selectedTipoDivida, selectedTipoDevedor, quitacaoDe, quitacaoAte]);

  // KPIs from agreements
  // === MÉTRICA DE ACORDO === KPIs baseados em pagamento real consolidado
  const activeAgreements = filteredAgreements.filter((a: any) => a.status !== "cancelled");
  const totalNegociado = activeAgreements.reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
  const totalRecebido = activeAgreements.reduce((s: number, a: any) => s + Number(a.total_paid_real || 0), 0);
  const totalQuebra = filteredAgreements.filter((a: any) => a.status === "cancelled").reduce((s: number, a: any) => s + Number(a.proposed_total), 0);
  const totalPendente = activeAgreements.reduce((s: number, a: any) => s + Number(a.pending_balance_real || 0), 0);

  const exportExcel = () => {
    const rows = filteredAgreements.map((a: any) => ({
      Cliente: a.client_name,
      CPF: a.client_cpf,
      Credor: a.credor,
      "Valor Original": Number(a.original_total),
      "Valor Negociado": Number(a.proposed_total),
      "1º Vencimento": a.first_due_date,
      Status: a.status,
      "Data Criação": a.created_at,
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
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList className="print:hidden">
          <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
          <TabsTrigger value="prestacao-contas">Prestação de Contas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-6 mt-4">
          <div className="flex justify-end gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={exportExcel}>
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> PDF
            </Button>
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

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Acordos", value: activeAgreements.length },
              { label: "Total Recebido", value: formatCurrency(totalRecebido) },
              { label: "Total Quebra", value: formatCurrency(totalQuebra) },
              { label: "Total Pendente", value: formatCurrency(totalPendente) },
            ].map((item) => (
              <div key={item.label} className="bg-card rounded-xl border border-border p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold text-card-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <EvolutionChart agreements={filteredAgreements} year={parseInt(selectedYear)} />

          <AgingReport clients={filteredClients} />
        </TabsContent>

        <TabsContent value="prestacao-contas" className="mt-4">
          <PrestacaoContas
            clients={clients}
            agreements={agreements}
            operators={profiles}
            credores={credores}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RelatoriosPage;
