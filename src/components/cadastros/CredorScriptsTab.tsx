import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import {
  fetchScriptsByCredor,
  createScript,
  updateScript,
  deleteScript,
  CANAL_OPTIONS,
  SCRIPT_VARIABLES,
  ScriptAbordagem,
} from "@/services/scriptAbordagemService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";

interface CredorScriptsTabProps {
  credorId?: string;
}

const EMPTY_SCRIPT: Omit<ScriptAbordagem, "id" | "created_at" | "updated_at" | "tipo_devedor"> = {
  tenant_id: "",
  credor_id: null,
  tipo_devedor_id: null,
  canal: "telefone",
  titulo: "",
  conteudo: "",
  is_active: true,
};

const CredorScriptsTab = ({ credorId }: CredorScriptsTabProps) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ScriptAbordagem | null>(null);
  const [form, setForm] = useState<any>({});
  const textareaRef = useState<HTMLTextAreaElement | null>(null);

  const { data: scripts = [], isLoading } = useQuery({
    queryKey: ["scripts-abordagem", credorId],
    queryFn: () => fetchScriptsByCredor(credorId!),
    enabled: !!credorId,
  });

  const { data: tiposDevedor = [] } = useQuery({
    queryKey: ["tipos-devedor-scripts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tipos_devedor")
        .select("id, nome")
        .order("nome");
      return data || [];
    },
  });

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_SCRIPT, credor_id: credorId, tenant_id: tenant?.id });
    setDialogOpen(true);
  };

  const openEdit = (s: ScriptAbordagem) => {
    setEditing(s);
    setForm({ ...s });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editing) {
        await updateScript(editing.id, data);
      } else {
        await createScript({ ...data, tenant_id: tenant!.id, credor_id: credorId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scripts-abordagem", credorId] });
      toast.success(editing ? "Script atualizado!" : "Script criado!");
      setDialogOpen(false);
    },
    onError: () => toast.error("Erro ao salvar script"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteScript(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scripts-abordagem", credorId] });
      toast.success("Script removido");
    },
    onError: () => toast.error("Erro ao remover script"),
  });

  const insertVar = (v: string) => {
    set("conteudo", (form.conteudo || "") + v);
  };

  if (!credorId) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Salve o credor primeiro para gerenciar scripts.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Scripts de Abordagem</p>
          <p className="text-xs text-muted-foreground">
            Personalize o discurso por canal e perfil do devedor. Use variáveis dinâmicas como{" "}
            <code className="bg-muted px-1 rounded text-[10px]">{"{{nome}}"}</code>,{" "}
            <code className="bg-muted px-1 rounded text-[10px]">{"{{valor}}"}</code>.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={openNew}>
          <Plus className="w-3 h-3 mr-1" /> Novo Script
        </Button>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : scripts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <FileText className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum script cadastrado para este credor.</p>
          <Button size="sm" variant="outline" onClick={openNew} className="mt-3">
            <Plus className="w-3 h-3 mr-1" /> Criar primeiro script
          </Button>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Título</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Perfil Devedor</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {scripts.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-sm font-medium">{s.titulo || "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {CANAL_OPTIONS.find((c) => c.value === s.canal)?.label || s.canal}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.tipo_devedor?.nome || "Todos os perfis"}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(v) => updateScript(s.id, { is_active: v }).then(() =>
                      queryClient.invalidateQueries({ queryKey: ["scripts-abordagem", credorId] })
                    )}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate(s.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Script" : "Novo Script de Abordagem"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Título do Script</Label>
                <Input
                  value={form.titulo || ""}
                  onChange={(e) => set("titulo", e.target.value)}
                  placeholder="Ex: Abordagem Mau Pagador - Telefone"
                />
              </div>
              <div>
                <Label>Canal</Label>
                <Select value={form.canal || "telefone"} onValueChange={(v) => set("canal", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CANAL_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Perfil do Devedor</Label>
                <Select
                  value={form.tipo_devedor_id || "todos"}
                  onValueChange={(v) => set("tipo_devedor_id", v === "todos" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os perfis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os perfis</SelectItem>
                    {tiposDevedor.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Conteúdo do Script</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" type="button" className="h-7 text-xs gap-1">
                      Inserir Variável <ChevronDown className="w-3 h-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="end">
                    <div className="space-y-1">
                      {SCRIPT_VARIABLES.map((v) => (
                        <button
                          key={v.key}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                          onClick={() => insertVar(v.key)}
                        >
                          <span className="font-mono text-primary">{v.key}</span>
                          <span className="text-muted-foreground ml-2">— {v.label}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Textarea
                rows={8}
                value={form.conteudo || ""}
                onChange={(e) => set("conteudo", e.target.value)}
                placeholder={`Olá, {{nome}}! Aqui é da equipe de cobrança de {{credor}}. Identificamos uma pendência no valor de {{valor}} com vencimento em {{vencimento}}. Podemos resolver isso juntos!`}
                className="text-sm resize-none"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use as variáveis acima — elas serão preenchidas automaticamente com os dados do cliente durante a ligação.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => set("is_active", v)}
                id="script-active"
              />
              <Label htmlFor="script-active" className="text-sm">Script ativo</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.titulo?.trim() || !form.conteudo?.trim()}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar Script"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CredorScriptsTab;
