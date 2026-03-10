import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GraduationCap, Calendar, Video, Users, Plus } from "lucide-react";

const mockMeetings = [
  { title: "Onboarding - Empresa XYZ", date: "2026-03-15", type: "Onboarding", participants: 3, status: "agendada" },
  { title: "Treinamento Módulo Carteira", date: "2026-03-12", type: "Treinamento", participants: 5, status: "realizada" },
  { title: "Reunião Mensal - Empresa ABC", date: "2026-03-10", type: "Reunião", participants: 2, status: "realizada" },
  { title: "Treinamento Automação", date: "2026-03-18", type: "Treinamento", participants: 8, status: "agendada" },
];

const AdminTreinamentosPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" />
            Treinamentos e Reuniões
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Agenda, materiais de onboarding e acompanhamento
          </p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Agendar Reunião
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Agendadas</span>
            </div>
            <p className="text-2xl font-bold text-foreground">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Video className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Realizadas (mês)</span>
            </div>
            <p className="text-2xl font-bold text-foreground">2</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Participantes</span>
            </div>
            <p className="text-2xl font-bold text-foreground">18</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Materiais</span>
            </div>
            <p className="text-2xl font-bold text-foreground">6</p>
          </CardContent>
        </Card>
      </div>

      {/* Meetings Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Agenda de Reuniões</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Título</th>
                  <th className="px-4 py-2.5 text-left font-medium">Data</th>
                  <th className="px-4 py-2.5 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2.5 text-right font-medium">Participantes</th>
                  <th className="px-4 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockMeetings.map((m) => (
                  <tr key={m.title} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{m.title}</td>
                    <td className="px-4 py-2.5">{m.date}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline">{m.type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">{m.participants}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant={m.status === "agendada" ? "default" : "secondary"}>
                        {m.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminTreinamentosPage;
