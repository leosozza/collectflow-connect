import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onValueChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
}

function formatToBRL(num: number): string {
  if (num === 0) return "";
  return num.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseBRL(str: string): number {
  // Remove everything except digits and comma
  const clean = str.replace(/[^\d,]/g, "");
  if (!clean) return 0;
  // Replace comma with dot for parseFloat
  const normalized = clean.replace(",", ".");
  return parseFloat(normalized) || 0;
}

function maskCurrency(raw: string): string {
  // Keep only digits
  let digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  // Treat as cents (last 2 digits are decimals)
  let num = parseInt(digits, 10);
  if (isNaN(num)) return "";

  // Convert cents to reais
  const reais = num / 100;

  return reais.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, placeholder = "0,00", disabled, required, id }, ref) => {
    const [display, setDisplay] = React.useState(() => formatToBRL(value));
    const internalRef = React.useRef<HTMLInputElement>(null);

    // Sync display when value changes externally
    React.useEffect(() => {
      const currentParsed = parseBRL(display);
      if (Math.abs(currentParsed - value) > 0.001) {
        setDisplay(formatToBRL(value));
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawInput = e.target.value;
      const masked = maskCurrency(rawInput);
      setDisplay(masked);

      const numericValue = parseBRL(masked);
      onValueChange(numericValue);
    };

    const handleBlur = () => {
      if (display) {
        const num = parseBRL(display);
        setDisplay(formatToBRL(num));
      }
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all on focus for easy replacement
      setTimeout(() => e.target.select(), 0);
    };

    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
          R$
        </span>
        <input
          ref={ref || internalRef}
          id={id}
          type="text"
          inputMode="numeric"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          value={display}
          onChange={handleChange}
          onBlur={handleBlur}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };

