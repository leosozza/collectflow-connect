import { useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import PersonalDataTab from "@/components/perfil/PersonalDataTab";
import ProfileStatsCards from "@/components/perfil/ProfileStatsCards";
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
    return (
      <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
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
      <ProfileStatsCards profileData={profileData} />
      {(isOwnProfile || isTenantAdmin) && <SecurityTab />}
    </div>
  );
};

export default PerfilPage;
