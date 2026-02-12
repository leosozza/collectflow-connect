import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, Download, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  cpf: string;
}

const ClientAttachments = ({ cpf }: Props) => {
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["client-attachments", cpf],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_attachments" as any)
        .select("*")
        .eq("client_cpf", cpf)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!cpf,
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: any) => {
      // Delete from storage
      await supabase.storage.from("client-attachments").remove([attachment.file_path]);
      // Delete metadata
      const { error } = await supabase
        .from("client_attachments" as any)
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-attachments", cpf] });
      toast.success("Arquivo excluído!");
    },
    onError: () => toast.error("Erro ao excluir arquivo"),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !tenant || !profile) return;

    setUploading(true);
    try {
      const filePath = `${tenant.id}/${cpf}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("client-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase
        .from("client_attachments" as any)
        .insert({
          tenant_id: tenant.id,
          client_cpf: cpf,
          file_name: file.name,
          file_path: filePath,
          uploaded_by: profile.user_id,
        });
      if (insertError) throw insertError;

      queryClient.invalidateQueries({ queryKey: ["client-attachments", cpf] });
      toast.success("Arquivo enviado!");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = (attachment: any) => {
    const { data } = supabase.storage
      .from("client-attachments")
      .getPublicUrl(attachment.file_path);
    window.open(data.publicUrl, "_blank");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Anexos</h3>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Enviando..." : "Enviar Arquivo"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum anexo encontrado</p>
        ) : (
          <div className="space-y-2">
            {attachments.map((att: any) => (
              <div
                key={att.id}
                className="flex items-center justify-between border border-border rounded-lg p-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{att.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(att.created_at).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDownload(att)}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteMutation.mutate(att)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientAttachments;
