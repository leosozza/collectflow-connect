import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Settings, User, Bell, Shield, Palette } from "lucide-react";

const ConfiguracoesPage = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Profile editing
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  // Preferences (local state, could be persisted)
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoBreak, setAutoBreak] = useState(true);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("id", profile.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Perfil atualizado!");
    } catch {
      toast.error("Erro ao atualizar perfil");
    } finally {
      setSaving(false);
    }
  };

  if (profile?.role !== "admin") {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Acesso restrito a administradores.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground text-sm">Gerencie as configurações do sistema</p>
      </div>

      {/* Perfil */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Meu Perfil</h2>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nome Completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Tipo de Usuário</Label>
            <Input value={profile?.role || ""} disabled className="capitalize" />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} size="sm">
            {saving ? "Salvando..." : "Salvar Perfil"}
          </Button>
        </div>
      </div>

      {/* Notificações */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Notificações</h2>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-card-foreground">Notificações de vencimento</p>
            <p className="text-xs text-muted-foreground">Receba alertas sobre parcelas vencendo</p>
          </div>
          <Switch checked={notifications} onCheckedChange={setNotifications} />
        </div>
      </div>

      {/* Sistema */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Settings className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Sistema</h2>
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-card-foreground">Quebra automática</p>
            <p className="text-xs text-muted-foreground">Marcar automaticamente parcelas vencidas como quebradas</p>
          </div>
          <Switch checked={autoBreak} onCheckedChange={setAutoBreak} />
        </div>
      </div>

      {/* Segurança */}
      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-card-foreground">Segurança</h2>
        </div>
        <Separator />
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Para alterar sua senha, utilize a opção de recuperação de senha na tela de login.
          </p>
          <Button variant="outline" size="sm" disabled>
            Alterar Senha (em breve)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ConfiguracoesPage;
