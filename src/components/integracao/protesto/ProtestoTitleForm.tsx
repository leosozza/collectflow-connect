import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilePlus, Loader2 } from "lucide-react";
import { createProtestTitle } from "@/services/protestoService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const ESPECIE_OPTIONS = [
  { value: "DM", label: "DM - Duplicata Mercantil" },
  { value: "NP", label: "NP - Nota Promissória" },
  { value: "DS", label: "DS - Duplicata de Serviço" },
];

interface Props {
  onCreated: () => void;
}

const ProtestoTitleForm = ({ onCreated }: Props) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cpf: "",
    nome_devedor: "",
    valor: "",
    data_vencimento: "",
    numero_titulo: "",
    credor: "",
    especie: "DM",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant || !user) return;

    if (!form.cpf || !form.nome_devedor || !form.valor || !form.data_vencimento || !form.credor) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await createProtestTitle(
        {
          cpf: form.cpf,
          nome_devedor: form.nome_devedor,
          valor: parseFloat(form.valor),
          data_vencimento: form.data_vencimento,
          numero_titulo: form.numero_titulo || undefined,
          credor: form.credor,
          especie: form.especie,
        },
        tenant.id,
        user.id
      );
      toast({ title: "Título registrado", description: "Título enviado a protesto com sucesso" });
      setForm({ cpf: "", nome_devedor: "", valor: "", data_vencimento: "", numero_titulo: "", credor: "", especie: "DM" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Erro ao registrar título", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePlus className="w-5 h-5" />
          Envio Individual
        </CardTitle>
        <CardDescription>Registrar título para protesto</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>CPF do Devedor *</Label>
            <Input
              value={form.cpf}
              onChange={(e) => setForm((f) => ({ ...f, cpf: e.target.value }))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label>Nome do Devedor *</Label>
            <Input
              value={form.nome_devedor}
              onChange={(e) => setForm((f) => ({ ...f, nome_devedor: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Credor *</Label>
            <Input
              value={form.credor}
              onChange={(e) => setForm((f) => ({ ...f, credor: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor (R$) *</Label>
            <Input
              type="number"
              step="0.01"
              value={form.valor}
              onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Data de Vencimento *</Label>
            <Input
              type="date"
              value={form.data_vencimento}
              onChange={(e) => setForm((f) => ({ ...f, data_vencimento: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Nº do Título</Label>
            <Input
              value={form.numero_titulo}
              onChange={(e) => setForm((f) => ({ ...f, numero_titulo: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Espécie</Label>
            <Select value={form.especie} onValueChange={(v) => setForm((f) => ({ ...f, especie: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ESPECIE_OPTIONS.map((e) => (
                  <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Enviar a Protesto
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ProtestoTitleForm;
