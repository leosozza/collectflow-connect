import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, Shield, Settings } from "lucide-react";

const mockTeam = [
  { name: "Carlos Silva", role: "Gerente Geral", department: "Gestão", status: "ativo" },
  { name: "Ana Oliveira", role: "Suporte N1", department: "Suporte", status: "ativo" },
  { name: "Pedro Santos", role: "Financeiro", department: "Financeiro", status: "ativo" },
  { name: "Julia Costa", role: "Treinamento", department: "Treinamento", status: "inativo" },
];

const roles = [
  { name: "Gerente Geral", permissions: "Acesso completo a todas as áreas", count: 1 },
  { name: "Equipe de Suporte", permissions: "Tickets, base de conhecimento, gestão de clientes", count: 2 },
  { name: "Equipe Financeira", permissions: "Receitas, cobranças, relatórios financeiros, planos", count: 1 },
  { name: "Treinamento", permissions: "Agendamento de reuniões, materiais, onboarding", count: 1 },
];

const AdminEquipesPage = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Equipes
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie colaboradores, cargos e permissões da equipe administrativa
          </p>
        </div>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Colaborador
        </Button>
      </div>

      {/* Roles/Cargos */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Cargos e Permissões
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {roles.map((role) => (
            <Card key={role.name}>
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{role.name}</h3>
                  <Badge variant="secondary">{role.count} membro(s)</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{role.permissions}</p>
                <Button variant="ghost" size="sm" className="mt-2 gap-1 text-xs">
                  <Settings className="w-3 h-3" />
                  Editar Permissões
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Colaboradores</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-xs text-muted-foreground uppercase">
                  <th className="px-4 py-2.5 text-left font-medium">Nome</th>
                  <th className="px-4 py-2.5 text-left font-medium">Cargo</th>
                  <th className="px-4 py-2.5 text-left font-medium">Departamento</th>
                  <th className="px-4 py-2.5 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mockTeam.map((member) => (
                  <tr key={member.name} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{member.name}</td>
                    <td className="px-4 py-2.5">{member.role}</td>
                    <td className="px-4 py-2.5">{member.department}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Badge variant={member.status === "ativo" ? "default" : "secondary"}>
                        {member.status}
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

export default AdminEquipesPage;
