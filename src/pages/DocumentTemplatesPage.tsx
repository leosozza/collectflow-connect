import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";
import { FileText, Eye, RotateCcw, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DOCUMENT_TYPES, TEMPLATE_DEFAULTS } from "@/lib/documentDefaults";
import { DOCUMENT_PLACEHOLDERS, PLACEHOLDER_CATEGORIES, SAMPLE_DATA } from "@/lib/documentPlaceholders";

interface TemplateRow {
  id: string;
  tenant_id: string;
  type: string;
  name: string;
  description: string | null;
  content: string;
  is_customized: boolean;
  created_at: string;
  updated_at: string;
}

const replaceVars = (text: string, vars: Record<string, string>) => {
  let result = text;
  Object.entries(vars).forEach(([key, val]) => {
    result = result.replace(new RegExp(key.replace(/[{}]/g, "\\$&"), "g"), val);
  });
  return result;
};

const DocumentTemplatesPage = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  const [editingType, setEditingType] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [previewType, setPreviewType] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch existing templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["document-templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return (data || []) as TemplateRow[];
    },
    enabled: !!tenantId,
  });

  // Seed missing templates
  useEffect(() => {
    if (!tenantId || !templates) return;
    const existingTypes = new Set(templates.map((t) => t.type));
    const missing = DOCUMENT_TYPES.filter((dt) => !existingTypes.has(dt.type));
    if (missing.length === 0) return;

    const rows = missing.map((dt) => ({
      tenant_id: tenantId,
      type: dt.type,
      name: dt.label,
      description: dt.description,
      content: TEMPLATE_DEFAULTS[dt.credorKey] || "",
      is_customized: false,
    }));

    supabase
      .from("document_templates")
      .insert(rows)
      .then(({ error }) => {
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["document-templates", tenantId] });
        }
      });
  }, [tenantId, templates, queryClient]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async ({ type, content }: { type: string; content: string }) => {
      const { error } = await supabase
        .from("document_templates")
        .update({ content, is_customized: true })
        .eq("tenant_id", tenantId!)
        .eq("type", type);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo salvo com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["document-templates", tenantId] });
      setEditingType(null);
    },
    onError: () => toast.error("Erro ao salvar modelo."),
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: async (type: string) => {
      const docType = DOCUMENT_TYPES.find((d) => d.type === type);
      if (!docType) throw new Error("Tipo não encontrado");
      const defaultContent = TEMPLATE_DEFAULTS[docType.credorKey] || "";
      const { error } = await supabase
        .from("document_templates")
        .update({ content: defaultContent, is_customized: false })
        .eq("tenant_id", tenantId!)
        .eq("type", type);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modelo restaurado ao padrão!");
      queryClient.invalidateQueries({ queryKey: ["document-templates", tenantId] });
    },
    onError: () => toast.error("Erro ao restaurar modelo."),
  });

  const getTemplate = (type: string): TemplateRow | undefined =>
    templates?.find((t) => t.type === type);

  const handleEdit = (type: string) => {
    const tpl = getTemplate(type);
    const docType = DOCUMENT_TYPES.find((d) => d.type === type);
    setEditContent(tpl?.content || TEMPLATE_DEFAULTS[docType?.credorKey || ""] || "");
    setEditingType(type);
  };

  const handleInsertPlaceholder = (key: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newContent = editContent.substring(0, start) + key + editContent.substring(end);
    setEditContent(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + key.length, start + key.length);
    }, 0);
  };

  const editingDocType = DOCUMENT_TYPES.find((d) => d.type === editingType);
  const previewDocType = DOCUMENT_TYPES.find((d) => d.type === previewType);
  const previewContent = previewType
    ? replaceVars(getTemplate(previewType)?.content || TEMPLATE_DEFAULTS[previewDocType?.credorKey || ""] || "", SAMPLE_DATA)
    : "";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-bold text-foreground">Modelos de Documentos</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie os modelos utilizados na geração de documentos de cobrança.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6 h-40" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {DOCUMENT_TYPES.map((docType) => {
            const tpl = getTemplate(docType.type);
            const isCustomized = tpl?.is_customized ?? false;

            return (
              <Card key={docType.type} className="group hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{docType.icon}</span>
                      <div>
                        <h3 className="font-semibold text-foreground text-sm">{docType.label}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{docType.description}</p>
                      </div>
                    </div>
                  </div>

                  <Badge variant={isCustomized ? "default" : "secondary"} className="self-start text-xs">
                    {isCustomized ? (
                      <><CheckCircle2 className="w-3 h-3 mr-1" /> Personalizado</>
                    ) : (
                      <><Circle className="w-3 h-3 mr-1" /> Padrão</>
                    )}
                  </Badge>

                  {tpl?.updated_at && isCustomized && (
                    <p className="text-xs text-muted-foreground">
                      Atualizado em {new Date(tpl.updated_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(docType.type)}>
                      <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPreviewType(docType.type)}>
                      <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                    </Button>
                    {isCustomized && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground"
                        onClick={() => restoreMutation.mutate(docType.type)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Editor Sheet */}
      <Sheet open={!!editingType} onOpenChange={(open) => !open && setEditingType(null)}>
        <SheetContent side="right" className="sm:max-w-2xl w-full overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span>{editingDocType?.icon}</span> {editingDocType?.label}
            </SheetTitle>
            <SheetDescription>Edite o conteúdo do modelo. Use as variáveis abaixo para dados dinâmicos.</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Placeholders */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Variáveis Disponíveis</p>
              <div className="space-y-3">
                {PLACEHOLDER_CATEGORIES.map((cat) => (
                  <div key={cat.key}>
                    <p className="text-xs font-semibold text-foreground mb-1">{cat.label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {DOCUMENT_PLACEHOLDERS.filter((p) => p.category === cat.key).map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => handleInsertPlaceholder(p.key)}
                          className="px-2 py-0.5 text-xs rounded-md bg-muted hover:bg-accent border border-border text-foreground transition-colors"
                          title={p.description}
                        >
                          {p.key}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Textarea
              ref={textareaRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[350px] font-mono text-sm"
              placeholder="Conteúdo do modelo..."
            />

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingType(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => editingType && saveMutation.mutate({ type: editingType, content: editContent })}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview Dialog */}
      <Dialog open={!!previewType} onOpenChange={(open) => !open && setPreviewType(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>{previewDocType?.icon}</span> {previewDocType?.label} — Preview
            </DialogTitle>
            <DialogDescription>Visualização com dados fictícios substituídos.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 p-6 bg-card border border-border rounded-lg whitespace-pre-wrap text-sm leading-relaxed font-serif">
            {previewContent}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentTemplatesPage;
