import { useState, useRef } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Camera, Edit, Save, X, Calendar, Mail, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  profileData: any;
  targetUserId: string;
  isOwnProfile: boolean;
  canEdit: boolean;
}

const PersonalDataTab = ({ profileData, targetUserId, isOwnProfile, canEdit }: Props) => {
  const { user } = useAuth();
  const { isTenantAdmin } = useTenant();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editBirthday, setEditBirthday] = useState("");

  const { data: email } = useQuery({
    queryKey: ["user-email", targetUserId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_user_emails");
      const found = (data || []).find((e: any) => e.user_id === targetUserId);
      return found?.email || "";
    },
    enabled: !!targetUserId && isTenantAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: { full_name: string; bio: string | null; birthday: string | null }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates as any)
        .eq("user_id", targetUserId);
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
    .map((n: string) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
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
                <p className="text-muted-foreground mt-1">
                  {(profileData as any)?.bio || <span className="italic text-muted-foreground/60">Não informado</span>}
                </p>
                <div className="flex flex-wrap gap-4 mt-3 text-sm text-muted-foreground justify-center sm:justify-start">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {(profileData as any)?.birthday
                      ? format(new Date((profileData as any).birthday), "dd MMM", { locale: ptBR })
                      : <span className="italic text-muted-foreground/60">Não informado</span>}
                  </span>
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
  );
};

export default PersonalDataTab;
