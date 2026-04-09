import { useState } from "react";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Star, Trash2, Radio, Pencil, Check, X, Plus, Wifi } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GupshupInstance {
  id: string;
  instance_name: string;
  name?: string;
  phone_number?: string;
  status: string;
  is_default: boolean;
  provider: string;
}

interface GupshupInstancesListProps {
  // no props needed anymore - add button is centralized
}

const GupshupInstancesList = (_props: GupshupInstancesListProps) => {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const activeProvider = settings.whatsapp_provider || "";

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<GupshupInstance | null>(null);

  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["whatsapp-instances-gupshup", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .eq("provider", "gupshup")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as GupshupInstance[];
    },
    enabled: !!tenant?.id,
  });

  // Count active conversations per instance
  const { data: conversationCounts = {} } = useQuery({
    queryKey: ["conversation-counts-gupshup", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("instance_id")
        .eq("tenant_id", tenant!.id)
        .eq("status", "open");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.instance_id || ""] = (counts[c.instance_id || ""] || 0) + 1;
      });
      return counts;
    },
    enabled: !!tenant?.id,
  });

  const handleStartEdit = (inst: GupshupInstance) => {
    setEditingId(inst.id);
    setEditName(inst.name || inst.instance_name);
  };

  const handleSaveEdit = async (inst: GupshupInstance) => {
    const trimmed = editName.trim();
    if (!trimmed || trimmed === inst.name) {
      setEditingId(null);
      return;
    }
    try {
      await supabase.from("whatsapp_instances").update({ name: trimmed }).eq("id", inst.id);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-gupshup", tenant?.id] });
      toast({ title: "Nome atualizado!" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setEditingId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !tenant) return;
    try {
      await supabase.from("whatsapp_instances").delete().eq("id", deleteTarget.id);
      queryClient.invalidateQueries({ queryKey: ["whatsapp-instances-gupshup", tenant.id] });
      toast({ title: "Instância removida" });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/, "+$1 ($2) $3-$4");
  };

  return (
    <>
      <Card className={activeProvider === "gupshup" ? "ring-2 ring-primary" : ""}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5" />
              WhatsApp Oficial
            </CardTitle>
            <div className="flex items-center gap-2">
              {instances.length > 0 && (
                <Badge variant="secondary" className="text-green-700 bg-green-100">
                  {instances.length} instância{instances.length > 1 ? "s" : ""}
                </Badge>
              )}
              {activeProvider === "gupshup" && (
                <Badge><Radio className="w-3 h-3 mr-1" />Ativo</Badge>
              )}
            </div>
          </div>
          <CardDescription>API oficial do WhatsApp Business via Gupshup</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : instances.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma instância oficial configurada
            </p>
          ) : (
            <div className="space-y-2">
              {instances.map((inst) => (
                <div key={inst.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {editingId === inst.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit(inst);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="h-7 text-sm w-40"
                            autoFocus
                          />
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleSaveEdit(inst)}>
                            <Check className="w-3.5 h-3.5 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingId(null)}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="font-medium text-sm truncate cursor-pointer hover:underline"
                          onDoubleClick={() => handleStartEdit(inst)}
                          title="Clique duplo para editar"
                        >
                          {inst.name || inst.instance_name}
                        </span>
                      )}
                      {inst.is_default && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Star className="w-3 h-3 fill-current" />Padrão
                        </Badge>
                      )}
                      <Badge className="bg-green-100 text-green-700 text-xs gap-1">
                        <Wifi className="w-3 h-3" />Conectado
                      </Badge>
                      {(conversationCounts[inst.id] || 0) > 0 && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          💬 {conversationCounts[inst.id]} ativa{conversationCounts[inst.id] > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {inst.phone_number ? `📱 ${formatPhone(inst.phone_number)}` : inst.instance_name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleStartEdit(inst)}
                      title="Editar nome"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget(inst)}
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância oficial?</AlertDialogTitle>
            <AlertDialogDescription>
              A instância <strong>"{deleteTarget?.name || deleteTarget?.instance_name}"</strong> será removida. As configurações de API Key e App Name serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default GupshupInstancesList;
