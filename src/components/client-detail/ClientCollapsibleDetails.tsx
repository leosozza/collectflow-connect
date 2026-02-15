import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/formatters";

interface ClientCollapsibleDetailsProps {
  clients: any[];
  first: any;
}

const ClientCollapsibleDetails = ({ clients, first }: ClientCollapsibleDetailsProps) => {
  const [open, setOpen] = useState(false);

  const totalPago = clients.reduce((sum, c) => sum + Number(c.valor_pago), 0);
  const pagas = clients.filter((c) => c.status === "pago").length;

  const endereco = [first.endereco, first.cidade, first.uf, first.cep].filter(Boolean).join(", ");

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer w-full pl-12">
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <span>Mais informações do devedor</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-card rounded-xl border border-border p-5 mt-3 ml-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Total Pago</p>
              <p className="text-sm font-semibold text-success">{formatCurrency(totalPago)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
              <p className="text-sm font-semibold text-foreground">{pagas}/{clients.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Cod. Devedor</p>
              <p className="text-sm font-semibold text-foreground">{first.external_id || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Endereço</p>
              <p className="text-sm text-foreground">{endereco || "—"}</p>
            </div>
          </div>
          {first.observacoes && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{first.observacoes}</p>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default ClientCollapsibleDetails;
