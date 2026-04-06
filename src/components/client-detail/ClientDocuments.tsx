import { FileText, Download, CheckCircle2, Circle, AlertCircle, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { DOCUMENT_TYPES, TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";
import { resolveDocumentData } from "@/services/documentDataResolver";
import { renderDocument } from "@/services/documentRenderer";
import { validateDocumentGeneration, type ValidationResult } from "@/services/documentValidationService";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";

interface ClientDocumentsProps {
  client: any;
  clients: any[];
  cpf: string;
  totalAberto: number;
  lastAgreement: any;
}

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

  // Resolve all template vars centrally via service
  const totalPago = clients.reduce((s: number, c: any) => s + (Number(c.valor_pago) || 0), 0);
  const docData = resolveDocumentData({
    client,
    clients,
    credor,
    agreement: lastAgreement,
    totalAberto,
  });

  /**
   * 3-level fallback: credor → tenant → default
   * Returns { content, source }
   */
  const resolveTemplate = (credorKey: string, docType: string): { content: string; source: "credor" | "tenant" | "default" } | null => {
    const credorTemplate = credor?.[credorKey as keyof typeof credor] as string;
    if (credorTemplate?.trim()) return { content: credorTemplate, source: "credor" };

    const tenantTpl = tenantTemplates?.find((t) => t.type === docType);
    if (tenantTpl?.content?.trim()) return { content: tenantTpl.content, source: "tenant" };

    const defaultTpl = TEMPLATE_DEFAULTS[credorKey];
    if (defaultTpl) return { content: defaultTpl, source: "default" };

    return null;
  };

  const handleDownload = (credorKey: string, docType: string, label: string) => {
    // Validate first
    const validation = validateDocumentGeneration(docType, lastAgreement, totalAberto, totalPago);
    if (!validation.isValid) {
      toast.error(validation.reason);
      return;
    }

    const resolved = resolveTemplate(credorKey, docType);
    if (!resolved) {
      toast.error(`Modelo de "${label}" não configurado.`);
      return;
    }

    const result = renderDocument(resolved.content, docData.vars, resolved.source);

    if (result.missingPlaceholders.length > 0) {
      console.warn("Placeholders não resolvidos:", result.missingPlaceholders);
    }

    const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
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

  const getValidation = (docType: string): ValidationResult => {
    return validateDocumentGeneration(docType, lastAgreement, totalAberto, totalPago);
  };

  const configuredCount = DOCUMENT_TYPES.filter((d) => isConfigured(d.credorKey, d.type)).length;

  const getStatusIcon = (validation: ValidationResult, configured: boolean) => {
    if (!configured) return <Circle className="w-4 h-4 text-muted-foreground/50 shrink-0" />;
    if (!validation.isValid) return <Ban className="w-4 h-4 text-destructive/70 shrink-0" />;
    return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Card>
        <CardContent className="p-6">
          <h3 className="font-semibold text-foreground mb-4">Documentos do Devedor</h3>
          <p className="text-sm text-muted-foreground mb-6">
            Gere e baixe os documentos com os dados preenchidos automaticamente. Os modelos são definidos no cadastro do credor.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de documentos para download */}
            <div className="lg:col-span-2 flex flex-col gap-3">
              {DOCUMENT_TYPES.map((doc) => {
                const validation = getValidation(doc.type);
                const configured = isConfigured(doc.credorKey, doc.type);
                const canGenerate = configured && validation.isValid;

                return (
                  <Tooltip key={doc.credorKey}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => handleDownload(doc.credorKey, doc.type, doc.label)}
                        className={`flex items-center gap-4 p-4 rounded-xl border border-border bg-card transition-colors text-left group ${
                          canGenerate
                            ? "hover:bg-muted/50 cursor-pointer"
                            : "opacity-60 cursor-not-allowed"
                        }`}
                      >
                        <span className="text-2xl">{doc.icon}</span>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{doc.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {canGenerate ? "Clique para gerar e baixar" : validation.reason}
                          </p>
                        </div>
                        {canGenerate ? (
                          <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        )}
                      </button>
                    </TooltipTrigger>
                    {!canGenerate && (
                      <TooltipContent side="left">
                        <p className="text-xs">{validation.reason}</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                );
              })}
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
                    const validation = getValidation(doc.type);
                    return (
                      <Tooltip key={doc.credorKey}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2.5 cursor-default">
                            {getStatusIcon(validation, configured)}
                            <span className={`text-xs ${configured && validation.isValid ? "text-foreground" : "text-muted-foreground"}`}>
                              {doc.label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left">
                          <p className="text-xs">{configured ? validation.reason : "Modelo não configurado"}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
};

export default ClientDocuments;
