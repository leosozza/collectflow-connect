import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  allLabel?: string;
  className?: string;
}

const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = "Selecionar",
  allLabel = "Todos",
  className,
}: MultiSelectProps) => {
  const [open, setOpen] = React.useState(false);

  const isAll = selected.length === 0;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  const displayLabel = isAll
    ? allLabel
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selecionados`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 justify-between text-xs font-normal bg-background border-input",
            className
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-1 z-50 bg-popover border border-border shadow-md" align="start">
        <div
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm cursor-pointer hover:bg-accent",
            isAll && "bg-accent"
          )}
          onClick={selectAll}
        >
          <div className={cn(
            "h-3.5 w-3.5 rounded-sm border border-primary flex items-center justify-center",
            isAll && "bg-primary text-primary-foreground"
          )}>
            {isAll && <Check className="h-3 w-3" />}
          </div>
          {allLabel}
        </div>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <div
              key={option.value}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 text-xs rounded-sm cursor-pointer hover:bg-accent",
                isSelected && "bg-accent/50"
              )}
              onClick={() => toggle(option.value)}
            >
              <div className={cn(
                "h-3.5 w-3.5 rounded-sm border border-primary flex items-center justify-center",
                isSelected && "bg-primary text-primary-foreground"
              )}>
                {isSelected && <Check className="h-3 w-3" />}
              </div>
              {option.label}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
};

export { MultiSelect };
export type { MultiSelectOption };
