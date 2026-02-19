import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Headset, ChevronDown, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCPF, formatCurrency, formatPhone } from "@/lib/formatters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenant } from "@/hooks/useTenant";
import { fetchTiposDevedor } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";

interface ClientDetailHeaderProps {
  client: any;
  clients: any[];
  cpf: string;
  totalAberto: number;
  onFormalizarAcordo: () => void;
}

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const ClientDetailHeader = ({ client, clients, cpf, totalAberto, onFormalizarAcordo }: ClientDetailHeaderProps) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenant } = useTenant();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nome_completo: client.nome_completo || "",
    phone: client.phone || "",
    email: client.email || "",
    endereco: client.endereco || "",
    cidade: client.cidade || "",
    uf: client.uf || "",
    cep: client.cep || "",
    observacoes: client.observacoes || "",
    external_id: client.external_id || "",
  });
  const formattedCpf = formatCPF(cpf || "");

  const { data: tiposDevedor = [] } = useQuery({
    queryKey: ["tipos_devedor", tenant?.id],
    queryFn: () => fetchTiposDevedor(tenant!.id),
    enabled: !!tenant?.id,
  });

  const updatePerfilMutation = useMutation({
    mutationFn: async (tipoDevedorId: string | null) => {
      const clientIds = clients.map(c => c.id);
      for (const id of clientIds) {
        const { error } = await supabase.from("clients").update({ tipo_devedor_id: tipoDevedorId } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Perfil do devedor atualizado!");
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const updateClientMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const clientIds = clients.map(c => c.id);
      for (const id of clientIds) {
        const { error } = await supabase.from("clients").update({
          nome_completo: data.nome_completo,
          phone: data.phone || null,
          email: data.email || null,
          endereco: data.endereco || null,
          cidade: data.cidade || null,
          uf: data.uf || null,
          cep: data.cep || null,
          observacoes: data.observacoes || null,
          external_id: data.external_id || null,
        } as any).eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Dados do devedor atualizados!");
      setEditOpen(false);
    },
    onError: () => toast.error("Erro ao salvar dados"),
  });

  const openWhatsApp = () => {
    if (!client.phone) {
      toast.error("Nenhum telefone cadastrado para este devedor");
      return;
    }
    const phone = client.phone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${intlPhone}`, "_blank");
  };

  const totalPago = clients.reduce((sum, c) => sum + Number(c.valor_pago), 0);
  const pagas = clients.filter((c) => c.status === "pago").length;
  const endereco = [client.endereco, client.cidade, client.uf, client.cep].filter(Boolean).join(", ");

  return (
    <>
      <Card className="p-4">
        {/* Linha 1: Nome + Ações */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/carteira")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground flex-1">{client.nome_completo}</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-600"
              onClick={openWhatsApp}
              title="WhatsApp"
            >
              <WhatsAppIcon className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-600"
              onClick={() => navigate(`/atendimento/${client.id}`)}
              title="Atendimento"
            >
              <Headset className="w-5 h-5" />
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
            <Button onClick={onFormalizarAcordo} className="gap-2">
              <FileText className="w-4 h-4" />
              Formalizar Acordo
            </Button>
          </div>
        </div>

        {/* Linha 2: Metadados */}
        <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap pl-12 mt-2">
          <span><strong>CPF:</strong> {formattedCpf}</span>
          <span className="text-border">|</span>
          <span><strong>Tel:</strong> {client.phone ? formatPhone(client.phone) : "—"}</span>
          <span className="text-border">|</span>
          <span><strong>Email:</strong> {client.email || "—"}</span>
          <span className="text-border">|</span>
          <span><strong>Credor:</strong> {client.credor}</span>
          <span className="text-border">|</span>
          <span><strong>Em Aberto:</strong> <span className="text-destructive font-semibold">{formatCurrency(totalAberto)}</span></span>
        </div>

        {/* Linha 3: Colapsável */}
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger className="flex items-center justify-between w-full px-12 py-2 mt-2 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-muted/50">
            <span>Mais informações do devedor</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", open && "rotate-180")} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-12 pt-3 pb-1 border-t border-border mt-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Cod. Devedor</p>
                  <p className="text-sm font-semibold text-foreground">{client.external_id || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Total Pago</p>
                  <p className="text-sm font-semibold text-success">{formatCurrency(totalPago)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Parcelas</p>
                  <p className="text-sm font-semibold text-foreground">{pagas}/{clients.length}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Endereço</p>
                  <p className="text-sm text-foreground">{endereco || "—"}</p>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Perfil do Devedor</p>
                  <Select
                    value={client.tipo_devedor_id || "none"}
                    onValueChange={(v) => updatePerfilMutation.mutate(v === "none" ? null : v)}
                  >
                    <SelectTrigger className="h-8 text-sm w-48">
                      <SelectValue placeholder="Selecionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {tiposDevedor.map((t: any) => (
                        <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {client.observacoes && (
                <div className="mt-4 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">Observações</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{client.observacoes}</p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Sheet de Edição */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar Dados do Devedor</SheetTitle>
          </SheetHeader>
          <div className="grid gap-4 py-6">
            <div className="grid gap-2">
              <Label htmlFor="nome_completo">Nome Completo</Label>
              <Input
                id="nome_completo"
                value={editForm.nome_completo}
                onChange={e => setEditForm(f => ({ ...f, nome_completo: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="external_id">Cód. Devedor (ID Externo)</Label>
              <Input
                id="external_id"
                value={editForm.external_id}
                onChange={e => setEditForm(f => ({ ...f, external_id: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={editForm.endereco}
                onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 grid gap-2">
                <Label htmlFor="cidade">Cidade</Label>
                <Input
                  id="cidade"
                  value={editForm.cidade}
                  onChange={e => setEditForm(f => ({ ...f, cidade: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="uf">UF</Label>
                <Input
                  id="uf"
                  value={editForm.uf}
                  onChange={e => setEditForm(f => ({ ...f, uf: e.target.value }))}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cep">CEP</Label>
              <Input
                id="cep"
                value={editForm.cep}
                onChange={e => setEditForm(f => ({ ...f, cep: e.target.value }))}
                placeholder="00000-000"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                value={editForm.observacoes}
                onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={4}
                placeholder="Anotações sobre o devedor..."
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => updateClientMutation.mutate(editForm)}
              disabled={updateClientMutation.isPending}
            >
              {updateClientMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default ClientDetailHeader;

