import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { 
  fetchPaymentMethods, 
  upsertPaymentMethod, 
  deletePaymentMethod,
  fetchPaymentMappings,
  upsertPaymentMapping,
  deletePaymentMapping
} from "@/services/paymentMethodsService";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Link as LinkIcon, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface PaymentMethodsConfigProps {
  credorId?: string;
}

const PaymentMethodsConfig = ({ credorId }: PaymentMethodsConfigProps) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"methods" | "mappings">("methods");
  
  // States for Methods
  const [methodDialogOpen, setMethodDialogOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<any>(null);
  const [methodName, setMethodName] = useState("");
  const [methodDesc, setMethodDesc] = useState("");

  // States for Mappings
  const [mappingDialogOpen, setMappingDialogOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<any>(null);
  const [externalCode, setExternalCode] = useState("");
  const [selectedInternalId, setSelectedInternalId] = useState("");

  // Queries
  const { data: methods = [], isLoading: loadingMethods } = useQuery({
    queryKey: ["payment_methods", tenant?.id, credorId],
    queryFn: () => fetchPaymentMethods(tenant!.id, credorId),
    enabled: !!tenant?.id,
  });

  const { data: mappings = [], isLoading: loadingMappings } = useQuery({
    queryKey: ["payment_mappings", tenant?.id, credorId],
    queryFn: () => fetchPaymentMappings(tenant!.id, credorId!),
    enabled: !!tenant?.id && !!credorId,
  });

  // Mutations
  const saveMethodMutation = useMutation({
    mutationFn: upsertPaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Meio de pagamento salvo!");
      setMethodDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar meio de pagamento"),
  });

  const deleteMethodMutation = useMutation({
    mutationFn: deletePaymentMethod,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Meio de pagamento excluído!");
    },
    onError: () => toast.error("Erro ao excluir. Verifique se existem vínculos."),
  });

  const saveMappingMutation = useMutation({
    mutationFn: upsertPaymentMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_mappings"] });
      toast.success("Mapeamento salvo!");
      setMappingDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar mapeamento"),
  });

  const deleteMappingMutation = useMutation({
    mutationFn: deletePaymentMapping,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_mappings"] });
      toast.success("Mapeamento excluído!");
    },
    onError: () => toast.error("Erro ao excluir mapeamento"),
  });

  // Handlers Methods
  const openNewMethod = () => {
    setEditingMethod(null);
    setMethodName("");
    setMethodDesc("");
    setMethodDialogOpen(true);
  };

  const handleSaveMethod = () => {
    if (!methodName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    saveMethodMutation.mutate({
      id: editingMethod?.id,
      tenant_id: tenant!.id,
      credor_id: credorId || null,
      nome: methodName.trim(),
      descricao: methodDesc.trim() || null,
    });
  };

  // Handlers Mappings
  const openNewMapping = () => {
    setEditingMapping(null);
    setExternalCode("");
    setSelectedInternalId("");
    setMappingDialogOpen(true);
  };

  const handleSaveMapping = () => {
    if (!externalCode.trim() || !selectedInternalId) {
      toast.error("Preencha todos os campos");
      return;
    }
    saveMappingMutation.mutate({
      id: editingMapping?.id,
      tenant_id: tenant!.id,
      credor_id: credorId!,
      external_code: externalCode.trim(),
      internal_id: selectedInternalId,
    });
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="methods">Meios Aceitos</TabsTrigger>
          <TabsTrigger value="mappings" disabled={!credorId}>Tradutor de Integração</TabsTrigger>
        </TabsList>

        {/* LISTA DE MEIOS */}
        <TabsContent value="methods" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              {credorId ? "Meios Específicos do Credor" : "Meios de Pagamento Globais"}
            </p>
            <Button size="sm" onClick={openNewMethod}>
              <Plus className="w-4 h-4 mr-1" /> Novo Meio
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMethods ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4">Carregando...</TableCell></TableRow>
                ) : methods.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum meio cadastrado</TableCell></TableRow>
                ) : (
                  methods.map((m: any) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium text-sm">{m.nome}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{m.descricao || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                            setEditingMethod(m);
                            setMethodName(m.nome);
                            setMethodDesc(m.descricao || "");
                            setMethodDialogOpen(true);
                          }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Excluir meio?</AlertDialogTitle>
                                <AlertDialogDescription>Isso pode afetar históricos de pagamento se houver vínculos.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMethodMutation.mutate(m.id)}>Excluir</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* TRADUTOR DE INTEGRAÇÃO */}
        <TabsContent value="mappings" className="space-y-4 mt-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 rounded-lg flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />
            <div className="text-xs text-blue-700 dark:text-blue-300">
              <p className="font-semibold mb-1">Como usar o Tradutor:</p>
              <p>Mapeie os códigos que vêm do sistema do cliente (ex: MaxList) para os nomes que você quer usar no RIVO.</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">De: Externo → Para: RIVO</p>
            <Button size="sm" onClick={openNewMapping} variant="outline">
              <LinkIcon className="w-4 h-4 mr-1" /> Novo Vínculo
            </Button>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Código Externo</TableHead>
                  <TableHead>Converter Para (RIVO)</TableHead>
                  <TableHead className="w-24 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingMappings ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4">Carregando...</TableCell></TableRow>
                ) : mappings.length === 0 ? (
                  <TableRow><TableCell colSpan={3} className="text-center py-4 text-muted-foreground">Nenhum mapeamento configurado</TableCell></TableRow>
                ) : (
                  mappings.map((map: any) => (
                    <TableRow key={map.id}>
                      <TableCell className="font-mono text-xs">{map.external_code}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                          {map.internal?.nome}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                            setEditingMapping(map);
                            setExternalCode(map.external_code);
                            setSelectedInternalId(map.internal_id);
                            setMappingDialogOpen(true);
                          }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteMappingMutation.mutate(map.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* DIALOG MEIO */}
      <Dialog open={methodDialogOpen} onOpenChange={setMethodDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMethod ? "Editar Meio" : "Novo Meio de Pagamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Nome do Meio (Ex: PIX, Boleto, Dinheiro)</Label>
              <Input value={methodName} onChange={e => setMethodName(e.target.value)} placeholder="Nome visível no sistema" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (Opcional)</Label>
              <Input value={methodDesc} onChange={e => setMethodDesc(e.target.value)} placeholder="Breve detalhamento" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMethod} disabled={saveMethodMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG MAPEAMENTO */}
      <Dialog open={mappingDialogOpen} onOpenChange={setMappingDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Vincular Código Externo</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Código no Sistema do Cliente (Ex: "1", "11", "PIX")</Label>
              <Input value={externalCode} onChange={e => setExternalCode(e.target.value)} placeholder="Exatamente como vem na integração" />
            </div>
            <div className="space-y-2">
              <Label>Equivalente no RIVO</Label>
              <Select value={selectedInternalId} onValueChange={setSelectedInternalId}>
                <SelectTrigger><SelectValue placeholder="Selecione um meio do RIVO" /></SelectTrigger>
                <SelectContent>
                  {methods.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMappingDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveMapping} disabled={saveMappingMutation.isPending}>Salvar Vínculo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PaymentMethodsConfig;
