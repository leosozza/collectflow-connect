import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Loader2, Eye, EyeOff, Users, HeadphonesIcon, DollarSign } from "lucide-react";
import { invokeCreateUser, handleEdgeFunctionError, showEdgeFunctionResult } from "@/services/userEdgeFunctionService";

type UserType = "rivo" | "tenant";
type SupportArea = "suporte" | "financeiro";

const AdminUsuariosPage = () => {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newRole, setNewRole] = useState("admin");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [userType, setUserType] = useState<UserType>("tenant");
  const [supportAreas, setSupportAreas] = useState<SupportArea[]>(["suporte", "financeiro"]);
  const [creating, setCreating] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ["sa-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Equipe RIVO = profiles sem tenant (membros internos)
  const { data: rivoStaff = [], isLoading: loadingStaff } = useQuery({
    queryKey: ["sa-rivo-staff"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .is("tenant_id", null)
        .order("full_name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: staffCategories = [] } = useQuery({
    queryKey: ["sa-staff-categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_staff_categories")
        .select("user_id, categories");
      if (error) throw error;
      return (data || []) as { user_id: string; categories: SupportArea[] }[];
    },
  });

  const categoriesByUser = new Map<string, SupportArea[]>(
    staffCategories.map((s) => [s.user_id, s.categories])
  );

  const toggleArea = (area: SupportArea) => {
    setSupportAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const upsertStaffCategories = async (userId: string, areas: SupportArea[]) => {
    if (areas.length === 0) return;
    const { error } = await (supabase as any)
      .from("support_staff_categories")
      .upsert({ user_id: userId, categories: areas }, { onConflict: "user_id" });
    if (error) throw error;
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newEmail.trim() || !newPassword.trim()) {
      toast.error("Preencha nome, email e senha");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (userType === "tenant" && !selectedTenantId) {
      toast.error("Selecione a empresa para o usuário de tenant");
      return;
    }
    if (userType === "rivo" && supportAreas.length === 0) {
      toast.error("Selecione pelo menos uma área de atendimento (Suporte ou Financeiro)");
      return;
    }
    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        full_name: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
      };
      if (userType === "tenant") {
        body.tenant_id = selectedTenantId;
      }
      const result = await invokeCreateUser(body);
      showEdgeFunctionResult(result, newName.trim());

      // Para Equipe RIVO, gravar áreas de atendimento de suporte
      if (userType === "rivo") {
        let userId = result.user_id;
        if (!userId) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("user_id")
            .is("tenant_id", null)
            .order("created_at", { ascending: false })
            .limit(20);
          // tenta achar pelo nome (fallback)
          const found = prof?.find((p: any) => p.full_name === newName.trim());
          userId = found?.user_id;
        }
        if (userId) {
          try {
            await upsertStaffCategories(userId, supportAreas);
          } catch (e: any) {
            console.error("Failed to save support areas:", e);
            toast.error("Usuário criado, mas falhou ao salvar áreas de atendimento.");
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["sa-all-users"] });
      queryClient.invalidateQueries({ queryKey: ["sa-rivo-staff"] });
      queryClient.invalidateQueries({ queryKey: ["sa-staff-categories"] });
      resetForm();
    } catch (err: any) {
      toast.error(handleEdgeFunctionError(err));
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewOpen(false);
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole(userType === "rivo" ? "admin" : "operador");
    setSelectedTenantId("");
    setUserType("tenant");
    setSupportAreas(["suporte", "financeiro"]);
  };

  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
    setNewRole(type === "rivo" ? "admin" : "operador");
    setSelectedTenantId("");
    setSupportAreas(["suporte", "financeiro"]);
  };

  const handleToggleExistingArea = async (
    userId: string,
    area: SupportArea,
    currentAreas: SupportArea[],
  ) => {
    const next = currentAreas.includes(area)
      ? currentAreas.filter((a) => a !== area)
      : [...currentAreas, area];
    if (next.length === 0) {
      toast.error("O usuário precisa atender pelo menos uma área (Suporte ou Financeiro).");
      return;
    }
    try {
      await upsertStaffCategories(userId, next);
      queryClient.invalidateQueries({ queryKey: ["sa-staff-categories"] });
      toast.success("Áreas de atendimento atualizadas.");
    } catch (e: any) {
      toast.error("Falha ao atualizar áreas.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Gestão de Usuários
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Crie novos usuários para a plataforma
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            Criar Novo Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Adicione novos colaboradores à plataforma vinculando-os a uma empresa e função.
          </p>
          <Button onClick={() => setNewOpen(true)} className="gap-2">
            <UserPlus className="w-4 h-4" />
            Novo Usuário
          </Button>
        </CardContent>
      </Card>

      {/* Áreas de atendimento da Equipe RIVO */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <HeadphonesIcon className="w-4 h-4 text-primary" />
            Áreas de Atendimento – Equipe RIVO
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Defina, para cada membro da equipe RIVO, quais áreas de suporte ele atende. Tickets
            são filtrados automaticamente conforme essa configuração.
          </p>
          {loadingStaff ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : rivoStaff.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum membro da equipe RIVO cadastrado.</p>
          ) : (
            <div className="divide-y">
              {rivoStaff.map((s: any) => {
                const areas = categoriesByUser.get(s.user_id) || ["suporte", "financeiro"];
                return (
                  <div key={s.user_id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.full_name || "(sem nome)"}</p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={areas.includes("suporte")}
                          onCheckedChange={() => handleToggleExistingArea(s.user_id, "suporte", areas)}
                        />
                        <HeadphonesIcon className="w-3 h-3 text-muted-foreground" />
                        Suporte
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={areas.includes("financeiro")}
                          onCheckedChange={() => handleToggleExistingArea(s.user_id, "financeiro", areas)}
                        />
                        <DollarSign className="w-3 h-3 text-muted-foreground" />
                        Financeiro
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Novo Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">Tipo de Conta</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={userType === "rivo" ? "default" : "outline"}
                  className="w-full text-sm"
                  onClick={() => handleUserTypeChange("rivo")}
                >
                  Equipe RIVO
                </Button>
                <Button
                  type="button"
                  variant={userType === "tenant" ? "default" : "outline"}
                  className="w-full text-sm"
                  onClick={() => handleUserTypeChange("tenant")}
                >
                  Usuário de Tenant
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {userType === "rivo"
                  ? "Membro da equipe de gestão da plataforma RIVO"
                  : "Colaborador vinculado a uma empresa cliente"}
              </p>
            </div>
            <div>
              <Label>Nome completo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label>Função</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {userType === "rivo" ? (
                    <>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="operador">Operador</SelectItem>
                      <SelectItem value="supervisor">Supervisor</SelectItem>
                      <SelectItem value="gerente">Gerente</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            {userType === "tenant" && (
              <div>
                <Label>Empresa (Tenant) *</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a empresa..." /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {userType === "rivo" && (
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground mb-2 block">
                  Áreas de atendimento de suporte *
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      supportAreas.includes("suporte") ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={supportAreas.includes("suporte")}
                      onCheckedChange={() => toggleArea("suporte")}
                    />
                    <HeadphonesIcon className="w-4 h-4 text-primary" />
                    <span className="text-sm">Suporte</span>
                  </label>
                  <label
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer transition-colors ${
                      supportAreas.includes("financeiro") ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={supportAreas.includes("financeiro")}
                      onCheckedChange={() => toggleArea("financeiro")}
                    />
                    <DollarSign className="w-4 h-4 text-primary" />
                    <span className="text-sm">Financeiro</span>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Marque ambas para que o usuário receba tickets das duas áreas.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => resetForm()}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsuariosPage;
