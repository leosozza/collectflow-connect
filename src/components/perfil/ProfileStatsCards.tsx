import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Target, TrendingUp, Trophy, Coins } from "lucide-react";
import { fetchMyWallet } from "@/services/rivocoinService";

interface Props {
  profileData: any;
}

const ProfileStatsCards = ({ profileData }: Props) => {
  const { data: stats } = useQuery({
    queryKey: ["profile-stats", profileData?.id],
    queryFn: async () => {
      const { data: agreements } = await supabase
        .from("agreements")
        .select("proposed_total, status")
        .eq("created_by", profileData!.user_id);

      const total = agreements?.length || 0;
      const approved = agreements?.filter((a) => a.status === "approved" || a.status === "completed") || [];
      const totalValue = approved.reduce((s, a) => s + Number(a.proposed_total), 0);
      const conversionRate = total > 0 ? Math.round((approved.length / total) * 100) : 0;

      return { totalAgreements: approved.length, totalValue, conversionRate, totalProposals: total };
    },
    enabled: !!profileData?.id,
  });

  const { data: achievements = [] } = useQuery({
    queryKey: ["achievements", profileData?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("achievements")
        .select("id")
        .eq("profile_id", profileData!.id);
      return data || [];
    },
    enabled: !!profileData?.id,
  });

  const { data: wallet } = useQuery({
    queryKey: ["rivocoin-wallet", profileData?.id],
    queryFn: () => fetchMyWallet(profileData!.id),
    enabled: !!profileData?.id,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <Target className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats?.totalAgreements || 0}</p>
          <p className="text-xs text-muted-foreground">Acordos Fechados</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <TrendingUp className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(stats?.totalValue || 0)}
          </p>
          <p className="text-xs text-muted-foreground">Valor Negociado</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <Trophy className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{stats?.conversionRate || 0}%</p>
          <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-4 pb-4 text-center">
          <Trophy className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{achievements.length}</p>
          <p className="text-xs text-muted-foreground">Conquistas</p>
        </CardContent>
      </Card>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="pt-4 pb-4 text-center">
          <Coins className="w-5 h-5 mx-auto text-primary mb-1" />
          <p className="text-2xl font-bold text-foreground">{(wallet?.balance || 0).toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">RivoCoins</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfileStatsCards;
