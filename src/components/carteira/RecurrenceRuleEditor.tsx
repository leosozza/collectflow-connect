import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface RecurrenceRule {
  frequency: "daily" | "weekly" | "monthly";
  time: string; // HH:MM
  weekdays?: number[]; // 0=dom..6=sab
  day_of_month?: number;
  window_start?: string;
  window_end?: string;
  end_at?: string | null;
  max_runs?: number | null;
  skip_weekends?: boolean;
  timezone?: string;
}

interface Props {
  value: RecurrenceRule;
  onChange: (rule: RecurrenceRule) => void;
  disabled?: boolean;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function describeRecurrenceRule(rule: RecurrenceRule): string {
  const time = rule.time || "08:00";
  let base = "";
  if (rule.frequency === "daily") {
    base = `Todos os dias às ${time}`;
  } else if (rule.frequency === "weekly") {
    const days = (rule.weekdays || []).sort();
    if (days.length === 0) base = `Semanal às ${time} (nenhum dia selecionado)`;
    else if (days.length === 7) base = `Todos os dias às ${time}`;
    else base = `Toda ${days.map((d) => WEEKDAY_LABELS[d]).join(", ")} às ${time}`;
  } else if (rule.frequency === "monthly") {
    base = `Todo dia ${rule.day_of_month || 1} às ${time}`;
  }
  if (rule.skip_weekends && rule.frequency !== "monthly") base += " (exceto fins de semana)";
  if (rule.end_at) base += `, até ${new Date(rule.end_at).toLocaleDateString("pt-BR")}`;
  if (rule.max_runs) base += `, no máximo ${rule.max_runs} execuções`;
  return base;
}

export default function RecurrenceRuleEditor({ value, onChange, disabled }: Props) {
  const set = (patch: Partial<RecurrenceRule>) => onChange({ ...value, ...patch });

  const toggleWeekday = (day: number) => {
    const current = value.weekdays || [];
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    set({ weekdays: next });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Frequência</Label>
          <Select
            value={value.frequency}
            onValueChange={(v: any) => set({ frequency: v })}
            disabled={disabled}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Diária</SelectItem>
              <SelectItem value="weekly">Semanal</SelectItem>
              <SelectItem value="monthly">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Horário</Label>
          <Input
            type="time"
            value={value.time || "08:00"}
            onChange={(e) => set({ time: e.target.value })}
            disabled={disabled}
            className="h-8"
          />
        </div>
      </div>

      {value.frequency === "weekly" && (
        <div>
          <Label className="text-xs">Dias da semana</Label>
          <div className="flex flex-wrap gap-1 mt-1">
            {WEEKDAY_LABELS.map((label, idx) => {
              const active = (value.weekdays || []).includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => toggleWeekday(idx)}
                  disabled={disabled}
                  className={`px-2 py-1 text-xs rounded border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {value.frequency === "monthly" && (
        <div>
          <Label className="text-xs">Dia do mês (1–31)</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={value.day_of_month || 1}
            onChange={(e) =>
              set({ day_of_month: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })
            }
            disabled={disabled}
            className="h-8"
            title="Em meses sem este dia (ex.: 30 em fevereiro), o disparo ocorre no último dia disponível do mês."
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Meses sem o dia escolhido usam o último dia disponível.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Janela (início)</Label>
          <Input
            type="time"
            value={value.window_start || "08:00"}
            onChange={(e) => set({ window_start: e.target.value })}
            disabled={disabled}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Janela (fim)</Label>
          <Input
            type="time"
            value={value.window_end || "20:00"}
            onChange={(e) => set({ window_end: e.target.value })}
            disabled={disabled}
            className="h-8"
          />
        </div>
      </div>

      {value.frequency !== "monthly" && (
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={!!value.skip_weekends}
            onCheckedChange={(v) => set({ skip_weekends: !!v })}
            disabled={disabled}
          />
          Pular fins de semana
        </label>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label className="text-xs">Término (data)</Label>
          <Input
            type="date"
            value={value.end_at ? value.end_at.slice(0, 10) : ""}
            onChange={(e) =>
              set({ end_at: e.target.value ? new Date(e.target.value + "T23:59:59").toISOString() : null })
            }
            disabled={disabled}
            className="h-8"
          />
        </div>
        <div>
          <Label className="text-xs">Máximo de execuções</Label>
          <Input
            type="number"
            min={1}
            placeholder="Ilimitado"
            value={value.max_runs ?? ""}
            onChange={(e) =>
              set({ max_runs: e.target.value ? Number(e.target.value) : null })
            }
            disabled={disabled}
            className="h-8"
          />
        </div>
      </div>

      <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Preview: </strong>
        {describeRecurrenceRule(value)}
      </div>
    </div>
  );
}
