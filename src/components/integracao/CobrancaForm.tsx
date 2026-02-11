import { useState, useCallback } from "react";
import { negociarieService } from "@/services/negociarieService";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Loader2, CreditCard, Check, Copy, ExternalLink } from "lucide-react";
import { formatCPF, formatPhone, formatCurrency, formatCEP } from "@/lib/formatters";

const UF_OPTIONS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface CobrancaFormProps {
  tenantId: string;
  onCreated: () => void;
}

interface CobrancaResult {
  tipo: string;
  id_geral: string;
  link_boleto?: string;
  linha_digitavel?: string;
  pix_copia_cola?: string;
  link_cartao?: string;
}

const CobrancaForm = ({ tenantId, onCreated }: CobrancaFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tipo, setTipo] = useState("boleto");
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<CobrancaResult | null>(null);
  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    email: "",
    telefone: "",
    valor: "",
    vencimento: "",
    descricao: "",
    cep: "",
    endereco: "",
    bairro: "",
    cidade: "",
    uf: "",
  });

  const fetchAddressByCep = useCallback(async (cep: string) => {
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setForm((prev) => ({
          ...prev,
          endereco: data.logradouro || prev.endereco,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
      }
    } catch {
      // silently ignore - user can fill manually
    }
  }, []);

  const handleChange = (field: string, value: string) => {
    if (field === "cpf") {
      setForm((prev) => ({ ...prev, cpf: formatCPF(value) }));
    } else if (field === "telefone") {
      setForm((prev) => ({ ...prev, telefone: formatPhone(value) }));
    } else if (field === "cep") {
      const formatted = formatCEP(value);
      setForm((prev) => ({ ...prev, cep: formatted }));
      const digits = formatted.replace(/\D/g, "");
      if (digits.length === 8) fetchAddressByCep(digits);
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  };

  const validate = (): string | null => {
    if (!form.nome.trim()) return "Nome é obrigatório";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) return "CPF deve ter 11 dígitos";
    const valor = Number(form.valor);
    if (!valor || valor <= 0) return "Valor deve ser maior que zero";
    if (!form.vencimento) return "Vencimento é obrigatório";
    const today = new Date().toISOString().split("T")[0];
    if (form.vencimento < today) return "Vencimento não pode ser no passado";
    const cepDigits = form.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return "CEP deve ter 8 dígitos";
    if (!form.endereco.trim()) return "Endereço é obrigatório";
    if (!form.bairro.trim()) return "Bairro é obrigatório";
    if (!form.cidade.trim()) return "Cidade é obrigatória";
    if (!form.uf) return "UF é obrigatório";
    return null;
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const error = validate();
    if (error) {
      toast({ title: "Validação", description: error, variant: "destructive" });
      return;
    }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setLoading(true);
    try {
      const idGeral = `COB-${Date.now()}`;
      const payload = {
        id_geral: idGeral,
        devedor: {
          documento: form.cpf.replace(/\D/g, ""),
          razao_social: form.nome.trim(),
          cep: form.cep.replace(/\D/g, ""),
          endereco: form.endereco.trim(),
          bairro: form.bairro.trim(),
          cidade: form.cidade.trim(),
          uf: form.uf,
          email: form.email.trim() || "nao@informado.com",
          celular: form.telefone.replace(/\D/g, "") || "00000000000",
        },
        parcelas: [
          {
            valor: Number(form.valor),
            data_vencimento: form.vencimento,
            descricao: form.descricao.trim() || `Cobrança ${tipo}`,
          },
        ],
        sandbox: false,
      };

      let apiResult;
      if (tipo === "boleto") {
        apiResult = await negociarieService.novaCobranca(payload);
      } else if (tipo === "pix") {
        apiResult = await negociarieService.novaPix(payload);
      } else {
        apiResult = await negociarieService.novaCartao(payload);
      }

      const idGeral2 = apiResult.id_geral || apiResult.idGeral || idGeral;
      const linkBoleto = apiResult.link_boleto || apiResult.linkBoleto || null;
      const pixCopiaCola = apiResult.pix_copia_cola || apiResult.pixCopiaCola || null;
      const linkCartao = apiResult.link_cartao || apiResult.linkCartao || null;
      const linhaDigitavel = apiResult.linha_digitavel || apiResult.linhaDigitavel || null;

      await negociarieService.saveCobranca({
        tenant_id: tenantId,
        client_id: null,
        id_geral: idGeral2,
        id_parcela: apiResult.id_parcela || apiResult.idParcela || null,
        tipo,
        status: "pendente",
        valor: Number(form.valor),
        data_vencimento: form.vencimento,
        link_boleto: linkBoleto,
        pix_copia_cola: pixCopiaCola,
        link_cartao: linkCartao,
        linha_digitavel: linhaDigitavel,
      });

      setResult({
        tipo,
        id_geral: idGeral2,
        link_boleto: linkBoleto || undefined,
        linha_digitavel: linhaDigitavel || undefined,
        pix_copia_cola: pixCopiaCola || undefined,
        link_cartao: linkCartao || undefined,
      });

      toast({ title: "Cobrança gerada!", description: `${tipo.charAt(0).toUpperCase() + tipo.slice(1)} criado com sucesso` });
      setForm({ nome: "", cpf: "", email: "", telefone: "", valor: "", vencimento: "", descricao: "", cep: "", endereco: "", bairro: "", cidade: "", uf: "" });
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro ao gerar cobrança", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: `${label} copiado para a área de transferência` });
  };

  const tipoLabel = tipo === "boleto" ? "Boleto" : tipo === "pix" ? "Pix" : "Cartão de Crédito";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Nova Cobrança
          </CardTitle>
          <CardDescription>Gerar boleto, pix ou link de cartão via Negociarie</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePreSubmit} className="space-y-4">
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
                <Input value={form.nome} onChange={(e) => handleChange("nome", e.target.value)} placeholder="Nome completo" maxLength={200} />
              </div>
              <div className="space-y-1.5">
                <Label>CPF *</Label>
                <Input value={form.cpf} onChange={(e) => handleChange("cpf", e.target.value)} placeholder="000.000.000-00" maxLength={14} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="email@exemplo.com" maxLength={255} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => handleChange("telefone", e.target.value)} placeholder="(00) 00000-0000" maxLength={15} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => handleChange("valor", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento *</Label>
                <Input type="date" value={form.vencimento} onChange={(e) => handleChange("vencimento", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>CEP *</Label>
                <Input value={form.cep} onChange={(e) => handleChange("cep", e.target.value)} placeholder="00000-000" maxLength={9} />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço *</Label>
                <Input value={form.endereco} onChange={(e) => handleChange("endereco", e.target.value)} placeholder="Rua, número" maxLength={300} />
              </div>
              <div className="space-y-1.5">
                <Label>Bairro *</Label>
                <Input value={form.bairro} onChange={(e) => handleChange("bairro", e.target.value)} placeholder="Bairro" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>Cidade *</Label>
                <Input value={form.cidade} onChange={(e) => handleChange("cidade", e.target.value)} placeholder="Cidade" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label>UF *</Label>
                <Select value={form.uf} onValueChange={(v) => handleChange("uf", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
                <Label>Descrição</Label>
                <Input value={form.descricao} onChange={(e) => handleChange("descricao", e.target.value)} placeholder="Descrição da cobrança" maxLength={500} />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CreditCard className="w-4 h-4 mr-2" />}
              Gerar {tipoLabel}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Cobrança</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Confira os dados antes de gerar:</p>
                <div className="rounded-md border p-3 space-y-1 bg-muted/50">
                  <p><strong>Tipo:</strong> {tipoLabel}</p>
                  <p><strong>Nome:</strong> {form.nome}</p>
                  <p><strong>CPF:</strong> {form.cpf}</p>
                  <p><strong>Valor:</strong> {formatCurrency(Number(form.valor) || 0)}</p>
                  <p><strong>Vencimento:</strong> {form.vencimento ? new Date(form.vencimento + "T00:00:00").toLocaleDateString("pt-BR") : "-"}</p>
                  <p><strong>Endereço:</strong> {form.endereco}, {form.cidade} - {form.uf}, CEP {form.cep}</p>
                  {form.email && <p><strong>Email:</strong> {form.email}</p>}
                  {form.telefone && <p><strong>Telefone:</strong> {form.telefone}</p>}
                  {form.descricao && <p><strong>Descrição:</strong> {form.descricao}</p>}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit}>Confirmar e Gerar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Result Card */}
      {result && (
        <Card className="border-emerald-300 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <Check className="w-5 h-5" />
              Cobrança Gerada com Sucesso
            </CardTitle>
            <CardDescription>ID: {result.id_geral} • Tipo: {result.tipo}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {result.link_boleto && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium min-w-[100px]">Link Boleto:</span>
                <Button size="sm" variant="outline" asChild>
                  <a href={result.link_boleto} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.link_boleto!, "Link do boleto")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            {result.linha_digitavel && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Linha Digitável:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{result.linha_digitavel}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.linha_digitavel!, "Linha digitável")}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {result.pix_copia_cola && (
              <div className="space-y-1">
                <span className="text-sm font-medium">Pix Copia e Cola:</span>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted p-2 rounded flex-1 break-all">{result.pix_copia_cola}</code>
                  <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.pix_copia_cola!, "Pix Copia e Cola")}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}
            {result.link_cartao && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium min-w-[100px]">Link Cartão:</span>
                <Button size="sm" variant="outline" asChild>
                  <a href={result.link_cartao} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Abrir
                  </a>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => copyToClipboard(result.link_cartao!, "Link do cartão")}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
            <Button size="sm" variant="secondary" onClick={() => setResult(null)} className="mt-2">
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default CobrancaForm;
