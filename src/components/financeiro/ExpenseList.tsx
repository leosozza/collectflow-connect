import { Expense } from "@/services/financeService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

const ExpenseList = ({ expenses, onDelete }: ExpenseListProps) => {
  if (expenses.length === 0) {
    return <p className="text-muted-foreground text-center py-8">Nenhuma despesa registrada.</p>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{format(new Date(e.expense_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
              <TableCell>{e.description}</TableCell>
              <TableCell className="capitalize">{e.category}</TableCell>
              <TableCell className="text-right">{formatCurrency(e.amount)}</TableCell>
              <TableCell className="text-right">
                <Button size="sm" variant="ghost" onClick={() => onDelete(e.id)}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default ExpenseList;
