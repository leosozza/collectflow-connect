import { useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Edit, Save, X, Trophy, Target, TrendingUp, Calendar, Mail, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PerfilPage = () => {
  const { userId } = useParams();
  const { user, profile: authProfile } = useAuth();
  const { isTenantAdmin } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = !userId || userId === authProfile?.user_id;
  const targetUserId = userId || user?.id;

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBirthday, setEditBirthday] = useState("");

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["profile-detail", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!targetUserId,
  });

  const { data: email } = useQuery({
    queryKey: ["user-email", targetUserId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_emails");
      const found = (data || []).find((e: any) => e.user_id === targetUserId);
      return found?.email || "";
    },
    enabled: !!targetUserId && isTenantAdmin,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profileData?.id],
    queryFn: async () => {
      const { data: agreements } = await supabase
        .from("agreements")
        .select("proposed_total, status")
        .eq("created_by", profileData!.user_id);

      const total = agreements?.length || 0;
      const approved = agreements?.filter((a) => a.status === "approved" || a.status === "paid") || [];
      const totalValue = approved.reduce((s, a) => s + Number(a.proposed_total), 0);
      const conversionRate = total > 0 ? Math.round((approved.length / total) * 100) : 0;

      return { totalAgreements: approved.length, totalValue, conversionRate, totalProposals: total };
    },
    enabled: !!profileData?.id,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", profileData?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements")
        .select("*")
        .eq("profile_id", profileData!.id)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profileData?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { full_name: string; bio: string | null; birthday: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("user_id", targetUserId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-detail"] });
      toast.success("Perfil atualizado!");
      setEditing(false);
    },
    onError: () => toast.error("Erro ao atualizar perfil"),
  });

  const uploadAvatar = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${user!.id}/avatar.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });
    if (uploadErr) {
      toast.error("Erro ao enviar foto");
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({ avatar_url: urlData.publicUrl } as any)
      .eq("user_id", user!.id);

    if (updateErr) {
      toast.error("Erro ao salvar URL da foto");
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["profile-detail"] });
    toast.success("Foto atualizada!");
  };

  const startEdit = () => {
    setEditName(profileData?.full_name || "");
    setEditBio((profileData as any)?.bio || "");
    setEditBirthday((profileData as any)?.birthday || "");
    setEditing(true);
  };

  const initials = (profileData?.full_name || "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  if (!profileData) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Perfil não encontrado</div>;
  }

  const canEdit = isOwnProfile || isTenantAdmin;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative group">
              <Avatar className="w-24 h-24 text-2xl">
                <AvatarImage src={(profileData as any)?.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              {isOwnProfile && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                >
                  <Camera className="w-6 h-6 text-white" />
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAvatar(file);
                }}
              />
            </div>

            <div className="flex-1 text-center sm:text-left">
              {editing ? (
                <div className="space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <Textarea value={editBio} onChange={(e) => setEditBio(e.target.value)} placeholder="Uma breve descrição..." rows={2} />
                  </div>
                  <div>
                    <Label>Aniversário</Label>
                    <Input type="date" value={editBirthday} onChange={(e) => setEditBirthday(e.target.value)} />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        updateMutation.mutate({
                          full_name: editName,
                          bio: editBio || null,
                          birthday: editBirthday || null,
                        })
                      }
                      disabled={updateMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-1" /> Salvar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                      <X className="w-4 h-4 mr-1" /> Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 justify-center sm:justify-start">
                    <h1 className="text-2xl font-bold text-foreground">{profileData.full_name}</h1>
                    <Badge variant="secondary" className="capitalize">{profileData.role}</Badge>
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={startEdit}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {(profileData as any)?.bio && (
                    <p className="text-muted-foreground mt-1">{(profileData as any).bio}</p>
                  )}
                  <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground justify-center sm:justify-start">
                    {(profileData as any)?.birthday && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {format(new Date((profileData as any).birthday), "dd MMM", { locale: ptBR })}
                      </span>
                    )}
                    {email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-4 h-4" />
                        {email}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Desde {format(new Date(profileData.created_at), "MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Target className="w-5 h-5 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.totalAgreements || 0}</p>
            <p className="text-xs text-muted-foreground">Acordos Fechados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <TrendingUp className="w-5 h-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats?.totalValue || 0)}
            </p>
            <p className="text-xs text-muted-foreground">Valor Negociado</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats?.conversionRate || 0}%</p>
            <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Trophy className="w-5 h-5 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-bold text-foreground">{achievements.length}</p>
            <p className="text-xs text-muted-foreground">Conquistas</p>
          </CardContent>
        </Card>
      </div>

      {/* Achievements */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Conquistas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">
              Nenhuma conquista ainda. Continue trabalhando para desbloquear!
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {achievements.map((a: any) => (
                <div key={a.id} className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border border-border text-center">
                  <span className="text-3xl mb-2">{a.icon || "🏆"}</span>
                  <p className="text-sm font-medium text-foreground">{a.title}</p>
                  {a.description && (
                    <p className="text-xs text-muted-foreground mt-1">{a.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {format(new Date(a.earned_at), "dd/MM/yyyy")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PerfilPage;
