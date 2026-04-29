import { useEffect, useState } from "react";
import { parseISO } from "date-fns";

interface CampaignCountdownProps {
  endDate: string;
}

const calc = (target: Date) => {
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    ended: false,
  };
};

const Unit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-muted/60 border border-border rounded-md px-2 py-1 min-w-[2.25rem] text-center">
      <span className="text-sm font-bold tabular-nums text-foreground">
        {String(value).padStart(2, "0")}
      </span>
    </div>
    <span className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
      {label}
    </span>
  </div>
);

const CampaignCountdown = ({ endDate }: CampaignCountdownProps) => {
  const target = parseISO(endDate);
  const [t, setT] = useState(() => calc(target));

  useEffect(() => {
    const id = setInterval(() => setT(calc(target)), 1000);
    return () => clearInterval(id);
  }, [endDate]);

  if (t.ended) {
    return (
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
        Encerrada
      </div>
    );
  }

  return (
    <div className="flex items-end gap-1.5">
      <Unit value={t.days} label="dias" />
      <span className="text-muted-foreground/50 text-sm pb-4">:</span>
      <Unit value={t.hours} label="hrs" />
      <span className="text-muted-foreground/50 text-sm pb-4">:</span>
      <Unit value={t.minutes} label="min" />
      <span className="text-muted-foreground/50 text-sm pb-4">:</span>
      <Unit value={t.seconds} label="seg" />
    </div>
  );
};

export default CampaignCountdown;
