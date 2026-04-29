import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { FileText, Pencil, Info, ChevronDown, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { DOCUMENT_TYPES, TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";
import { DOCUMENT_PLACEHOLDERS, PLACEHOLDER_CATEGORIES } from "@/lib/documentPlaceholders";
import { SAMPLE_CREDOR } from "@/services/documentLayoutService";
import A4LiveEditor, { type A4LiveEditorHandle } from "./A4LiveEditor";

interface CredorDocumentTemplatesProps {
  form: any;
  set: (key: string, value: any) => void;
  credorId?: string;
}

// (EditorPreview legacy component removed — replaced by A4LiveEditor)

/** Extract all {placeholder} tokens from text */
const extractPlaceholders = (text: string): string[] => {
  const matches = text.match(/\{[^}]+\}/g);
  return matches ? [...new Set(matches)] : [];
};

const VALID_KEYS = new Set(DOCUMENT_PLACEHOLDERS.map((p) => p.key));

const validatePlaceholders = (text: string): string[] => {
  return extractPlaceholders(text).filter((k) => !VALID_KEYS.has(k));
};

const SOURCE_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  credor: { label: "Modelo próprio do credor", variant: "default" },
  tenant: { label: "Herdando modelo do tenant", variant: "secondary" },
  default: { label: "Usando padrão do sistema", variant: "outline" },
};

