import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { fetchTiposStatus, upsertTipoStatus, deleteTipoStatus } from "@/services/cadastrosService";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Download, Copy, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// Papéis fixos do sistema — usados pelo auto-status-sync, agreementService e maxlist-import.
// O nome do status pode mudar livremente; o papel é a chave semântica.
const PAPEIS_SISTEMA = [
  { value: "em_dia", label: "Em Dia", color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { value: "inadimplente", label: "Inadimplente", color: "bg-red-500/10 text-red-700 border-red-300" },
  { value: "acordo_vigente", label: "Acordo Vigente", color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  { value: "acordo_atrasado", label: "Acordo Atrasado", color: "bg-orange-500/10 text-orange-700 border-orange-300" },
  { value: "quebra_acordo", label: "Quebra de Acordo", color: "bg-rose-500/10 text-rose-700 border-rose-300" },
  { value: "quitado", label: "Quitado", color: "bg-sky-500/10 text-sky-700 border-sky-300" },
  { value: "em_negociacao", label: "Em Negociação", color: "bg-purple-500/10 text-purple-700 border-purple-300" },
] as const;

const NONE_PAPEL = "__none__";

const getPapelMeta = (key?: string | null) =>
  PAPEIS_SISTEMA.find((p) => p.value === key);

const DEFAULT_STATUS = [
  { nome: "Em dia", descricao: "Cliente sem pendências", cor: "#22c55e", regras: { papel_sistema: "em_dia" } },
  { nome: "Inadimplente", descricao: "Cliente com parcelas vencidas sem acordo ativo", cor: "#6b7280", regras: { papel_sistema: "inadimplente", bloqueio: false } },
  { nome: "Acordo Vigente", descricao: "Apenas o operador responsável ou admin podem editar", cor: "#3b82f6", regras: { papel_sistema: "acordo_vigente", bloqueio: true, apenas_responsavel: true } },
  { nome: "Acordo Atrasado", descricao: "Acordo com parcela vencida sem pagamento", cor: "#f97316", regras: { papel_sistema: "acordo_atrasado" } },
  { nome: "Quebra de Acordo", descricao: "Muda automaticamente após 3 dias sem baixa da parcela", cor: "#ef4444", regras: { papel_sistema: "quebra_acordo", auto_quebra_dias: 3 } },
  { nome: "Quitado", descricao: "Somente leitura, nenhuma ação de cobrança disponível", cor: "#0ea5e9", regras: { papel_sistema: "quitado", somente_leitura: true } },
  { nome: "Em negociação", descricao: "Cliente travado por 10 dias para o operador responsável", cor: "#a855f7", regras: { papel_sistema: "em_negociacao", bloqueio: true, tempo_expiracao_dias: 10, auto_transicao: "Inadimplente" } },
];

const TipoStatusList = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState("#6b7280");
  const [papelSistema, setPapelSistema] = useState<string>(NONE_PAPEL);
  const [regras, setRegras] = useState<any>({});
  const [seeding, setSeeding] = useState(false);

  const { data: tipos = [], isLoading } = useQuery({
    queryKey: ["tipos_status", tenant?.id],
    queryFn: () => fetchTiposStatus(tenant!.id),
    enabled: !!tenant?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (data: any) => upsertTipoStatus(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tipos_status"] }); toast.success("Salvo!"); setDialogOpen(false); },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTipoStatus,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tipos_status"] }); toast.success("Excluído!"); },
    onError: () => toast.error("Erro ao excluir"),
  });

  const handleSeedDefaults = async () => {
    if (!tenant?.id) return;
    setSeeding(true);
    try {
      // Pular papéis já existentes para não duplicar
      const existingPapeis = new Set(
        (tipos as any[])
          .map((t) => t.regras?.papel_sistema)
          .filter(Boolean)
      );
      let created = 0;
      for (const s of DEFAULT_STATUS) {
        const papel = s.regras?.papel_sistema;
        if (papel && existingPapeis.has(papel)) continue;
        await upsertTipoStatus({ tenant_id: tenant.id, nome: s.nome, descricao: s.descricao, cor: s.cor, regras: s.regras });
        created++;
      }
      queryClient.invalidateQueries({ queryKey: ["tipos_status"] });
      toast.success(created > 0 ? `${created} status padrão carregados!` : "Todos os papéis já existem");
    } catch {
      toast.error("Erro ao carregar status padrão");
    } finally {
      setSeeding(false);
    }
  };

  const openNew = () => {
    setEditing(null);
    setNome("");
    setDescricao("");
    setCor("#6b7280");
    setPapelSistema(NONE_PAPEL);
    setRegras({});
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditing(t);
    setNome(t.nome);
    setDescricao(t.descricao || "");
    setCor(t.cor || "#6b7280");
    setPapelSistema(t.regras?.papel_sistema || NONE_PAPEL);
    setRegras(t.regras || {});
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!nome.trim()) { toast.error("Nome obrigatório"); return; }

    // Validar unicidade do papel_sistema
    if (papelSistema !== NONE_PAPEL) {
      const conflict = (tipos as any[]).find(
        (t) =>
          t.id !== editing?.id &&
          t.regras?.papel_sistema === papelSistema
      );
      if (conflict) {
        const meta = getPapelMeta(papelSistema);
        toast.error(
          `O papel "${meta?.label}" já está atribuído ao status "${conflict.nome}". Cada papel pode ser usado uma única vez.`
        );
        return;
      }
    }

    // Montar regras finais — remover papel_sistema se "Nenhum"
    const finalRegras: any = { ...regras };
    if (papelSistema === NONE_PAPEL) {
      delete finalRegras.papel_sistema;
    } else {
      finalRegras.papel_sistema = papelSistema;
    }

    saveMutation.mutate({
      ...(editing?.id ? { id: editing.id } : {}),
      tenant_id: tenant!.id,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      cor,
      regras: finalRegras,
    });
  };

  const updateRegra = (key: string, value: any) => {
    setRegras((prev: any) => ({ ...prev, [key]: value }));
  };

  const filtered = tipos.filter((t: any) => t.nome.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleSeedDefaults} disabled={seeding}>
            <Download className="w-4 h-4 mr-1" />
            {seeding ? "Carregando..." : "Carregar status padrão"}
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Status</Button>
        </div>
      </div>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Carregando...</div> : filtered.length === 0 ? <div className="p-8 text-center text-muted-foreground text-sm">Nenhum status encontrado</div> : (
          <Table>
            <TableHeader><TableRow className="bg-muted/50"><TableHead>Status</TableHead><TableHead>Papel no Sistema</TableHead><TableHead>UUID (API)</TableHead><TableHead>Descrição</TableHead><TableHead>Regras</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
            <TableBody>
              {filtered.map((t: any) => {
                const papel = t.regras?.papel_sistema;
                const papelMeta = getPapelMeta(papel);
                const hasPapel = !!papelMeta;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.cor || "#6b7280" }} />
                        <span className="font-medium">{t.nome}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {papelMeta ? (
                        <Badge variant="outline" className={`text-xs ${papelMeta.color}`}>
                          <Lock className="w-3 h-3 mr-1" />
                          {papelMeta.label}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Custom</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground max-w-[120px] truncate" title={t.id}>{t.id}</code>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(t.id); toast.success("UUID copiado!"); }}>
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.descricao || "—"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {t.regras?.bloqueio && <Badge variant="outline" className="text-xs">Bloqueio</Badge>}
                        {t.regras?.tempo_expiracao_dias && <Badge variant="outline" className="text-xs">{t.regras.tempo_expiracao_dias}d exp.</Badge>}
                        {t.regras?.auto_quebra_dias && <Badge variant="outline" className="text-xs">{t.regras.auto_quebra_dias}d quebra</Badge>}
                        {t.regras?.somente_leitura && <Badge variant="outline" className="text-xs">Leitura</Badge>}
                        {t.regras?.alerta_visual && <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">Alerta</Badge>}
                        {t.regras?.apenas_responsavel && <Badge variant="outline" className="text-xs">Responsável</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive"
                            disabled={hasPapel}
                            title={hasPapel ? "Status com papel do sistema não pode ser excluído. Renomeie se necessário." : "Excluir"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>Excluir status?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => deleteMutation.mutate(t.id)}>Excluir</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar Status" : "Novo Status"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1"><Label>Nome *</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex: Em negociação" /></div>
              <div className="w-20">
                <Label>Cor</Label>
                <Input type="color" value={cor} onChange={e => setCor(e.target.value)} className="h-10 p-1 cursor-pointer" />
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                Papel no Sistema
                <span className="text-xs text-muted-foreground font-normal">(define o comportamento na automação)</span>
              </Label>
              <Select value={papelSistema} onValueChange={setPapelSistema}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o papel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_PAPEL}>Nenhum (status custom/visual)</SelectItem>
                  {PAPEIS_SISTEMA.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {papelSistema !== NONE_PAPEL && (
                <p className="text-xs text-muted-foreground mt-1">
                  Este status assumirá o papel "{getPapelMeta(papelSistema)?.label}" no auto-sync. O nome pode ser personalizado livremente.
                </p>
              )}
            </div>

            <div><Label>Descrição</Label><Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição do status" /></div>
            <div className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Regras de Negócio</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Bloquear edição por outros operadores</Label>
                <Switch checked={regras.bloqueio || false} onCheckedChange={(v) => updateRegra("bloqueio", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Apenas operador responsável / admin</Label>
                <Switch checked={regras.apenas_responsavel || false} onCheckedChange={(v) => updateRegra("apenas_responsavel", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Somente leitura</Label>
                <Switch checked={regras.somente_leitura || false} onCheckedChange={(v) => updateRegra("somente_leitura", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Alerta visual (badge vermelha)</Label>
                <Switch checked={regras.alerta_visual || false} onCheckedChange={(v) => updateRegra("alerta_visual", v)} />
              </div>
              {regras.bloqueio && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">Expiração (dias)</Label>
                  <Input type="number" min={1} max={90} className="w-20" value={regras.tempo_expiracao_dias || ""} onChange={e => updateRegra("tempo_expiracao_dias", Number(e.target.value) || null)} placeholder="10" />
                </div>
              )}
              {regras.bloqueio && regras.tempo_expiracao_dias && (
                <div className="flex items-center gap-3">
                  <Label className="text-sm whitespace-nowrap">Após expirar, mudar para</Label>
                  <Input value={regras.auto_transicao || ""} onChange={e => updateRegra("auto_transicao", e.target.value || null)} placeholder="Inadimplente" className="flex-1" />
                </div>
              )}
              <div className="flex items-center gap-3">
                <Label className="text-sm whitespace-nowrap">Auto-quebra (dias sem baixa)</Label>
                <Input type="number" min={1} max={30} className="w-20" value={regras.auto_quebra_dias || ""} onChange={e => updateRegra("auto_quebra_dias", Number(e.target.value) || null)} placeholder="3" />
              </div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TipoStatusList;
