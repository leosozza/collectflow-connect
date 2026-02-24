import { FileText, Download, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";

interface ClientDocumentsProps {
  client: any;
  clients: any[];
  cpf: string;
  totalAberto: number;
  lastAgreement: any;
}

const DOCUMENT_TYPES = [
  { key: "template_acordo", label: "Carta de Acordo", icon: "📄" },
  { key: "template_recibo", label: "Recibo de Pagamento", icon: "🧾" },
  { key: "template_quitacao", label: "Carta de Quitação", icon: "✅" },
  { key: "template_descricao_divida", label: "Descrição de Dívida", icon: "📋" },
  { key: "template_notificacao_extrajudicial", label: "Notificação Extrajudicial", icon: "⚖️" },
];

const replaceTemplateVars = (template: string, vars: Record<string, string>) => {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return result;
};

const ClientDocuments = ({ client, clients, cpf, totalAberto, lastAgreement }: ClientDocumentsProps) => {
  const { data: credor } = useQuery({
    queryKey: ["credor-templates", client.credor],
    queryFn: async () => {
      const { data } = await supabase
        .from("credores")
        .select("razao_social, nome_fantasia, cnpj, template_acordo, template_recibo, template_quitacao, template_descricao_divida, template_notificacao_extrajudicial")
        .or(`razao_social.eq.${client.credor},nome_fantasia.eq.${client.credor}`)
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!client.credor,
  });

  const templateVars: Record<string, string> = {
    nome_devedor: client.nome_completo || "",
    cpf_devedor: formatCPF(cpf),
    telefone_devedor: client.phone || "",
    email_devedor: client.email || "",
    endereco_devedor: [client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", "),
    valor_divida: formatCurrency(totalAberto),
    total_parcelas: String(clients.length),
    razao_social_credor: credor?.razao_social || client.credor || "",
    cnpj_credor: credor?.cnpj || "",
    data_atual: new Date().toLocaleDateString("pt-BR"),
    valor_acordo: lastAgreement ? formatCurrency(Number(lastAgreement.proposed_total)) : "",
    parcelas_acordo: lastAgreement ? String(lastAgreement.new_installments) : "",
    valor_parcela_acordo: lastAgreement ? formatCurrency(Number(lastAgreement.new_installment_value)) : "",
    primeiro_vencimento: lastAgreement?.first_due_date ? formatDate(lastAgreement.first_due_date) : "",
    desconto_acordo: lastAgreement?.discount_percent ? `${lastAgreement.discount_percent}%` : "0%",
  };

  const handleDownload = (key: string, label: string) => {
    const template = credor?.[key as keyof typeof credor] as string;
    if (!template) {
      toast.error(`Modelo de "${label}" não configurado para este credor.`);
      return;
    }
    const content = replaceTemplateVars(template, templateVars);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/ /g, "_")}_${client.nome_completo?.replace(/ /g, "_") || "devedor"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${label} gerado com sucesso!`);
  };

  const isConfigured = (key: string) => {
    if (!credor) return false;
    const val = credor[key as keyof typeof credor] as string;
    return !!val?.trim();
  };

  const configuredCount = DOCUMENT_TYPES.filter(d => isConfigured(d.key)).length;

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="font-semibold text-foreground mb-4">Documentos do Devedor</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Gere e baixe os documentos com os dados preenchidos automaticamente. Os modelos são definidos no cadastro do credor.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de documentos para download */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {DOCUMENT_TYPES.map((doc) => (
              <button
                key={doc.key}
                onClick={() => handleDownload(doc.key, doc.label)}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left group cursor-pointer"
              >
                <span className="text-2xl">{doc.icon}</span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">Clique para gerar e baixar</p>
                </div>
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
            ))}
          </div>

          {/* Painel lateral de status */}
          <div className="space-y-3">
            <div className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Status dos Modelos</p>
              </div>
              <p className="text-xs text-muted-foreground mb-4">
                {configuredCount}/{DOCUMENT_TYPES.length} configurados
              </p>
              <div className="space-y-2.5">
                {DOCUMENT_TYPES.map((doc) => {
                  const configured = isConfigured(doc.key);
                  return (
                    <div key={doc.key} className="flex items-center gap-2.5">
                      {configured ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      )}
                      <span className={`text-xs ${configured ? "text-foreground" : "text-muted-foreground"}`}>
                        {doc.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ClientDocuments;