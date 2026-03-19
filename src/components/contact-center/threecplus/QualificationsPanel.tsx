import { useState, useCallback } from "react";
import { useTenant } from "@/hooks/useTenant";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, RefreshCw, Trash2, Pencil, Tag, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const QualificationsPanel = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const settings = (tenant?.settings as Record<string, any>) || {};
  const domain = settings.threecplus_domain || "";
  const apiToken = settings.threecplus_api_token || "";

  const [expandedList, setExpandedList] = useState<number | null>(null);
  const [listItems, setListItems] = useState<Record<number, any[]>>({});
  const [loadingItems, setLoadingItems] = useState<number | null>(null);

  // List dialog
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [editingList, setEditingList] = useState<any>(null);
  const [listName, setListName] = useState("");
  const [savingList, setSavingList] = useState(false);
  const [deletingList, setDeletingList] = useState<number | null>(null);

  // Item dialog
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemListId, setItemListId] = useState<number | null>(null);
  const [itemName, setItemName] = useState("");
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<number | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error } = await supabase.functions.invoke("threecplus-proxy", {
      body: { action, domain, api_token: apiToken, ...extra },
    });
    if (error) throw error;
    return data;
  }, [domain, apiToken]);

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["3cp-qualification-lists", domain],
    queryFn: async () => {
      const data = await invoke("list_qualification_lists");
      return Array.isArray(data) ? data : data?.data || [];
    },
    enabled: !!domain && !!apiToken,
  });

  const fetchItems = useCallback(async (listId: number) => {
    setLoadingItems(listId);
    try {
      const data = await invoke("list_qualification_list_items", { list_id: listId });
      const items = Array.isArray(data) ? data : data?.data || [];
      setListItems(prev => ({ ...prev, [listId]: items }));
    } catch {
      toast.error("Erro ao carregar qualificações");
    } finally {
      setLoadingItems(null);
    }
  }, [invoke]);

  const toggleList = (listId: number) => {
    if (expandedList === listId) {
      setExpandedList(null);
    } else {
      setExpandedList(listId);
      if (!listItems[listId]) fetchItems(listId);
    }
  };

  // List CRUD
  const handleSaveList = async () => {
    if (!listName.trim()) { toast.error("Nome é obrigatório"); return; }
    setSavingList(true);
    try {
      if (editingList) {
        await invoke("update_qualification_list", { list_id: editingList.id, name: listName.trim() });
        toast.success("Lista atualizada");
      } else {
        await invoke("create_qualification_list", { name: listName.trim() });
        toast.success("Lista criada");
      }
      setListDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["3cp-qualification-lists"] });
    } catch {
      toast.error("Erro ao salvar lista");
    } finally {
      setSavingList(false);
    }
  };

  const handleDeleteList = async (listId: number) => {
    setDeletingList(listId);
    try {
      await invoke("delete_qualification_list", { list_id: listId });
      toast.success("Lista excluída");
      queryClient.invalidateQueries({ queryKey: ["3cp-qualification-lists"] });
    } catch {
      toast.error("Erro ao excluir lista");
    } finally {
      setDeletingList(null);
    }
  };

  // Item CRUD
  const handleSaveItem = async () => {
    if (!itemName.trim() || !itemListId) { toast.error("Nome é obrigatório"); return; }
    setSavingItem(true);
    try {
      if (editingItem) {
        await invoke("update_qualification_list_item", { list_id: itemListId, item_id: editingItem.id, name: itemName.trim() });
        toast.success("Qualificação atualizada");
      } else {
        await invoke("create_qualification_list_item", { list_id: itemListId, name: itemName.trim() });
        toast.success("Qualificação criada");
      }
      setItemDialogOpen(false);
      fetchItems(itemListId);
    } catch {
      toast.error("Erro ao salvar qualificação");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (listId: number, itemId: number) => {
    setDeletingItem(itemId);
    try {
      await invoke("delete_qualification_list_item", { list_id: listId, item_id: itemId });
      toast.success("Qualificação removida");
      fetchItems(listId);
    } catch {
      toast.error("Erro ao remover qualificação");
    } finally {
      setDeletingItem(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Listas de Qualificação</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["3cp-qualification-lists"] })} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Atualizar
          </Button>
          <Button size="sm" onClick={() => { setEditingList(null); setListName(""); setListDialogOpen(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Lista
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : lists.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Nenhuma lista de qualificação encontrada</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {lists.map((l: any) => (
            <Card key={l.id}>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => toggleList(l.id)}>
                <div className="flex items-center gap-3">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">ID: {l.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingList(l); setListName(l.name || ""); setListDialogOpen(true); }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteList(l.id); }} disabled={deletingList === l.id}>
                    {deletingList === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                  {expandedList === l.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>

              {expandedList === l.id && (
                <CardContent className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Qualificações</p>
                    <Button size="sm" variant="outline" onClick={() => { setEditingItem(null); setItemListId(l.id); setItemName(""); setItemDialogOpen(true); }} className="gap-1.5 h-7 text-xs">
                      <Plus className="w-3 h-3" /> Nova Qualificação
                    </Button>
                  </div>
                  {loadingItems === l.id ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2"><Loader2 className="w-4 h-4 animate-spin" /> Carregando...</div>
                  ) : (listItems[l.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">Nenhuma qualificação</p>
                  ) : (
                    (listItems[l.id] || []).map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm">
                        <span className="font-medium">{item.name || `Qualificação ${item.id}`}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingItem(item); setItemListId(l.id); setItemName(item.name || ""); setItemDialogOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteItem(l.id, item.id)} disabled={deletingItem === item.id}>
                            {deletingItem === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* List Dialog */}
      <Dialog open={listDialogOpen} onOpenChange={setListDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingList ? "Editar Lista" : "Nova Lista de Qualificação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome</Label>
            <Input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Ex: Qualificações Cobrança" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveList} disabled={savingList} className="gap-2">
              {savingList && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingList ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingItem ? "Editar Qualificação" : "Nova Qualificação"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Nome</Label>
            <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Ex: Acordo Realizado" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveItem} disabled={savingItem} className="gap-2">
              {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingItem ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QualificationsPanel;
