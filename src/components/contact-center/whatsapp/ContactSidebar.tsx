import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Link2, Unlink, Search, Tag } from "lucide-react";
import { Conversation, linkClientToConversation } from "@/services/conversationService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import TagManager from "./TagManager";

interface ContactSidebarProps {
  conversation: Conversation | null;
  onClientLinked: () => void;
}

interface SimpleClient {
  id: string;
  nome_completo: string;
  cpf: string;
  phone: string | null;
  status: string;
  credor: string;
  valor_parcela: number;
  numero_parcela: number;
  total_parcelas: number;
}

interface ConversationTag {
  id: string;
  name: string;
  color: string;
  tenant_id: string;
}

const ContactSidebar = ({ conversation, onClientLinked }: ContactSidebarProps) => {
  const [linkedClient, setLinkedClient] = useState<SimpleClient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [assignedTags, setAssignedTags] = useState<ConversationTag[]>([]);

  // Fetch linked client
  useEffect(() => {
    if (!conversation?.client_id) {
      setLinkedClient(null);
      return;
    }
    supabase
      .from("clients")
      .select("id, nome_completo, cpf, phone, status, credor, valor_parcela, numero_parcela, total_parcelas")
      .eq("id", conversation.client_id)
      .maybeSingle()
      .then(({ data }) => {
        setLinkedClient(data as SimpleClient | null);
      });
  }, [conversation?.client_id]);

  // Fetch assigned tags
  const loadTags = async () => {
    if (!conversation) {
      setAssignedTags([]);
      return;
    }
    const { data } = await supabase
      .from("conversation_tag_assignments" as any)
      .select("tag_id")
      .eq("conversation_id", conversation.id);

    if (!data || data.length === 0) {
      setAssignedTags([]);
      return;
    }

    const tagIds = (data as any[]).map((d: any) => d.tag_id);
    const { data: tags } = await supabase
      .from("conversation_tags" as any)
      .select("*")
      .in("id", tagIds);

    setAssignedTags((tags || []) as unknown as ConversationTag[]);
  };

  useEffect(() => {
    loadTags();
  }, [conversation?.id]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("clients")
      .select("id, nome_completo, cpf, phone, status, credor, valor_parcela, numero_parcela, total_parcelas")
      .or(`nome_completo.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .limit(5);
    setSearchResults((data as SimpleClient[] | null) || []);
    setSearching(false);
  };

  const handleLink = async (clientId: string) => {
    if (!conversation) return;
    try {
      await linkClientToConversation(conversation.id, clientId);
      toast.success("Cliente vinculado!");
      setShowSearch(false);
      setSearchTerm("");
      setSearchResults([]);
      onClientLinked();
    } catch {
      toast.error("Erro ao vincular cliente");
    }
  };

  const handleUnlink = async () => {
    if (!conversation) return;
    try {
      await linkClientToConversation(conversation.id, null);
      toast.success("Cliente desvinculado");
      setLinkedClient(null);
      onClientLinked();
    } catch {
      toast.error("Erro ao desvincular");
    }
  };

  if (!conversation) return null;

  const statusLabels: Record<string, string> = {
    pendente: "Pendente",
    pago: "Pago",
    quebrado: "Quebrado",
  };

  return (
    <div className="w-[320px] border-l border-border bg-card flex flex-col h-full">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold text-sm">Contato</h3>
      </div>
      <ScrollArea className="flex-1 p-3">
        {/* Contact info */}
        <Card className="mb-3">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                <User className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <div className="font-medium text-sm">{conversation.remote_name || "Sem nome"}</div>
                <div className="text-xs text-muted-foreground">{conversation.remote_phone}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tags */}
        <Card className="mb-3">
          <CardHeader className="p-3 pb-1">
            <CardTitle className="text-xs flex items-center gap-1">
              <Tag className="w-3 h-3" />
              Etiquetas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-1">
            <TagManager
              conversationId={conversation.id}
              assignedTags={assignedTags}
              onTagsChanged={loadTags}
            />
          </CardContent>
        </Card>

        {/* Linked client */}
        {linkedClient ? (
          <Card className="mb-3">
            <CardHeader className="p-3 pb-1">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs">Cliente Vinculado</CardTitle>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleUnlink}>
                  <Unlink className="w-3 h-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-1 space-y-1.5">
              <div className="text-sm font-medium">{linkedClient.nome_completo}</div>
              <div className="text-xs text-muted-foreground">CPF: {linkedClient.cpf}</div>
              <div className="text-xs text-muted-foreground">Credor: {linkedClient.credor}</div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {statusLabels[linkedClient.status] || linkedClient.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Parcela {linkedClient.numero_parcela}/{linkedClient.total_parcelas}
                </span>
              </div>
              <div className="text-xs">
                Valor: R$ {linkedClient.valor_parcela.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-3">
            <CardContent className="p-3">
              {showSearch ? (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    <Input
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Nome, CPF ou telefone..."
                      className="h-8 text-xs"
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                    <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={handleSearch} disabled={searching}>
                      <Search className="w-3 h-3" />
                    </Button>
                  </div>
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleLink(c.id)}
                      className="w-full text-left p-2 rounded border border-border hover:bg-accent/30 text-xs"
                    >
                      <div className="font-medium">{c.nome_completo}</div>
                      <div className="text-muted-foreground">CPF: {c.cpf}</div>
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => setShowSearch(false)}>
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowSearch(true)}
                >
                  <Link2 className="w-3 h-3 mr-1" />
                  Vincular Cliente
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </ScrollArea>
    </div>
  );
};

export default ContactSidebar;
