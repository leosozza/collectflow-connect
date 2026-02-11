import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useToast } from "@/hooks/use-toast";
import { fetchExpenses, createExpense, deleteExpense, ExpenseFormData } from "@/services/financeService";
import { fetchClients } from "@/services/clientService";
import ExpenseForm from "@/components/financeiro/ExpenseForm";
import ExpenseList from "@/components/financeiro/ExpenseList";
import StatCard from "@/components/StatCard";
// StatCard icons are predefined
import { formatCurrency } from "@/lib/formatters";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const FinanceiroPage = () => {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [revenue, setRevenue] = useState(0);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [month, setMonth] = useState(format(now, "yyyy-MM"));

  const dateFrom = format(startOfMonth(new Date(month + "-01")), "yyyy-MM-dd");
  const dateTo = format(endOfMonth(new Date(month + "-01")), "yyyy-MM-dd");

  const load = async () => {
    setLoading(true);
    try {
      const [expData, clientData] = await Promise.all([
        fetchExpenses({ dateFrom, dateTo }),
        fetchClients({ status: "pago", dateFrom, dateTo }),
      ]);
      setExpenses(expData);
      setRevenue(clientData.reduce((s, c) => s + c.valor_pago, 0));
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [month]);

  const handleCreate = async (data: ExpenseFormData) => {
    if (!user || !tenant) return;
    await createExpense(data, user.id, tenant.id);
    toast({ title: "Despesa registrada!" });
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteExpense(id);
    toast({ title: "Despesa removida." });
    load();
  };

  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const margin = revenue - totalExpenses;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Financeiro</h1>
        <ExpenseForm onSubmit={handleCreate} />
      </div>

      <div className="flex items-center gap-4">
        <div>
          <Label>Mês</Label>
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-48" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Receita Bruta" value={formatCurrency(revenue)} icon="received" />
        <StatCard title="Despesas" value={formatCurrency(totalExpenses)} icon="broken" />
        <StatCard title="Margem Líquida" value={formatCurrency(margin)} icon="commission" />
        <StatCard title="Registros" value={String(expenses.length)} icon="projected" />
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <ExpenseList expenses={expenses} onDelete={handleDelete} />
      )}
    </div>
  );
};

export default FinanceiroPage;
