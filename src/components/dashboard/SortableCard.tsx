import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableCardProps {
  id: string;
  /** Tailwind col-span classes (e.g. "lg:col-span-6"). Defaults to full width. */
  spanClassName?: string;
  children: ReactNode;
}

/**
 * Generic drag-and-drop wrapper used by the Dashboard grid.
 * Renders a small grab handle in the top-right corner (visible on hover).
 */
export default function SortableCard({
  id,
  spanClassName = "col-span-1 lg:col-span-12",
  children,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group min-w-0",
        spanClassName,
        isDragging && "z-50 opacity-80"
      )}
    >
      {/* Drag handle — visible on hover, placed on the left to avoid header action overlap */}
      <button
        type="button"
        aria-label="Arrastar card"
        className={cn(
          "absolute top-1/2 -translate-y-1/2 left-1 z-30 p-1 rounded-md bg-background/60 backdrop-blur-sm",
          "border border-border/40 text-muted-foreground/80 hover:text-foreground hover:bg-background",
          "opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing",
          "shadow-sm"
        )}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-3 h-3" />
      </button>
      {children}
    </div>
  );
}
