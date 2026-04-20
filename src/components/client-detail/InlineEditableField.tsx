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
  /** Aplica destaque temporário (ring) — usado quando o campo foi auto-preenchido. */
  highlight?: boolean;
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
  // Optimistic display value: shown imediately after save, reverted on error.
  const [optimisticValue, setOptimisticValue] = useState<string | null>(null);
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
      lastLookupRef.current = "";
    }
  }, [value, editing]);

  // Quando o valor canônico (vindo do servidor) alcança o otimista, limpamos.
  useEffect(() => {
    if (optimisticValue !== null && (value ?? "") === optimisticValue) {
      setOptimisticValue(null);
    }
  }, [value, optimisticValue]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  // Auto-lookup CEP when 8 digits are typed
  useEffect(() => {
    if (type !== "cep" || !editing) return;
    const digits = draft.replace(/\D/g, "");
    if (digits.length !== 8) return;
    if (lastLookupRef.current === digits) return;
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
    // Optimistic: aplica visualmente e fecha edição já.
    const previous = value ?? "";
    setOptimisticValue(next);
    setEditing(false);
    setSaving(true);
    try {
      await onSave(next);
      // Sucesso: o useEffect acima vai limpar optimisticValue quando o server alcançar.
    } catch {
      // Reverte visualmente
      setOptimisticValue(null);
      setDraft(previous);
      // O onSave já mostra o toast de erro; não duplicamos aqui.
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

  const displayValue = optimisticValue !== null ? optimisticValue : value;

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
        {saving && (
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" aria-label="Salvando" />
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
              className="h-7 text-sm pr-7"
            />
            {cepLoading && (
              <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            )}
          </div>
          <button
            type="button"
            onClick={handleSave}
            className="p-1 rounded hover:bg-muted text-success"
            title="Salvar"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded hover:bg-muted text-destructive"
            title="Cancelar"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <p
          className={cn(
            "text-sm font-semibold cursor-pointer truncate transition-colors",
            optimisticValue !== null ? "text-muted-foreground italic" : "text-foreground"
          )}
          onClick={() => setEditing(true)}
          title="Clique para editar"
        >
          {displayValue || "—"}
        </p>
      )}
    </div>
  );
};

export default InlineEditableField;
