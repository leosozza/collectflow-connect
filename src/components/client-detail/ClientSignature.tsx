import { Mail, Copy, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

interface ClientSignatureProps {
  client: any;
  lastAgreement: any;
}

const ClientSignature = ({ client, lastAgreement }: ClientSignatureProps) => {
  const hasAgreement = lastAgreement && lastAgreement.checkout_token;
  const portalUrl = hasAgreement
    ? `${window.location.origin}/portal?token=${lastAgreement.checkout_token}`
    : null;

  const { data: signatures = [] } = useQuery({
    queryKey: ["agreement-signatures", lastAgreement?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("agreement_signatures")
        .select("*")
        .eq("agreement_id", lastAgreement.id)
        .order("signed_at", { ascending: false });
      return data || [];
    },
    enabled: !!lastAgreement?.id,
  });

  const isSigned = signatures.length > 0;

  const copyLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast.success("Link copiado para a área de transferência!");
  };

  const sendWhatsApp = () => {
    if (!client.phone || !portalUrl) return;
    const phone = client.phone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const msg = encodeURIComponent(`Olá ${client.nome_completo}, segue o link para assinar seu acordo: ${portalUrl}`);
    window.open(`https://wa.me/${intlPhone}?text=${msg}`, "_blank");
  };

  const sendEmail = () => {
    if (!client.email || !portalUrl) {
      toast.error("E-mail do devedor não cadastrado.");
      return;
    }
    const subject = encodeURIComponent("Assinatura de Acordo");
    const body = encodeURIComponent(`Olá ${client.nome_completo},\n\nSegue o link para assinar seu acordo:\n${portalUrl}\n\nAtenciosamente.`);
    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, "_blank");
  };

  if (!hasAgreement) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            Nenhum acordo com token de assinatura encontrado. Formalize e aprove um acordo primeiro.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Assinatura Digital</h3>
          {isSigned ? (
            <Badge className="bg-success/10 text-success border-success/30 gap-1">
              <CheckCircle className="w-3 h-3" /> Assinado
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
              Pendente
            </Badge>
          )}
        </div>

        {isSigned && (
          <div className="text-sm text-muted-foreground">
            <p>Assinado em: {new Date(signatures[0].signed_at).toLocaleString("pt-BR")}</p>
            <p>Tipo: {signatures[0].signature_type}</p>
          </div>
        )}

        <div>
          <p className="text-sm text-muted-foreground mb-4">Envie o link de assinatura para o devedor:</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="gap-2" onClick={sendWhatsApp}>
              <WhatsAppIcon className="w-4 h-4 text-green-500" />
              Enviar por WhatsApp
            </Button>
            <Button variant="outline" className="gap-2" onClick={sendEmail}>
              <Mail className="w-4 h-4" />
              Enviar por E-mail
            </Button>
            <Button variant="outline" className="gap-2" onClick={copyLink}>
              <Copy className="w-4 h-4" />
              Copiar Link
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientSignature;
