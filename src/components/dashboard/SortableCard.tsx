import { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

interface SortableCardProps {
  id: string;
  /** Tailwind col-span classes (e.g. "lg:col-span-6"). Defaults to full width. */
  spanClassName?: string;
  /** When true, the original card slot is shown as an empty placeholder (the active item is rendered in DragOverlay). */
  isPlaceholder?: boolean;
  children: ReactNode;
}

/**
 * Generic drag-and-drop wrapper used by the Dashboard grid.
 *
 * Visual stability: while a card is being dragged, the OTHER cards in the grid
 * stay completely still — no transforms are applied to siblings. The active
 * card itself is replaced by a subtle dashed placeholder, and the actual
 * preview is rendered through `DragOverlay` (handled by the parent).
 *
 * The slot under the cursor receives a soft ring highlight so the user can
 * see exactly where the card will land on drop.
 */
export default function SortableCard({
  id,
  spanClassName = "col-span-1",
  isPlaceholder = false,
  children,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    isOver,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      // Intentionally NO transform/transition: we don't want neighbors to
      // shuffle while the user is dragging. Reordering happens once on drop.
      className={cn(
        "relative group min-w-0 h-full min-h-0 [&>*]:h-full",
        spanClassName,
        isOver && !isDragging && "ring-2 ring-primary/50 rounded-xl transition-shadow",
      )}
    >
      {isPlaceholder || isDragging ? (
        <div className="h-full w-full rounded-xl border-2 border-dashed border-primary/40 bg-primary/5" />
      ) : (
        children
      )}

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
    </div>
  );
}
