import { useState, useRef, useEffect } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCEP } from "@/lib/formatters";
import { lookupCepDetailed, type ViaCepResult } from "@/lib/viaCep";
import { toast } from "sonner";

interface InlineEditableFieldProps {
  label: string;
  value: string | null | undefined;
  onSave: (newValue: string) => Promise<void> | void;
  type?: "text" | "uf" | "cep";
  maxLength?: number;
  className?: string;
  placeholder?: string;
  onBlurExtra?: (value: string) => void;
  onCepResolved?: (data: ViaCepResult) => void | Promise<void>;
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
  onCepResolved,
}: InlineEditableFieldProps) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value ?? "");
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastLookupRef = useRef<string>("");
  const onCepResolvedRef = useRef(onCepResolved);

  useEffect(() => {
    onCepResolvedRef.current = onCepResolved;
  }, [onCepResolved]);

  useEffect(() => {
    if (!editing) {
      setDraft(value ?? "");
      // Reset lookup guard when exiting edit mode so reopening allows a fresh lookup
      lastLookupRef.current = "";
    }
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Auto-lookup CEP when 8 digits are typed (callback ref-based to avoid re-runs from parent re-renders)
  useEffect(() => {
    if (type !== "cep" || !editing) return;
    const digits = draft.replace(/\D/g, "");
    if (digits.length !== 8) return;
    if (lastLookupRef.current === digits) return;
    // Mark as resolved BEFORE async work to fully block any re-entry
    lastLookupRef.current = digits;

    let cancelled = false;
    const handle = setTimeout(async () => {
      setCepLoading(true);
      try {
        const res = await lookupCepDetailed(digits);
        if (cancelled) return;
        if (res.ok) {
          await onCepResolvedRef.current?.(res.data);
        } else {
          const reason = (res as { ok: false; reason: string }).reason;
          if (reason === "not_found") toast.error("CEP não encontrado");
          else if (reason === "network") toast.error("Falha ao consultar CEP");
          // Allow retry on error
          lastLookupRef.current = "";
        }
      } finally {
        if (!cancelled) setCepLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [draft, type, editing]);

  const handleSave = async () => {
    if (saving) return;
    let next = draft.trim();
    if (type === "uf") next = next.toUpperCase();
    if (type === "cep") next = formatCEP(next);
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

  const handleChange = (raw: string) => {
    if (type === "uf") {
      setDraft(raw.toUpperCase());
    } else if (type === "cep") {
      setDraft(formatCEP(raw));
    } else {
      setDraft(raw);
    }
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
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              onBlur={() => onBlurExtra?.(draft)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              maxLength={maxLength}
              placeholder={placeholder}
              disabled={saving}
              className="h-7 text-sm pr-7"
            />
            {cepLoading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
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
