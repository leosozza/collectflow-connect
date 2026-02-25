import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SupportScheduleTab = () => {
  const { user, profile } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    date: "",
    time: "",
    subject: "",
    notes: "",
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!user || !tenant) throw new Error("Não autenticado");
      const preferred = new Date(`${form.date}T${form.time}:00`);
      const { error } = await supabase.from("support_schedule_requests").insert({
        tenant_id: tenant.id,
        user_id: user.id,
        preferred_date: preferred.toISOString(),
        subject: form.subject,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({ title: "Reunião solicitada!", description: "Entraremos em contato para confirmar." });
    },
    onError: () => toast({ title: "Erro ao agendar", variant: "destructive" }),
  });

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3">
        <CheckCircle2 className="w-12 h-12 text-primary" />
        <h3 className="font-semibold text-foreground">Solicitação Enviada!</h3>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Nossa equipe receberá sua solicitação e entrará em contato para confirmar o horário.
        </p>
        <Button size="sm" variant="outline" onClick={() => { setSubmitted(false); setForm({ date: "", time: "", subject: "", notes: "" }); }}>
          Agendar outra reunião
        </Button>
      </div>
    );
  }

  const isValid = form.date && form.time && form.subject.trim();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 pb-2">
        <CalendarDays className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">Agendar Reunião com Suporte</h3>
          <p className="text-[10px] text-muted-foreground">Escolha a melhor data e horário para conversarmos.</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-xs">Assunto *</Label>
          <Input
            placeholder="Ex: Dúvida sobre importação de clientes"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            className="h-8 text-xs mt-1"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Data preferida *</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              className="h-8 text-xs mt-1"
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div>
            <Label className="text-xs">Horário *</Label>
            <Input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="h-8 text-xs mt-1"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Observações</Label>
          <Textarea
            placeholder="Detalhes adicionais..."
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            className="text-xs mt-1 min-h-[60px]"
          />
        </div>
        <Button
          onClick={() => submit.mutate()}
          disabled={!isValid || submit.isPending}
          className="w-full text-xs"
          size="sm"
        >
          {submit.isPending ? "Enviando..." : "Solicitar Agendamento"}
        </Button>
      </div>
    </div>
  );
};

export default SupportScheduleTab;
