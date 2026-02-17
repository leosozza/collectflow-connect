import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageSquare, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface QuickReply {
  id: string;
  shortcut: string;
  content: string;
  category: string;
  tenant_id: string;
}

const QuickRepliesTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ shortcut: "", content: "", category: "geral" });

  const loadReplies = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("quick_replies" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("shortcut");
    setReplies((data || []) as unknown as QuickReply[]);
  };

  useEffect(() => { loadReplies(); }, [tenantId]);

  const resetForm = () => {
    setForm({ shortcut: "", content: "", category: "geral" });
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.shortcut.trim() || !form.content.trim() || !tenantId) return;
    const payload = {
      shortcut: form.shortcut.startsWith("/") ? form.shortcut : `/${form.shortcut}`,
      content: form.content,
      category: form.category || "geral",
      tenant_id: tenantId,
    };

    if (editingId) {
      const { error } = await supabase
        .from("quick_replies" as any)
        .update(payload as any)
        .eq("id", editingId);
      if (error) { toast.error("Erro ao atualizar"); return; }
      toast.success("Resposta atualizada!");
    } else {
      const { error } = await supabase
        .from("quick_replies" as any)
        .insert(payload as any);
      if (error) { toast.error("Erro ao criar"); return; }
      toast.success("Resposta criada!");
    }
    resetForm();
    loadReplies();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("quick_replies" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Resposta excluída!");
    loadReplies();
  };

  const startEdit = (r: QuickReply) => {
    setEditingId(r.id);
    setForm({ shortcut: r.shortcut, content: r.content, category: r.category });
    setShowForm(true);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Respostas Rápidas
        </h2>
        {!showForm && (
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Nova Resposta
          </Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{editingId ? "Editar" : "Nova"} Resposta Rápida</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Atalho</Label>
                <Input
                  value={form.shortcut}
                  onChange={(e) => setForm({ ...form, shortcut: e.target.value })}
                  placeholder="/saudacao"
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="geral"
                />
              </div>
            </div>
            <div>
              <Label>Conteúdo da mensagem</Label>
              <Textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="Olá! Como posso ajudá-lo hoje?"
                className="min-h-[100px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={!form.shortcut.trim() || !form.content.trim()}>
                <Check className="w-4 h-4 mr-1" /> {editingId ? "Atualizar" : "Criar"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                <X className="w-4 h-4 mr-1" /> Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atalho</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {replies.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm">{r.shortcut}</TableCell>
                  <TableCell className="text-sm">{r.category}</TableCell>
                  <TableCell className="text-sm max-w-[300px] truncate">{r.content}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {replies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    Nenhuma resposta rápida criada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickRepliesTab;
