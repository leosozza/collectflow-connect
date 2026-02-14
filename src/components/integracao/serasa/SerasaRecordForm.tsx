import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FilePlus, Loader2 } from "lucide-react";
import { createSerasaRecord } from "@/services/serasaService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Props {
  onCreated: () => void;
}

const SerasaRecordForm = ({ onCreated }: Props) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    cpf: "",
    nome_devedor: "",
    valor: "",
    data_vencimento: "",
    numero_contrato: "",
    credor: "",
    natureza_operacao: "COBRANCA",
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
      await createSerasaRecord(
        {
          cpf: form.cpf,
          nome_devedor: form.nome_devedor,
          valor: parseFloat(form.valor),
          data_vencimento: form.data_vencimento,
          numero_contrato: form.numero_contrato || undefined,
          credor: form.credor,
          natureza_operacao: form.natureza_operacao,
        },
        tenant.id,
        user.id
      );
      toast({ title: "Negativação registrada", description: "Registro enviado ao Serasa com sucesso" });
      setForm({ cpf: "", nome_devedor: "", valor: "", data_vencimento: "", numero_contrato: "", credor: "", natureza_operacao: "COBRANCA" });
      onCreated();
    } catch (err: any) {
      toast({ title: "Erro ao registrar negativação", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FilePlus className="w-5 h-5" />
          Negativação Individual
        </CardTitle>
        <CardDescription>Registrar negativação no Serasa</CardDescription>
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
            <Label>Nº do Contrato</Label>
            <Input
              value={form.numero_contrato}
              onChange={(e) => setForm((f) => ({ ...f, numero_contrato: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Natureza da Operação</Label>
            <Input
              value={form.natureza_operacao}
              onChange={(e) => setForm((f) => ({ ...f, natureza_operacao: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Negativar no Serasa
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default SerasaRecordForm;
