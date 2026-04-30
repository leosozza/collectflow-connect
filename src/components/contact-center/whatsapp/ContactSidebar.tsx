import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Link2, Unlink, Search, FileText, Bot, Loader2 } from "lucide-react";
import { Conversation, ChatMessage, linkClientToConversation } from "@/services/conversationService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import DispositionSelector from "./DispositionSelector";
import AISummaryPanel from "./AISummaryPanel";
import DebtorProfileBadge from "@/components/shared/DebtorProfileBadge";

interface ContactSidebarProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  onClientLinked: () => void;
  onDispositionAssignmentsChanged?: (
    conversationId: string,
    assignedDispositionTypeIds: string[]
  ) => void;
  onDebtorProfileChanged?: (clientId: string, profile: string | null) => void;
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
  status_cobranca_id: string | null;
  debtor_profile: string | null;
}


const ContactSidebar = ({ conversation, messages, onClientLinked }: ContactSidebarProps) => {
  const navigate = useNavigate();
  const { isTenantAdmin } = useTenant();
  const [linkedClient, setLinkedClient] = useState<SimpleClient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SimpleClient[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [statusCobranca, setStatusCobranca] = useState<{ nome: string; cor: string } | null>(null);
  const [saldoDevedor, setSaldoDevedor] = useState<number>(0);
  const [aiLinking, setAiLinking] = useState(false);
  const [aiCandidates, setAiCandidates] = useState<SimpleClient[]>([]);
  const [showAiResults, setShowAiResults] = useState(false);

  // Fetch linked client
  useEffect(() => {
    if (!conversation?.client_id) {
      setLinkedClient(null);
      setSaldoDevedor(0);
      return;
    }
    supabase
      .from("clients")
      .select("id, nome_completo, cpf, phone, status, credor, valor_parcela, numero_parcela, total_parcelas, status_cobranca_id, debtor_profile")
      .eq("id", conversation.client_id)
      .maybeSingle()
      .then(({ data }) => {
        const client = data as SimpleClient | null;
        setLinkedClient(client);
        if (client?.status_cobranca_id) {
          supabase
            .from("tipos_status")
            .select("nome, cor")
            .eq("id", client.status_cobranca_id)
            .maybeSingle()
            .then(({ data: statusData }) => {
              setStatusCobranca(statusData as { nome: string; cor: string } | null);
            });
        } else {
          setStatusCobranca(null);
        }

        // Compute Saldo Devedor: sum of pending installments for this CPF+Credor
        if (client?.cpf && client?.credor && conversation.tenant_id) {
          supabase
            .from("clients")
            .select("status, valor_saldo, valor_parcela, valor_pago, data_devolucao")
            .eq("tenant_id", conversation.tenant_id)
            .eq("cpf", client.cpf)
            .eq("credor", client.credor)
            .then(({ data: rows }) => {
              const list = (rows as any[]) || [];
              const naoPagos = list.filter((c) => c.status !== "pago" || !!c.data_devolucao);
              const total = naoPagos.reduce((sum, c) => {
                const isDevolvido = !!c.data_devolucao;
                const valorBase = Number(c.valor_saldo) || Number(c.valor_parcela) || 0;
                const pago = isDevolvido ? 0 : Number(c.valor_pago) || 0;
                return sum + Math.max(0, valorBase - pago);
              }, 0);
              setSaldoDevedor(total);
            });
        } else {
          setSaldoDevedor(0);
        }
      });
  }, [conversation?.client_id, conversation?.tenant_id]);


  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const { data } = await supabase
      .from("clients")
      .select("id, nome_completo, cpf, phone, status, credor, valor_parcela, numero_parcela, total_parcelas, status_cobranca_id")
      .or(`nome_completo.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,phone2.ilike.%${searchTerm}%,phone3.ilike.%${searchTerm}%`)
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
      setShowAiResults(false);
      setAiCandidates([]);
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

  const handleAiLink = async () => {
    if (!conversation || messages.length === 0) return;
    setAiLinking(true);
    setShowAiResults(false);
    setAiCandidates([]);

    try {
      const chatMessages = messages.slice(-30).map((m) => ({
        direction: m.direction,
        content: m.content,
      }));

      const { data, error } = await supabase.functions.invoke("chat-ai-suggest", {
        body: { action: "extract_cpf", messages: chatMessages },
      });

      if (error) throw error;

      const cpfs: string[] = (data?.cpfs || []).map((c: string) => c.replace(/\D/g, ""));
      const names: string[] = data?.names || [];

      if (cpfs.length === 0 && names.length === 0) {
        toast.info("Nenhum CPF ou nome encontrado na conversa");
        setAiLinking(false);
        return;
      }

      // Search by extracted CPFs and names
      const orFilters: string[] = [];
      for (const cpf of cpfs) {
        if (cpf.length >= 11) {
          orFilters.push(`cpf.ilike.%${cpf.slice(-11)}%`);
        }
      }
      for (const name of names) {
        if (name.trim()) {
          orFilters.push(`nome_completo.ilike.%${name.trim()}%`);
        }
      }

      if (orFilters.length === 0) {
        toast.info("Nenhum dado válido extraído pela IA");
        setAiLinking(false);
        return;
      }

      const { data: candidates } = await supabase
        .from("clients")
        .select("id, nome_completo, cpf, phone, status, credor, valor_parcela, numero_parcela, total_parcelas, status_cobranca_id")
        .or(orFilters.join(","))
        .limit(5);

      const found = (candidates as SimpleClient[] | null) || [];
      if (found.length === 0) {
        toast.info("Nenhum cliente encontrado com os dados extraídos");
      } else if (found.length === 1) {
        // Auto-link if single match
        await handleLink(found[0].id);
        toast.success(`Cliente "${found[0].nome_completo}" vinculado automaticamente pela IA`);
        setAiLinking(false);
        return;
      } else {
        setAiCandidates(found);
        setShowAiResults(true);
      }
    } catch (err: any) {
      console.error("AI link error:", err);
      toast.error("Erro ao buscar via IA");
    } finally {
      setAiLinking(false);
    }
  };

  // Auto-assign "Em Dia" or "Quitado" disposition based on collection status
  useEffect(() => {
    if (!conversation || !linkedClient?.status_cobranca_id || !statusCobranca) return;
    const statusName = statusCobranca.nome?.toLowerCase() || "";
    let targetKey: string | null = null;
    if (statusName.includes("em dia")) targetKey = "em_dia";
    else if (statusName.includes("quitado")) targetKey = "quitado";
    if (!targetKey) return;

    const autoAssign = async () => {
      try {
        // Block auto-assign of "em_dia" if client already has an agreement in Rivo
        if (targetKey === "em_dia" && linkedClient?.cpf) {
          const cpfDigits = linkedClient.cpf.replace(/\D/g, "");
          const { data: existingAgreement } = await supabase
            .from("agreements")
            .select("id")
            .eq("tenant_id", conversation.tenant_id!)
            .eq("client_cpf", cpfDigits)
            .limit(1)
            .maybeSingle();
          if (existingAgreement) return;
        }

        const { data: dispType } = await supabase
          .from("call_disposition_types")
          .select("id")
          .eq("tenant_id", conversation.tenant_id)
          .eq("channel", "whatsapp")
          .eq("key", targetKey!)
          .eq("active", true)
          .maybeSingle();
        if (!dispType) return;

        const { data: existing } = await supabase
          .from("conversation_disposition_assignments" as any)
          .select("id")
          .eq("conversation_id", conversation.id)
          .eq("disposition_type_id", dispType.id)
          .maybeSingle();
        if (existing) return;

        await supabase
          .from("conversation_disposition_assignments" as any)
          .insert({
            conversation_id: conversation.id,
            disposition_type_id: dispType.id,
          } as any);
      } catch (err) {
        console.error("Auto-assign disposition error:", err);
      }
    };
    autoAssign();
  }, [conversation?.id, linkedClient?.status_cobranca_id, linkedClient?.cpf, statusCobranca]);

  if (!conversation) return null;

  const statusLabels: Record<string, string> = {
    pendente: "Pendente",
    pago: "Pago",
    quebrado: "Quebrado",
  };

  return (
    <div className="w-[340px] border-l border-border bg-card flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b border-border">
        <h3 className="font-semibold text-sm">Contato</h3>
      </div>
      <ScrollArea className="flex-1 p-3 overflow-x-hidden">
        {/* Linked client (movido para o topo) */}
        {linkedClient && (
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
              <div className="text-sm font-medium break-words">{linkedClient.nome_completo}</div>
              <div className="text-xs text-muted-foreground break-all">CPF: {linkedClient.cpf}</div>
              <div className="text-xs text-muted-foreground break-words">Credor: {linkedClient.credor}</div>
              <div className="text-xs break-words">
                <span className="text-muted-foreground">Saldo Devedor:</span>{" "}
                <span className="font-semibold text-destructive">
                  R$ {saldoDevedor.toFixed(2)}
                </span>
              </div>
              {statusCobranca && (
                <div className="flex items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-muted-foreground">Status Cliente:</span>
                  <Badge
                    className="text-[10px]"
                    style={{ backgroundColor: statusCobranca.cor, color: "#fff", border: "none" }}
                  >
                    {statusCobranca.nome}
                  </Badge>
                </div>
              )}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full text-xs mt-2"
              >
                <a
                  href={`/carteira/${linkedClient.cpf.replace(/\D/g, "")}`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    navigate(`/carteira/${linkedClient.cpf.replace(/\D/g, "")}`);
                  }}
                >
                  <User className="w-3 h-3 mr-1" />
                  Abrir Perfil do Cliente
                </a>
              </Button>
              <Button
                asChild
                size="sm"
                className="w-full text-xs mt-1 bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
              >
                <a
                  href={`/carteira/${linkedClient.cpf.replace(/\D/g, "")}?action=formalizar`}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                    e.preventDefault();
                    navigate(`/carteira/${linkedClient.cpf.replace(/\D/g, "")}?action=formalizar`);
                  }}
                >
                  <FileText className="w-3 h-3 mr-1" />
                  Formalizar Acordo
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Perfil do Devedor */}
        {linkedClient && conversation && (
          <div className="mb-3 rounded-md transition-shadow" data-gate-anchor="debtor-profile">
            <DebtorProfileBadge
              clientId={linkedClient.id}
              clientCpf={linkedClient.cpf}
              tenantId={conversation.tenant_id || ""}
              currentProfile={linkedClient.debtor_profile}
              onProfileChanged={(p) => setLinkedClient((prev) => prev ? { ...prev, debtor_profile: p } : prev)}
            />
          </div>
        )}

        {/* Tabulação WhatsApp */}
        {conversation && (
          <div data-gate-anchor="disposition" className="rounded-md transition-shadow">
            <DispositionSelector
              conversationId={conversation.id}
              tenantId={conversation.tenant_id || ""}
              clientCpf={linkedClient?.cpf || null}
            />
          </div>
        )}

        {/* Vincular cliente (somente quando não vinculado) */}
        {!linkedClient && (
          <Card className="mb-3 border-dashed">
            <CardHeader className="p-3 pb-1">
              <CardTitle className="text-xs text-muted-foreground">Nenhum cliente vinculado</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-1">
              <p className="text-[11px] text-muted-foreground mb-2">
                Vincule um cliente para formalizar acordos e ver informações detalhadas.
              </p>

              {/* AI Link results */}
              {showAiResults && aiCandidates.length > 0 && (
                <div className="space-y-2 mb-2">
                  <p className="text-[11px] font-medium text-primary">Candidatos encontrados pela IA:</p>
                  {aiCandidates.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleLink(c.id)}
                      className="w-full text-left p-2 rounded border border-primary/30 hover:bg-accent/30 text-xs"
                    >
                      <div className="font-medium">{c.nome_completo}</div>
                      <div className="text-muted-foreground">CPF: {c.cpf}</div>
                      <div className="text-muted-foreground">Credor: {c.credor}</div>
                    </button>
                  ))}
                  <Button variant="ghost" size="sm" className="text-xs w-full" onClick={() => { setShowAiResults(false); setAiCandidates([]); }}>
                    Cancelar
                  </Button>
                </div>
              )}

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
              ) : !showAiResults && (
                <div className="space-y-2">
                  {messages.length > 0 && (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full text-xs"
                      onClick={handleAiLink}
                      disabled={aiLinking}
                    >
                      {aiLinking ? (
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      ) : (
                        <Bot className="w-3 h-3 mr-1" />
                      )}
                      {aiLinking ? "Analisando..." : "Vincular por IA"}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs"
                    onClick={() => setShowSearch(true)}
                  >
                    <Link2 className="w-3 h-3 mr-1" />
                    Busca Manual
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* AI Summary & Classification */}
        {messages.length > 0 && (
          <AISummaryPanel
            messages={messages}
            clientInfo={linkedClient}
          />
        )}
      </ScrollArea>
    </div>
  );
};

export default ContactSidebar;
