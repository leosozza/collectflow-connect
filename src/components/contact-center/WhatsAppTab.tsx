import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

const WhatsAppTab = () => {
  return (
    <div className="mt-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <MessageCircle className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>WhatsApp em Lote</CardTitle>
              <CardDescription>
                Disparo de mensagens em lote via WhatsApp — em breve
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Esta funcionalidade será implementada na próxima fase. Aqui você poderá enviar mensagens em lote para clientes selecionados na carteira.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default WhatsAppTab;
