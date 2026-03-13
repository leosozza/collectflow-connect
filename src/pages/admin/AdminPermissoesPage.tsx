import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Save, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchModules,
  fetchUserPermissions,
  saveUserPermissions,
  fetchSuperAdminUsers,
  type SAModule,
  type SAUserPermission,
} from "@/services/saPermissionService";

interface UserOption {
  id: string;
  name: string;
}

const GROUP_COLORS: Record<string, string> = {
  "Operação": "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Automação e Serviços": "bg-purple-500/10 text-purple-700 border-purple-500/20",
  "Gestão de Clientes": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Administração": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  "Configurações": "bg-slate-500/10 text-slate-700 border-slate-500/20",
  "root": "bg-primary/10 text-primary border-primary/20",
};

const AdminPermissoesPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [modules, setModules] = useState<SAModule[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [perms, setPerms] = useState<Record<string, SAUserPermission>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const [mods, adminUsers] = await Promise.all([fetchModules(), fetchSuperAdminUsers()]);
        setModules(mods);
        const userList: UserOption[] = adminUsers.map((u: any) => ({
          id: u.user_id,
          name: (u.profiles as any)?.full_name || "Sem nome",
        }));
        setUsers(userList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedUserId) {
      setPerms({});
      return;
    }
    const loadPerms = async () => {
      try {
        const data = await fetchUserPermissions(selectedUserId);
        const map: Record<string, SAUserPermission> = {};
        for (const p of data) {
          map[p.module_slug] = p;
        }
        setPerms(map);
      } catch (err) {
        console.error(err);
      }
    };
    loadPerms();
  }, [selectedUserId]);

  const getPerm = (slug: string): SAUserPermission => {
    return perms[slug] || { module_slug: slug, can_view: false, can_create: false, can_edit: false, can_delete: false };
  };

  const togglePerm = (slug: string, field: keyof Pick<SAUserPermission, "can_view" | "can_create" | "can_edit" | "can_delete">) => {
    const current = getPerm(slug);
    setPerms((prev) => ({
      ...prev,
      [slug]: { ...current, [field]: !current[field] },
    }));
  };

  const handleSave = async () => {
    if (!selectedUserId || !user?.id) return;
    setSaving(true);
    try {
      const permsList = modules.map((m) => getPerm(m.slug));
      await saveUserPermissions(selectedUserId, permsList, user.id);
      toast({ title: "Permissões salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleAllView = (value: boolean) => {
    const updated = { ...perms };
    for (const m of modules) {
      const current = getPerm(m.slug);
      updated[m.slug] = { ...current, can_view: value };
    }
    setPerms(updated);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Group modules by sidebar_group
  const groups = modules.reduce<Record<string, SAModule[]>>((acc, m) => {
    const g = m.sidebar_group;
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Permissões e Módulos</h2>
          <p className="text-sm text-muted-foreground">Configure as permissões de acesso para cada colaborador</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Colaborador</CardTitle>
          <CardDescription>Escolha um usuário para configurar suas permissões de acesso aos módulos</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Selecione um colaborador..." />
            </SelectTrigger>
            <SelectContent>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedUserId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Matriz de Permissões</CardTitle>
              <CardDescription>Marque as permissões para cada módulo do sistema</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => toggleAllView(true)}>
                Marcar todos Ver
              </Button>
              <Button variant="outline" size="sm" onClick={() => toggleAllView(false)}>
                Desmarcar todos Ver
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Módulo</TableHead>
                    <TableHead className="text-center w-24">Ver</TableHead>
                    <TableHead className="text-center w-24">Criar</TableHead>
                    <TableHead className="text-center w-24">Editar</TableHead>
                    <TableHead className="text-center w-24">Excluir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(groups).map(([group, mods]) => (
                    <>
                      <TableRow key={`group-${group}`} className="bg-muted/30">
                        <TableCell colSpan={5}>
                          <Badge variant="outline" className={GROUP_COLORS[group] || "bg-muted text-muted-foreground"}>
                            {group === "root" ? "Principal" : group}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      {mods.map((m) => {
                        const p = getPerm(m.slug);
                        return (
                          <TableRow key={m.slug}>
                            <TableCell className="font-medium">{m.name}</TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={p.can_view}
                                onCheckedChange={() => togglePerm(m.slug, "can_view")}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={p.can_create}
                                onCheckedChange={() => togglePerm(m.slug, "can_create")}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={p.can_edit}
                                onCheckedChange={() => togglePerm(m.slug, "can_edit")}
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Checkbox
                                checked={p.can_delete}
                                onCheckedChange={() => togglePerm(m.slug, "can_delete")}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar Permissões
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPermissoesPage;
