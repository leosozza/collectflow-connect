import { useNavigate } from "react-router-dom";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Headset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import PropensityBadge from "./PropensityBadge";

interface StatusCobranca {
  id: string;
  nome: string;
  cor: string;
}

interface CarteiraKanbanProps {
  clients: Client[];
  loading: boolean;
  tiposStatus: StatusCobranca[];
}

const CarteiraKanban = ({ clients, loading, tiposStatus }: CarteiraKanbanProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  // Build columns from tipos_status + a fallback for clients without status
  const columns = [
    ...tiposStatus.map((t) => ({
      key: t.id,
      label: t.nome,
      color: t.cor || "#6b7280",
    })),
    {
      key: "__sem_status",
      label: "Sem Status",
      color: "#6b7280",
    },
  ];

  const getColumnClients = (columnKey: string): Client[] => {
    if (columnKey === "__sem_status") {
      return clients.filter((c: any) => !c.status_cobranca_id);
    }
    return clients.filter((c: any) => c.status_cobranca_id === columnKey);
  };

  const getColumnTotal = (columnClients: Client[]): number => {
    return columnClients.reduce((sum, c) => sum + Number(c.valor_parcela), 0);
  };

  // Filter out empty "Sem Status" if no clients match
  const visibleColumns = columns.filter((col) => {
    if (col.key === "__sem_status") {
      return getColumnClients(col.key).length > 0;
    }
    return true;
  });

  const gridCols =
    visibleColumns.length <= 4
      ? `grid-cols-1 md:grid-cols-2 xl:grid-cols-${visibleColumns.length}`
      : `grid-cols-1 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-${Math.min(visibleColumns.length, 6)}`;

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {visibleColumns.map((col) => {
        const columnClients = getColumnClients(col.key);
        const total = getColumnTotal(columnClients);

        return (
          <div
            key={col.key}
            className="rounded-xl border border-border border-t-4 bg-muted/30 flex flex-col min-h-[400px]"
            style={{ borderTopColor: col.color }}
          >
            {/* Column header */}
            <div className="px-4 py-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <h3 className="font-semibold text-sm text-foreground">{col.label}</h3>
                </div>
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
                        <div className="flex items-center gap-2">
                          <PropensityBadge score={client.propensity_score} />
                          <span className="text-xs text-muted-foreground">
                            {new Date(client.data_vencimento + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        </div>
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
