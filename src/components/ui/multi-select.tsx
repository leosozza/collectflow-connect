import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  searchable?: boolean;
  searchPlaceholder?: string;
}

const MultiSelect = ({
  options,
  selected,
  onChange,
  placeholder = "Selecionar",
  allLabel = "Todos",
  className,
  searchable = false,
  searchPlaceholder = "Buscar...",
}: MultiSelectProps) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const isAll = selected.length === 0;

  const filteredOptions = searchable && search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

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
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
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
      <PopoverContent className="w-[220px] p-1 z-50 bg-popover border border-border shadow-md" align="start">
        {searchable && (
          <div className="flex items-center gap-1 px-1 pb-1 border-b border-border mb-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-7 text-xs border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1"
              autoFocus
            />
          </div>
        )}
        <div className="max-h-[280px] overflow-y-auto">
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
          {filteredOptions.map((option) => {
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
          {searchable && search.trim() && filteredOptions.length === 0 && (
            <div className="px-2 py-3 text-xs text-muted-foreground text-center">
              Nenhum resultado
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export { MultiSelect };
export type { MultiSelectOption };
