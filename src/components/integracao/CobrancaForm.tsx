import { useState } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CreditCard } from "lucide-react";

interface CobrancaFormProps {
  tenantId: string;
  onCreated: () => void;
}

const CobrancaForm = ({ tenantId, onCreated }: CobrancaFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("boleto");
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    valor: "",
    vencimento: "",
    descricao: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome || !form.cpf || !form.valor || !form.vencimento) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome, CPF, valor e vencimento", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        nome: form.nome.trim(),
        cpf: form.cpf.replace(/\D/g, ""),
        email: form.email.trim() || undefined,
        telefone: form.telefone.replace(/\D/g, "") || undefined,
        valor: Number(form.valor),
        vencimento: form.vencimento,
        descricao: form.descricao.trim() || `Cobrança ${tipo}`,
      };

      let result;
      if (tipo === "boleto") {
        result = await negociarieService.novaCobranca(payload);
      } else if (tipo === "pix") {
        result = await negociarieService.novaPix(payload);
      } else {
        result = await negociarieService.novaCartao(payload);
      }

      // Save to local DB
      await negociarieService.saveCobranca({
        tenant_id: tenantId,
        client_id: null, // Can be linked later
        id_geral: result.id_geral || result.idGeral || String(result.id || ""),
        id_parcela: result.id_parcela || result.idParcela || null,
        tipo,
        status: "pendente",
        valor: Number(form.valor),
        data_vencimento: form.vencimento,
        link_boleto: result.link_boleto || result.linkBoleto || null,
        pix_copia_cola: result.pix_copia_cola || result.pixCopiaCola || null,
        link_cartao: result.link_cartao || result.linkCartao || null,
        linha_digitavel: result.linha_digitavel || result.linhaDigitavel || null,
      });

      toast({ title: "Cobrança gerada!", description: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} criado com sucesso` });
      setForm({ nome: "", cpf: "", email: "", telefone: "", valor: "", vencimento: "", descricao: "" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro ao gerar cobrança", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Nova Cobrança
        </CardTitle>
        <CardDescription>Gerar boleto, pix ou link de cartão via Negociarie</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão de Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => handleChange("nome", e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-1.5">
              <Label>CPF *</Label>
              <Input value={form.cpf} onChange={(e) => handleChange("cpf", e.target.value)} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" value={form.valor} onChange={(e) => handleChange("valor", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>Vencimento *</Label>
              <Input type="date" value={form.vencimento} onChange={(e) => handleChange("vencimento", e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Descrição</Label>
              <Input value={form.descricao} onChange={(e) => handleChange("descricao", e.target.value)} placeholder="Descrição da cobrança" />
            </div>
          </div>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
            Gerar {tipo === "boleto" ? "Boleto" : tipo === "pix" ? "Pix" : "Link de Cartão"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CobrancaForm;
