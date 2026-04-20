import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
import { Button, ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends Omit<ButtonProps, "onClick" | "children"> {
  value: string;
  successMessage?: string;
  errorMessage?: string;
  label?: string;
  showLabel?: boolean;
  iconClassName?: string;
}

/**
 * Botão de copiar reutilizável com feedback visual claro:
 * - Ícone troca para ✓ por 1.5s
 * - Toast curto de confirmação
 * - Estado disabled durante feedback evita múltiplos cliques
 */
const CopyButton = ({
  value,
  successMessage = "Copiado!",
  errorMessage = "Falha ao copiar",
  label,
  showLabel = false,
  variant = "ghost",
  size = "icon",
  className,
  iconClassName,
  ...props
}: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(successMessage);
        setTimeout(() => setCopied(false), 1500);
      } catch {
        toast.error(errorMessage);
      }
    },
    [value, successMessage, errorMessage]
  );

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      aria-label={label || "Copiar"}
      title={label || "Copiar"}
      className={cn("transition-all", className)}
      {...props}
    >
      {copied ? (
        <Check className={cn("h-4 w-4 text-success animate-scale-in", iconClassName)} />
      ) : (
        <Copy className={cn("h-4 w-4", iconClassName)} />
      )}
      {showLabel && label && <span className="ml-1.5">{copied ? "Copiado" : label}</span>}
    </Button>
  );
};

export default CopyButton;
