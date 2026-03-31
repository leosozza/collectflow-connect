import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Client } from "@/services/clientService";
import { formatCurrency } from "@/lib/formatters";
import { Headset, ChevronLeft, ChevronRight } from "lucide-react";
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

const PAGE_SIZE = 100;

const CarteiraKanban = ({ clients, loading, tiposStatus }: CarteiraKanbanProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const originUrl = location.pathname + location.search;
  const [pages, setPages] = useState<Record<string, number>>({});

  if (loading) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  const columns = [
    ...tiposStatus.map((t) => ({
      key: t.id,
      label: t.nome,
      color: t.cor || "#6b7280",
    })),
    { key: "__sem_status", label: "Sem Status", color: "#6b7280" },
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

  const visibleColumns = columns.filter((col) => {
    if (col.key === "__sem_status") return getColumnClients(col.key).length > 0;
    return true;
  });

  const getPage = (key: string) => pages[key] || 0;
  const setPage = (key: string, page: number) => setPages((p) => ({ ...p, [key]: page }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {visibleColumns.map((col) => {
        const columnClients = getColumnClients(col.key);
        const total = getColumnTotal(columnClients);
        const page = getPage(col.key);
        const totalPages = Math.ceil(columnClients.length / PAGE_SIZE);
        const start = page * PAGE_SIZE;
        const end = Math.min(start + PAGE_SIZE, columnClients.length);
        const visibleClients = columnClients.slice(start, end);

        return (
          <div
            key={col.key}
            className="rounded-xl border border-border border-t-4 bg-muted/30 flex flex-col min-h-[400px] min-w-[250px] flex-1"
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
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={page === 0}
                    onClick={() => setPage(col.key, page - 1)}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {start + 1}-{end} de {columnClients.length}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(col.key, page + 1)}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Cards */}
            <ScrollArea className="flex-1 px-3 py-2">
              <div className="space-y-2 pb-2">
                {visibleClients.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhum cliente
                  </p>
                ) : (
                  visibleClients.map((client) => (
                    <div
                      key={client.id}
                      className="bg-card rounded-lg border border-border p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() =>
                        navigate(`/carteira/${encodeURIComponent(client.cpf.replace(/\D/g, ""))}`)
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
                        <span className="text-xs text-muted-foreground">{client.credor}</span>
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
