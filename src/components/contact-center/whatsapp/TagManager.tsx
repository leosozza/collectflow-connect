import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { toast } from "sonner";

interface ConversationTag {
  id: string;
  name: string;
  color: string;
  tenant_id: string;
}

interface TagManagerProps {
  conversationId: string;
  assignedTags: ConversationTag[];
  onTagsChanged: () => void;
}

const TAG_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

const TagManager = ({ conversationId, assignedTags, onTagsChanged }: TagManagerProps) => {
  const { tenant } = useTenant();
  const tenantId = tenant?.id;
  const [allTags, setAllTags] = useState<ConversationTag[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    supabase
      .from("conversation_tags" as any)
      .select("*")
      .eq("tenant_id", tenantId)
      .then(({ data }) => {
        setAllTags((data || []) as unknown as ConversationTag[]);
      });
  }, [tenantId, open]);

  const handleCreateTag = async () => {
    if (!newTagName.trim() || !tenantId) return;
    const { error } = await supabase
      .from("conversation_tags" as any)
      .insert({ name: newTagName.trim(), color: newTagColor, tenant_id: tenantId } as any);
    if (error) {
      toast.error("Erro ao criar etiqueta");
      return;
    }
    setNewTagName("");
    // Refresh
    const { data } = await supabase
      .from("conversation_tags" as any)
      .select("*")
      .eq("tenant_id", tenantId);
    setAllTags((data || []) as unknown as ConversationTag[]);
  };

  const handleAssignTag = async (tagId: string) => {
    const { error } = await supabase
      .from("conversation_tag_assignments" as any)
      .insert({ conversation_id: conversationId, tag_id: tagId } as any);
    if (error && !error.message.includes("duplicate")) {
      toast.error("Erro ao atribuir etiqueta");
      return;
    }
    onTagsChanged();
  };

  const handleRemoveTag = async (tagId: string) => {
    await supabase
      .from("conversation_tag_assignments" as any)
      .delete()
      .eq("conversation_id", conversationId)
      .eq("tag_id", tagId);
    onTagsChanged();
  };

  const assignedIds = new Set(assignedTags.map((t) => t.id));
  const availableTags = allTags.filter((t) => !assignedIds.has(t.id));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1 flex-wrap">
        {assignedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="outline"
            className="text-[10px] gap-0.5 pr-1"
            style={{ borderColor: tag.color, color: tag.color }}
          >
            {tag.name}
            <button onClick={() => handleRemoveTag(tag.id)} className="ml-0.5 hover:opacity-70">
              <X className="w-2.5 h-2.5" />
            </button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Plus className="w-3 h-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[220px] p-2" side="bottom" align="start">
            {/* Available tags */}
            {availableTags.length > 0 && (
              <div className="space-y-1 mb-2">
                <div className="text-[10px] font-medium text-muted-foreground">Etiquetas</div>
                {availableTags.map((tag) => (
                  <button
                    key={tag.id}
                    onClick={() => handleAssignTag(tag.id)}
                    className="w-full flex items-center gap-1.5 p-1 rounded text-xs hover:bg-accent transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            )}
            {/* Create new tag */}
            <div className="border-t border-border pt-2 space-y-1.5">
              <div className="text-[10px] font-medium text-muted-foreground">Nova etiqueta</div>
              <Input
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Nome..."
                className="h-7 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
              />
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setNewTagColor(c)}
                    className={`w-4 h-4 rounded-full border-2 transition-all ${newTagColor === c ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <Button size="sm" className="w-full h-7 text-xs" onClick={handleCreateTag} disabled={!newTagName.trim()}>
                Criar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default TagManager;
