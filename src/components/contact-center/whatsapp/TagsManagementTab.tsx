import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tag, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

interface ConversationTag {
  id: string;
  name: string;
  color: string;
  tenant_id: string;
}

const TagsManagementTab = () => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [tags, setTags] = useState<ConversationTag[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(TAG_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const loadTags = async () => {
    if (!tenantId) return;
    const { data } = await supabase
      .from("conversation_tags" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .order("name");
    setTags((data || []) as unknown as ConversationTag[]);
  };

  useEffect(() => { loadTags(); }, [tenantId]);

  const handleCreate = async () => {
    if (!newName.trim() || !tenantId) return;
    const { error } = await supabase
      .from("conversation_tags" as any)
      .insert({ name: newName.trim(), color: newColor, tenant_id: tenantId } as any);
    if (error) { toast.error("Erro ao criar etiqueta"); return; }
    toast.success("Etiqueta criada!");
    setNewName("");
    loadTags();
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from("conversation_tags" as any)
      .update({ name: editName.trim(), color: editColor } as any)
      .eq("id", id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    toast.success("Etiqueta atualizada!");
    setEditingId(null);
    loadTags();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("conversation_tags" as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Etiqueta excluída!");
    loadTags();
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Tag className="w-5 h-5" /> Gerenciar Etiquetas
      </h2>

      {/* Create form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Nova Etiqueta</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da etiqueta"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
            </div>
            <div className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${newColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <Button onClick={handleCreate} disabled={!newName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Criar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tags table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cor</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell>
                    {editingId === tag.id ? (
                      <div className="flex gap-1">
                        {TAG_COLORS.map((c) => (
                          <button
                            key={c}
                            onClick={() => setEditColor(c)}
                            className={`w-5 h-5 rounded-full border-2 ${editColor === c ? "border-foreground" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                    ) : (
                      <span className="w-5 h-5 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-8"
                        onKeyDown={(e) => e.key === "Enter" && handleUpdate(tag.id)}
                      />
                    ) : (
                      <Badge variant="outline" style={{ borderColor: tag.color, color: tag.color }}>
                        {tag.name}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === tag.id ? (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdate(tag.id)}>
                          <Check className="w-4 h-4 text-green-500" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="icon" variant="ghost" className="h-7 w-7"
                          onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color); }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(tag.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {tags.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhuma etiqueta criada
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

export default TagsManagementTab;
