import { Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const AdminAgentesDigitaisPage = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Agentes Digitais</h2>
          <p className="text-sm text-muted-foreground">Gerencie os agentes de IA da plataforma</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em breve</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            O módulo de Agentes Digitais está em desenvolvimento e será disponibilizado em breve.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAgentesDigitaisPage;
