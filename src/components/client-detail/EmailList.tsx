import { useState } from "react";
import { Mail, ChevronDown, Pencil, Loader2, Check, X } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { upsertClientProfile } from "@/services/clientProfileService";
import { cleanCPF } from "@/lib/cpfUtils";

interface EmailListProps {
  emails: string[];
  tenantId?: string;
  cpf?: string;
  credor?: string;
  currentEmail?: string;
}

const emailSchema = z
  .string()
  .trim()
  .max(255, "E-mail muito longo")
  .email("E-mail inválido")
  .or(z.literal(""));

export const EmailList = ({ emails, tenantId, cpf, credor, currentEmail }: EmailListProps) => {
  const unique = Array.from(new Set(emails.filter((e) => !!e && e.trim().length > 0)));
  const first = unique[0];
  const extra = unique.length - 1;

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentEmail || first || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const canEdit = !!tenantId && !!cpf;

  const handleSave = async () => {
    const parsed = emailSchema.safeParse(value);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "E-mail inválido");
      return;
    }
    if (!tenantId || !cpf) return;
    setSaving(true);
    try {
      const clean = cleanCPF(cpf);
      const newEmail = parsed.data.trim();

      // 1) Atualiza fonte canônica (client_profiles)
      await upsertClientProfile(tenantId, clean, { email: newEmail }, "manual_edit_header");

      // 2) Sincroniza coluna clients.email para todas as linhas do CPF (e credor, quando informado)
      let q = supabase.from("clients").update({ email: newEmail || null }).eq("tenant_id", tenantId).eq("cpf", clean);
      if (credor) q = q.eq("credor", credor);
      const { error } = await q;
      if (error) throw error;

      toast.success("E-mail atualizado");
      setEditing(false);
      await queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar e-mail");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="inline-block">
      <div className="group/email flex items-center gap-1.5 mb-1">
        <p className="text-xs text-muted-foreground uppercase font-medium">Email</p>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => {
              setValue(currentEmail || first || "");
              setEditing(true);
            }}
            className="text-muted-foreground/70 hover:text-foreground transition-opacity opacity-0 group-hover/email:opacity-100 focus-visible:opacity-100"
            title="Editar e-mail"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex items-center gap-1">
          <Input
            type="email"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="email@exemplo.com"
            autoFocus
            disabled={saving}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className="h-8 text-sm w-[260px]"
          />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-success" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setEditing(false)}
            disabled={saving}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <HoverCard openDelay={120} closeDelay={150}>
          <HoverCardTrigger asChild>
            <button
              type="button"
              disabled={unique.length === 0}
              className="inline-flex items-center gap-2 px-2 py-1 rounded-md border border-border/60 bg-card hover:bg-muted/40 transition-colors group disabled:cursor-default disabled:hover:bg-card max-w-full"
            >
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              {unique.length === 0 ? (
                <span className="text-xs text-muted-foreground">Nenhum cadastrado</span>
              ) : (
                <>
                  <span className="text-sm font-semibold text-foreground truncate">{first}</span>
                  {extra > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">+{extra}</span>
                  )}
                </>
              )}
              {unique.length > 1 && (
                <ChevronDown className="w-3 h-3 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0" />
              )}
            </button>
          </HoverCardTrigger>

          {unique.length > 1 && (
            <HoverCardContent align="start" className="w-[360px] p-2">
              <div className="space-y-1">
                {unique.map((email) => (
                  <div
                    key={email}
                    className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/40 transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground break-all">{email}</span>
                  </div>
                ))}
              </div>
            </HoverCardContent>
          )}
        </HoverCard>
      )}
    </div>
  );
};

export default EmailList;
