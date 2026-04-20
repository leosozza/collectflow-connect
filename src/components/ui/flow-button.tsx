import * as React from "react";
import { cn } from "@/lib/utils";

interface FlowButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * PrimaryFlowButton — botão com efeito de "fluxo" gradiente animado.
 * Usa tokens semânticos do design system (primary / primary-foreground).
 */
export const PrimaryFlowButton = React.forwardRef<HTMLButtonElement, FlowButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center overflow-hidden rounded-md",
          "px-4 h-9 text-sm font-medium",
          "bg-primary text-primary-foreground",
          "shadow-sm transition-all duration-300",
          "hover:shadow-lg hover:shadow-primary/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        {/* Camada de fluxo gradiente animado */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-primary-foreground/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
        />
        {/* Brilho de borda no hover */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-md ring-1 ring-inset ring-primary-foreground/10 group-hover:ring-primary-foreground/30 transition-colors duration-300"
        />
        <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
      </button>
    );
  }
);
PrimaryFlowButton.displayName = "PrimaryFlowButton";

export default PrimaryFlowButton;
