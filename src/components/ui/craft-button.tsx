import * as React from "react";
import { cn } from "@/lib/utils";

const CraftButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "group inline-flex items-center gap-1 transition-all",
      className,
    )}
    {...props}
  >
    {children}
  </button>
));
CraftButton.displayName = "CraftButton";

const CraftButtonLabel = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-block transition-transform duration-300 group-hover:-translate-x-0.5",
      className,
    )}
    {...props}
  />
));
CraftButtonLabel.displayName = "CraftButtonLabel";

const CraftButtonIcon = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center opacity-0 -translate-x-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0",
      className,
    )}
    {...props}
  />
));
CraftButtonIcon.displayName = "CraftButtonIcon";

export { CraftButton, CraftButtonLabel, CraftButtonIcon };
