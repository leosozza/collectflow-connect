import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, Phone, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { toast } from "sonner";

interface ClientDetailHeaderProps {
  client: any;
  cpf: string;
  totalAberto: number;
  onFormalizarAcordo: () => void;
}

const ClientDetailHeader = ({ client, cpf, totalAberto, onFormalizarAcordo }: ClientDetailHeaderProps) => {
  const navigate = useNavigate();
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

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/carteira")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground flex-1">{client.nome_completo}</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-green-500 hover:text-green-600 hover:bg-green-500/10"
            onClick={openWhatsApp}
            title="WhatsApp"
          >
            <MessageCircle className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
            onClick={() => navigate(`/atendimento/${client.id}`)}
            title="Ligar"
          >
            <Phone className="w-5 h-5" />
          </Button>
          <Button onClick={onFormalizarAcordo} className="gap-2">
            <FileText className="w-4 h-4" />
            Formalizar Acordo
          </Button>
        </div>
      </div>
      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap pl-12">
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
    </div>
  );
};

export default ClientDetailHeader;
