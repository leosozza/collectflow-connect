import { useNavigate } from "react-router-dom";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Headset, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CarteiraKanbanProps {
  clients: Client[];
  loading: boolean;
  agreementCpfs: Set<string>;
}

interface KanbanColumn {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const COLUMNS: KanbanColumn[] = [
  {
    key: "pendente",
    label: "Pendentes",
    color: "text-amber-600",
    bgColor: "bg-amber-50 dark:bg-amber-950/30",
    borderColor: "border-t-amber-500",
  },
  {
    key: "em_acordo",
    label: "Em Acordo",
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-t-blue-500",
  },
  {
    key: "quebrado",
    label: "Quebrado",
    color: "text-red-600",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-t-red-500",
  },
  {
    key: "pago",
    label: "Pago",
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 dark:bg-emerald-950/30",
    borderColor: "border-t-emerald-500",
  },
];

const CarteiraKanban = ({ clients, loading, agreementCpfs }: CarteiraKanbanProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const getColumnClients = (columnKey: string): Client[] => {
    if (columnKey === "em_acordo") {
      return clients.filter(
        (c) => c.status === "pendente" && agreementCpfs.has(c.cpf.replace(/\D/g, ""))
      );
    }
    if (columnKey === "pendente") {
      return clients.filter(
        (c) => c.status === "pendente" && !agreementCpfs.has(c.cpf.replace(/\D/g, ""))
      );
    }
    return clients.filter((c) => c.status === columnKey);
  };

  const getColumnTotal = (columnClients: Client[]): number => {
    return columnClients.reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const columnClients = getColumnClients(col.key);
        const total = getColumnTotal(columnClients);

        return (
          <div
            key={col.key}
            className={`rounded-xl border border-border border-t-4 ${col.borderColor} ${col.bgColor} flex flex-col min-h-[400px]`}
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h3 className={`font-semibold ${col.color}`}>{col.label}</h3>
                <Badge variant="secondary" className="text-xs">
                  {columnClients.length}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total: {formatCurrency(total)}
              </p>
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-2 pb-2">
                {columnClients.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhum cliente
                  </p>
                ) : (
                  columnClients.map((client) => (
                    <div
                      key={client.id}
                      className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() =>
                        navigate(
                          `/carteira/${encodeURIComponent(
                            client.cpf.replace(/\D/g, "")
                          )}`
                        )
                      }
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-card-foreground truncate">
                            {client.nome_completo}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">
                            {client.cpf}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/atendimento/${client.id}`);
                          }}
                          title="Atender"
                        >
                          <Headset className="w-3.5 h-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {client.credor}
                        </span>
                        <span className="text-sm font-semibold text-card-foreground">
                          {formatCurrency(Number(client.valor_parcela))}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">
                          Parcela {client.numero_parcela}/{client.total_parcelas}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(client.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
};

export default CarteiraKanban;
