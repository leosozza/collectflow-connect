import { useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Sparkles, Gift } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

export interface CelebrationPayload {
  campaign_id: string;
  campaign_title: string;
  prize_description?: string | null;
  position: number;
  total: number;
  score: number;
}

interface Props {
  open: boolean;
  data: CelebrationPayload | null;
  onClose: () => void;
}

const fireFireworks = () => {
  const duration = 2500;
  const end = Date.now() + duration;

  const tick = () => {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 70,
      origin: { x: 0, y: 0.7 },
      colors: ["#F97316", "#FBBF24", "#FFFFFF"],
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 70,
      origin: { x: 1, y: 0.7 },
      colors: ["#F97316", "#FBBF24", "#FFFFFF"],
    });
    if (Date.now() < end) requestAnimationFrame(tick);
  };
  tick();

  // initial burst
  confetti({
    particleCount: 120,
    spread: 90,
    origin: { y: 0.6 },
    colors: ["#F97316", "#FBBF24", "#22C55E", "#FFFFFF"],
  });
};

const CampaignCelebrationModal = ({ open, data, onClose }: Props) => {
  useEffect(() => {
    if (open && data && data.position <= 3) {
      // small delay so the dialog is mounted
      const t = setTimeout(fireFireworks, 200);
      return () => clearTimeout(t);
    }
  }, [open, data]);

  if (!data) return null;

  const isTop3 = data.position <= 3;
  const medal = data.position === 1 ? "🥇" : data.position === 2 ? "🥈" : data.position === 3 ? "🥉" : "🎯";
  const heading =
    data.position === 1
      ? "Parabéns, campeão!"
      : data.position === 2
      ? "Vice-campeão!"
      : data.position === 3
      ? "Pódio garantido!"
      : "Campanha encerrada";
  const subheading =
    data.position === 1
      ? "Você dominou a campanha. Que performance incrível!"
      : data.position === 2
      ? "Quase lá — uma performance brilhante!"
      : data.position === 3
      ? "Você fechou o pódio com chave de ouro!"
      : `Você ficou em ${data.position}º lugar de ${data.total} participantes. Continue firme — a próxima é sua!`;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-primary/30">
        <div
          className={`relative px-6 py-8 text-center ${
            isTop3
              ? "bg-gradient-to-br from-primary/15 via-primary/5 to-background"
              : "bg-gradient-to-br from-muted/40 to-background"
          }`}
        >
          <motion.div
            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="text-7xl mb-2"
          >
            {medal}
          </motion.div>

          <motion.h2
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold text-foreground flex items-center justify-center gap-2"
          >
            {isTop3 && <Sparkles className="w-5 h-5 text-primary" />}
            {heading}
            {isTop3 && <Sparkles className="w-5 h-5 text-primary" />}
          </motion.h2>

          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-muted-foreground mt-2"
          >
            {subheading}
          </motion.p>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-5 rounded-lg border border-border bg-card/50 px-4 py-3 text-left space-y-1.5"
          >
            <div className="flex items-center gap-2 text-sm">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="font-medium text-foreground truncate">{data.campaign_title}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Sua posição</span>
              <span className="font-semibold text-foreground">
                {data.position}º {data.total > 0 ? `/ ${data.total}` : ""}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Pontuação</span>
              <span className="font-mono font-semibold text-foreground">
                {Number(data.score).toLocaleString("pt-BR")}
              </span>
            </div>
            {data.prize_description && isTop3 && (
              <div className="flex items-start gap-2 text-xs bg-primary/10 rounded-md px-2 py-1.5 mt-2">
                <Gift className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span className="text-foreground">{data.prize_description}</span>
              </div>
            )}
          </motion.div>

          <Button onClick={onClose} className="mt-6 w-full" size="lg">
            {isTop3 ? "Comemorar" : "Bora pra próxima!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CampaignCelebrationModal;
