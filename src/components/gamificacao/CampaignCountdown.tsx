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
    <div className="bg-gradient-to-b from-primary to-primary/80 rounded px-1.5 py-0.5 min-w-[1.75rem] text-center shadow-sm shadow-primary/30">
      <span className="text-[11px] font-bold tabular-nums text-primary-foreground leading-tight">
        {String(value).padStart(2, "0")}
      </span>
    </div>
    <span className="text-[8px] uppercase tracking-wider text-primary/80 font-semibold mt-0.5">
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
      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
        Encerrada
      </span>
    );
  }

  return (
    <div className="flex items-end gap-1">
      <Unit value={t.days} label="d" />
      <span className="text-primary/60 text-[11px] font-bold pb-3.5">:</span>
      <Unit value={t.hours} label="h" />
      <span className="text-primary/60 text-[11px] font-bold pb-3.5">:</span>
      <Unit value={t.minutes} label="m" />
      <span className="text-primary/60 text-[11px] font-bold pb-3.5">:</span>
      <Unit value={t.seconds} label="s" />
    </div>
  );
};

export default CampaignCountdown;
