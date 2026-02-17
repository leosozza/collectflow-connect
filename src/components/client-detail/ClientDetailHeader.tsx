import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileText, Headset, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ClientDetailHeaderProps {
  client: any;
  clients: any[];
  cpf: string;
  totalAberto: number;
  onFormalizarAcordo: () => void;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const ClientDetailHeader = ({ client, clients, cpf, totalAberto, onFormalizarAcordo }: ClientDetailHeaderProps) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const formattedCpf = formatCPF(cpf || "");

  const openWhatsApp = () => {
    if (!client.phone) {
      toast.error("Nenhum telefone cadastrado para este devedor");
      return;
    }
    const phone = client.phone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${intlPhone}`, "_blank");
  };

  const totalPago = clients.reduce((sum, c) => sum + Number(c.valor_pago), 0);
  const pagas = clients.filter((c) => c.status === "pago").length;
  const endereco = [client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", ");

  return (
    <Card className="p-4">
      {/* Linha 1: Nome + Ações */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex-1">{client.nome_completo}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600"
            onClick={openWhatsApp}
            title="WhatsApp"
          >
            <WhatsAppIcon className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600"
            onClick={() => navigate(`/atendimento/${client.id}`)}
            title="Atendimento"
          >
            <Headset className="w-5 h-5" />
          </Button>
          <Button onClick={onFormalizarAcordo} className="gap-2">
            <FileText className="w-4 h-4" />
            Formalizar Acordo
          </Button>
        </div>
      </div>

      {/* Linha 2: Metadados */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap pl-12 mt-2">
        <span><strong>CPF:</strong> {formattedCpf}</span>
        <span className="text-border">|</span>
        <span><strong>Tel:</strong> {client.phone ? formatPhone(client.phone) : "—"}</span>
        <span className="text-border">|</span>
        <span><strong>Email:</strong> {client.email || "—"}</span>
        <span className="text-border">|</span>
        <span><strong>Credor:</strong> {client.credor}</span>
        <span className="text-border">|</span>
        <span><strong>Em Aberto:</strong> <span className="text-destructive font-semibold">{formatCurrency(totalAberto)}</span></span>
      </div>

      {/* Linha 3: Colapsável */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full px-12 py-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted/50">
          <span>Mais informações do devedor</span>
          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-12 pt-3 pb-1 border-t border-border mt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Cod. Devedor</p>
                <p className="text-sm font-semibold text-foreground">{client.external_id || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Total Pago</p>
                <p className="text-sm font-semibold text-success">{formatCurrency(totalPago)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
                <p className="text-sm font-semibold text-foreground">{pagas}/{clients.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Endereço</p>
                <p className="text-sm text-foreground">{endereco || "—"}</p>
              </div>
            </div>
            {client.observacoes && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{client.observacoes}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ClientDetailHeader;
