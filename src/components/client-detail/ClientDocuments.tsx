import { FileText, Download, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF, formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { DOCUMENT_TYPES, TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";

interface ClientDocumentsProps {
  client: any;
  clients: any[];
  cpf: string;
  totalAberto: number;
  lastAgreement: any;
}

const replaceTemplateVars = (template: string, vars: Record<string, string>) => {
  let result = template;
  Object.entries(vars).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  });
  return result;
};

const ClientDocuments = ({ client, clients, cpf, totalAberto, lastAgreement }: ClientDocumentsProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

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

  // Fetch tenant-level templates (fallback level 2)
  const { data: tenantTemplates } = useQuery({
    queryKey: ["document-templates-fallback", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("document_templates")
        .select("type, content")
        .eq("tenant_id", tenantId!);
      return data || [];
    },
    enabled: !!tenantId,
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
    // Aliases for CredorForm-style placeholders
    quantidade_parcelas: lastAgreement ? String(lastAgreement.new_installments) : String(clients.length),
    valor_parcela: lastAgreement ? formatCurrency(Number(lastAgreement.new_installment_value)) : "",
    desconto_concedido: lastAgreement?.discount_percent ? String(lastAgreement.discount_percent) : "0",
    numero_parcela: "1",
    data_vencimento: lastAgreement?.first_due_date ? formatDate(lastAgreement.first_due_date) : "",
    valor_pago: formatCurrency(clients.reduce((s: number, c: any) => s + (c.valor_pago || 0), 0)),
    data_acordo: lastAgreement ? formatDate(lastAgreement.created_at) : "",
    data_pagamento: new Date().toLocaleDateString("pt-BR"),
  };

  /**
   * Resolve template with 3-level fallback:
   * 1. Credor column (existing behavior)
   * 2. Tenant document_templates table
   * 3. System defaults from documentDefaults.ts
   */
  const resolveTemplate = (credorKey: string, docType: string): string | null => {
    // Level 1: Credor column
    const credorTemplate = credor?.[credorKey as keyof typeof credor] as string;
    if (credorTemplate?.trim()) return credorTemplate;

    // Level 2: Tenant template
    const tenantTpl = tenantTemplates?.find((t) => t.type === docType);
    if (tenantTpl?.content?.trim()) return tenantTpl.content;

    // Level 3: System default
    return TEMPLATE_DEFAULTS[credorKey] || null;
  };

  const handleDownload = (credorKey: string, docType: string, label: string) => {
    const template = resolveTemplate(credorKey, docType);
    if (!template) {
      toast.error(`Modelo de "${label}" não configurado.`);
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

  const isConfigured = (credorKey: string, docType: string) => {
    return !!resolveTemplate(credorKey, docType);
  };

  const configuredCount = DOCUMENT_TYPES.filter((d) => isConfigured(d.credorKey, d.type)).length;

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
                key={doc.credorKey}
                onClick={() => handleDownload(doc.credorKey, doc.type, doc.label)}
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
                  const configured = isConfigured(doc.credorKey, doc.type);
                  return (
                    <div key={doc.credorKey} className="flex items-center gap-2.5">
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