const CredorDocumentTemplates = ({ form, set, credorId }: CredorDocumentTemplatesProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [confirmSaveInvalid, setConfirmSaveInvalid] = useState(false);
  const [invalidKeys, setInvalidKeys] = useState<string[]>([]);
  const editorRef = useRef<A4LiveEditorHandle>(null);

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

  const getSource = (credorKey: string, docType: string): "credor" | "tenant" | "default" => {
    const credorContent = form[credorKey];
    if (credorContent?.trim()) return "credor";
    const tenantTpl = tenantTemplates?.find((t: any) => t.type === docType);
    if (tenantTpl?.content?.trim()) return "tenant";
    return "default";
  };

  const getEffectiveContent = (credorKey: string, docType: string): string => {
    const credorContent = form[credorKey];
    if (credorContent?.trim()) return credorContent;
    const tenantTpl = tenantTemplates?.find((t: any) => t.type === docType);
    if (tenantTpl?.content?.trim()) return tenantTpl.content;
    return TEMPLATE_DEFAULTS[credorKey] || "";
  };

  const handleEdit = (credorKey: string, docType: string) => {
    setEditContent(getEffectiveContent(credorKey, docType));
    setEditingKey(credorKey);
  };

  const handleSave = () => {
    if (!editingKey) return;
    const bad = validatePlaceholders(editContent);
    if (bad.length > 0) {
      setInvalidKeys(bad);
      setConfirmSaveInvalid(true);
      return;
    }
    doSave();
  };

  const doSave = () => {
    if (!editingKey) return;
    set(editingKey, editContent);
    setEditingKey(null);
    setConfirmSaveInvalid(false);
    setInvalidKeys([]);
    toast.success("Modelo atualizado. Salve o credor para persistir.");
  };

  const handleInsertPlaceholder = async (key: string) => {
    // 1) Insert at the caret inside the live editor (preferred behaviour now).
    if (editorRef.current) {
      try {
        editorRef.current.insertAtCaret(key);
      } catch {
        // ignore — falls back to clipboard
      }
    }
    // 2) Always copy to clipboard as well, so the user can paste anywhere.
    try {
      await navigator.clipboard.writeText(key);
      toast.success(`Variável inserida: ${key}`, {
        description: "Também copiada para a área de transferência.",
      });
    } catch {
      const ta = document.createElement("textarea");
      ta.value = key;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  };

  const editingDocType = DOCUMENT_TYPES.find((d) => d.credorKey === editingKey);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        {DOCUMENT_TYPES.map((doc) => {
          const source = getSource(doc.credorKey, doc.type);
          const sourceInfo = SOURCE_LABELS[source];
          return (
            <Card key={doc.credorKey} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg shrink-0">{doc.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{doc.label}</p>
                  <Badge variant={sourceInfo.variant} className="text-[10px] mt-1">
                    {sourceInfo.label}
                  </Badge>
                </div>
              </div>
              <Button variant="outline" size="sm" type="button" onClick={() => handleEdit(doc.credorKey, doc.type)} className="gap-1 shrink-0">
                <Pencil className="w-3 h-3" /> Editar
              </Button>
            </Card>
          );
        })}
      </div>

      {/* Editor Sheet */}
      <Sheet open={!!editingKey} onOpenChange={(open) => !open && setEditingKey(null)}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span>{editingDocType?.icon}</span> {editingDocType?.label}
            </SheetTitle>
            <SheetDescription>Edite o modelo deste credor. Use variáveis e formatação abaixo.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Formatting guide */}
            <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-xs">Formatação disponível:</p>
              <p>
                <code className="bg-muted px-1 rounded">**texto**</code> negrito &nbsp;·&nbsp;
                <code className="bg-muted px-1 rounded">*texto*</code> itálico &nbsp;·&nbsp;
                <code className="bg-muted px-1 rounded">## Título</code> título &nbsp;·&nbsp;
                <code className="bg-muted px-1 rounded">- item</code> lista &nbsp;·&nbsp;
                <code className="bg-muted px-1 rounded">---</code> separador
              </p>
            </div>

            {/* Placeholders */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variáveis Disponíveis</p>
              {PLACEHOLDER_CATEGORIES.map((cat) => {
                const items = DOCUMENT_PLACEHOLDERS.filter((p) => p.category === cat.key);
                if (items.length === 0) return null;
                return (
                  <Collapsible key={cat.key} defaultOpen={cat.key === "devedor"}>
                    <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-semibold text-foreground py-1 hover:text-primary transition-colors w-full text-left">
                      <span className="text-[10px]">▸</span> {cat.label}
                      <span className="text-muted-foreground font-normal">({items.length})</span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="flex flex-wrap gap-1.5 pb-2 pl-3">
                        {items.map((p) => (
                          <Tooltip key={p.key}>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => handleInsertPlaceholder(p.key)}
                                className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent border border-border text-foreground transition-colors"
                              >
                                {p.key}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[220px]">
                              <p className="font-medium text-xs">{p.label}</p>
                              <p className="text-xs text-muted-foreground">{p.description}</p>
                              <p className="text-[10px] text-muted-foreground mt-1 italic">Clique para copiar e cole no editor</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>

            {/* Live A4 editor (WYSIWYG) */}
            {editingKey && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Pencil className="w-3.5 h-3.5" /> Editor visual (folha A4)
                </div>
                <A4LiveEditor
                  ref={editorRef}
                  initialMarkdown={editContent}
                  title={editingDocType?.label || "Documento"}
                  credor={{
                    razao_social: form?.razao_social || SAMPLE_CREDOR.razao_social,
                    nome_fantasia: form?.nome_fantasia || SAMPLE_CREDOR.nome_fantasia,
                    cnpj: form?.cnpj || SAMPLE_CREDOR.cnpj,
                    portal_logo_url: form?.portal_logo_url || SAMPLE_CREDOR.portal_logo_url,
                    document_logo_url: form?.document_logo_url || SAMPLE_CREDOR.document_logo_url,
                    endereco: form?.endereco || SAMPLE_CREDOR.endereco,
                    numero: form?.numero || SAMPLE_CREDOR.numero,
                    complemento: form?.complemento || SAMPLE_CREDOR.complemento,
                    bairro: form?.bairro || SAMPLE_CREDOR.bairro,
                    cidade: form?.cidade || SAMPLE_CREDOR.cidade,
                    uf: form?.uf || SAMPLE_CREDOR.uf,
                    cep: form?.cep || SAMPLE_CREDOR.cep,
                  }}
                  onChange={setEditContent}
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" /> O título e o rodapé do credor são fixos — você edita apenas o corpo do documento.
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => setEditingKey(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleSave}>
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Invalid placeholders confirmation */}
      <Dialog open={confirmSaveInvalid} onOpenChange={setConfirmSaveInvalid}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-500" /> Variáveis não reconhecidas
            </DialogTitle>
            <DialogDescription>
              Este modelo contém variáveis que não fazem parte da lista oficial e não serão substituídas automaticamente:
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-1.5 py-2">
            {invalidKeys.map((k) => (
              <code key={k} className="px-2 py-0.5 text-xs bg-destructive/10 text-destructive rounded-md border border-destructive/20">
                {k}
              </code>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSaveInvalid(false)}>
              Voltar e corrigir
            </Button>
            <Button variant="default" onClick={doSave}>
              Salvar mesmo assim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
};

export default CredorDocumentTemplates;
