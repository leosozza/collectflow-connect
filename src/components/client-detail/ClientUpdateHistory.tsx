import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowRight } from "lucide-react";

interface Props {
  clientIds: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  import: "Importação Planilha",
  api: "API",
  maxlist: "MaxList",
  manual: "Edição Manual",
  regua: "Ação da Régua",
  whatsapp_auto: "WhatsApp Automático",
  email_auto: "E-mail Automático",
  system: "Sistema",
  workflow: "Workflow Automático",
};

const FIELD_LABELS: Record<string, string> = {
  nome_completo: "Nome",
  cpf: "CPF",
  phone: "Telefone 1",
  phone2: "Telefone 2",
  phone3: "Telefone 3",
  email: "E-mail",
  credor: "Credor",
  valor_parcela: "Valor Parcela",
  valor_pago: "Valor Pago",
  status: "Status",
  data_vencimento: "Vencimento",
  data_pagamento: "Pagamento",
  endereco: "Endereço",
  cidade: "Cidade",
  uf: "UF",
  cep: "CEP",
  status_cobranca_id: "Status do Cliente",
  observacoes: "Observações",
};

const ClientUpdateHistory = ({ clientIds }: Props) => {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["client-update-logs", clientIds],
    queryFn: async () => {
      if (clientIds.length === 0) return [];
      const { data, error } = await supabase
        .from("client_update_logs")
        .select("*")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;

      const items = data || [];

      // Fetch profile names for updated_by user IDs
      const userIds = [...new Set(items.filter(l => l.updated_by).map(l => l.updated_by as string))];
      let profileMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        if (profiles) {
          profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || ""]));
        }
      }

      return items.map(item => ({
        ...item,
        _user_name: item.updated_by ? (profileMap[item.updated_by] || null) : null,
      }));
    },
    enabled: clientIds.length > 0,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-4">Carregando histórico...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        Nenhuma atualização registrada
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-4 h-4 text-primary" />
          <h4 className="font-semibold text-sm">Histórico de Atualizações</h4>
        </div>
        {logs.map((log: any) => {
          const changes = (log.changes || {}) as Record<string, { old: any; new: any }>;
          const changedFields = Object.keys(changes);
          const sourceLabel = SOURCE_LABELS[log.source] || log.source;
          const userName = log._user_name;

          return (
            <div key={log.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </span>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {sourceLabel}
                </Badge>
                {userName && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    por {userName}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {changedFields.map((field) => (
                  <div key={field} className="flex items-center gap-2 text-xs">
                    <span className="font-medium text-foreground">
                      {FIELD_LABELS[field] || field}:
                    </span>
                    <span className="text-muted-foreground line-through">
                      {String(changes[field].old ?? "—")}
                    </span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                    <span className="text-foreground font-medium">
                      {String(changes[field].new ?? "—")}
                    </span>
                  </div>
                ))}
                {changedFields.length === 0 && (
                  <span className="text-xs text-muted-foreground">Sem alterações detalhadas</span>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default ClientUpdateHistory;
