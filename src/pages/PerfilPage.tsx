import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PersonalDataTab from "@/components/perfil/PersonalDataTab";
import SecurityTab from "@/components/perfil/SecurityTab";

const PerfilPage = () => {
  const { userId } = useParams();
  const { user, profile: authProfile } = useAuth();
  const { isTenantAdmin } = useTenant();

  const isOwnProfile = !userId || userId === authProfile?.user_id;
  const targetUserId = userId || user?.id;

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

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Carregando...</div>;
  }

  if (!profileData) {
    return <div className="flex items-center justify-center py-20 text-muted-foreground">Perfil não encontrado</div>;
  }

  const canEdit = isOwnProfile || isTenantAdmin;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <PersonalDataTab
        profileData={profileData}
        targetUserId={targetUserId!}
        isOwnProfile={isOwnProfile}
        canEdit={canEdit}
      />
      {isOwnProfile && <SecurityTab />}
    </div>
  );
};

export default PerfilPage;
