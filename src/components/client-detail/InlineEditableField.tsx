import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface InlineEditableFieldProps {
  label: string;
  value: string | null | undefined;
  onSave: (newValue: string) => Promise<void> | void;
  type?: "text" | "uf" | "cep";
  maxLength?: number;
  className?: string;
  placeholder?: string;
  onBlurExtra?: (value: string) => void;
}

const InlineEditableField = ({
  label,
  value,
  onSave,
  type = "text",
  maxLength,
  className,
  placeholder,
  onBlurExtra,
}: InlineEditableFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? "");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    if (saving) return;
    const next = type === "uf" ? draft.trim().toUpperCase() : draft.trim();
    if (next === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  return (
    <div className={cn("group relative min-w-0", className)}>
      <p className="text-xs text-muted-foreground uppercase font-medium mb-1 flex items-center gap-1">
        {label}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title={`Editar ${label}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </p>
      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              const v = type === "uf" ? e.target.value.toUpperCase() : e.target.value;
              setDraft(v);
            }}
            onBlur={() => onBlurExtra?.(draft)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") handleCancel();
            }}
            maxLength={maxLength}
            placeholder={placeholder}
            disabled={saving}
            className="h-7 text-sm"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="p-1 rounded hover:bg-muted text-success"
            title="Salvar"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="p-1 rounded hover:bg-muted text-destructive"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p
          className="text-sm font-semibold text-foreground cursor-pointer truncate"
          onClick={() => setEditing(true)}
          title="Clique para editar"
        >
          {value || "—"}
        </p>
      )}
    </div>
  );
};

export default InlineEditableField;
