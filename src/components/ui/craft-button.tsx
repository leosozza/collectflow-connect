import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

type Size = "sm" | "default" | "lg";

const CraftButtonContext = React.createContext<{ size?: Size }>({});

interface CraftButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  asChild?: boolean;
}

const CraftButton = React.forwardRef<HTMLButtonElement, CraftButtonProps>(
  ({ children, size = "default", asChild = false, className, ...rest }, ref) => {
    const Comp: any = asChild ? Slot : "button";
    return (
      <CraftButtonContext.Provider value={{ size }}>
        <Comp
          ref={ref}
          className={cn(
            "group relative cursor-pointer overflow-hidden rounded-full transition-all duration-500",
            "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
            "border border-transparent bg-transparent",
            "hover:bg-background hover:shadow-md",
            "dark:hover:border-primary/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "disabled:pointer-events-none disabled:opacity-50",
            className,
          )}
          {...rest}
        >
          {children}
        </Comp>
      </CraftButtonContext.Provider>
    );
  },
);
CraftButton.displayName = "CraftButton";

const CraftButtonLabel = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => (
  <span
    ref={ref}
    className={cn(
      "relative z-[2] transition-colors duration-500 group-hover:text-foreground",
      className,
    )}
    {...props}
  >
    {children}
  </span>
));
CraftButtonLabel.displayName = "CraftButtonLabel";

const CraftButtonIcon = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => {
  const { size } = React.useContext(CraftButtonContext);
  const iconSize = size === "lg" ? "size-6" : size === "sm" ? "size-4" : "size-5";

  return (
    <span ref={ref} className={cn("relative z-[1]", iconSize, className)} {...props}>
      <span
        className={cn(
          "absolute inset-0 -z-[1] rounded-full bg-background transition-transform duration-500 group-hover:scale-[15]",
          iconSize,
        )}
      />
      <span
        className={cn(
          "relative z-[2] flex items-center justify-center rounded-full bg-background text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-background",
          iconSize,
        )}
      >
        {children}
      </span>
    </span>
  );
});
CraftButtonIcon.displayName = "CraftButtonIcon";

export { CraftButton, CraftButtonLabel, CraftButtonIcon };
export type { CraftButtonProps };
