import { useState, useCallback } from "react";
import { ClientFormData } from "@/services/clientService";
import { formatCPF } from "@/lib/formatters";
import { clientSchema } from "@/lib/validations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ClientFormProps {
  defaultValues?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => void;
  submitting: boolean;
}

const ClientForm = ({ defaultValues, onSubmit, submitting }: ClientFormProps) => {
  // Dados pessoais
  const [nomeCompleto, setNomeCompleto] = useState(defaultValues?.nome_completo || "");
  const [cpf, setCpf] = useState(defaultValues?.cpf || "");
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [email, setEmail] = useState(defaultValues?.email || "");

  // Endereço
  const [cep, setCep] = useState(defaultValues?.cep || "");
  const [endereco, setEndereco] = useState(defaultValues?.endereco || "");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState(defaultValues?.cidade || "");
  const [uf, setUf] = useState(defaultValues?.uf || "");
  const [fetchingCep, setFetchingCep] = useState(false);

  // Dívida
  const [credor, setCredor] = useState(defaultValues?.credor || "MAXFAMA");
  const [valorEntrada, setValorEntrada] = useState(defaultValues?.valor_entrada?.toString() || "");
  const [dataVencimento, setDataVencimento] = useState(defaultValues?.data_vencimento || "");
  const status = "pendente" as const;
  const [numeroParcela, setNumeroParcela] = useState(defaultValues?.numero_parcela?.toString() || "1");
  const [totalParcelas, setTotalParcelas] = useState(defaultValues?.total_parcelas?.toString() || "1");
  const [externalId, setExternalId] = useState(defaultValues?.external_id || "");

  // Opcionais
  const [valorParcela, setValorParcela] = useState(defaultValues?.valor_parcela?.toString() || "");
  const [valorPago, setValorPago] = useState(defaultValues?.valor_pago?.toString() || "0");
  const [observacoes, setObservacoes] = useState(defaultValues?.observacoes || "");

  const handleCepBlur = useCallback(async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setEndereco(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
        setUf(data.uf || "");
      }
    } catch {
      // silently fail
    } finally {
      setFetchingCep(false);
    }
  }, [cep]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      credor,
      nome_completo: nomeCompleto.trim(),
      cpf: cpf.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      external_id: externalId.trim() || undefined, // auto-gerado pelo serviço se vazio
      endereco: endereco.trim() || undefined,
      cidade: cidade.trim() || undefined,
      uf: uf.trim() || undefined,
      cep: cep.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
      numero_parcela: parseInt(numeroParcela) || 1,
      total_parcelas: parseInt(totalParcelas) || 1,
      valor_entrada: parseFloat(valorEntrada) || 0,
      valor_parcela: parseFloat(valorParcela) || 0,
      valor_pago: parseFloat(valorPago) || 0,
      data_vencimento: dataVencimento,
      status,
    };

    const result = clientSchema.safeParse(formData);
    if (!result.success) {
      const firstError = result.error.issues[0]?.message || "Dados inválidos";
      toast.error(firstError);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <p className="text-xs text-muted-foreground">* Campos obrigatórios</p>

      {/* ── Dados Pessoais ── */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-2 w-full">
          Dados Pessoais
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Label>Nome Completo <span className="text-destructive">*</span></Label>
            <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Nome do cliente" required maxLength={200} />
          </div>
          <div className="space-y-1.5">
            <Label>CPF <span className="text-destructive">*</span></Label>
            <Input value={cpf} onChange={(e) => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" maxLength={14} required />
          </div>
          <div className="space-y-1.5">
            <Label>Telefone (WhatsApp)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="5511999999999" maxLength={20} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="cliente@email.com" maxLength={255} />
          </div>
        </div>
      </fieldset>

      {/* ── Endereço ── */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-2 w-full">
          Endereço
        </legend>
        <div className="grid grid-cols-4 gap-3">
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Label>CEP</Label>
            <div className="relative">
              <Input
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                onBlur={handleCepBlur}
                placeholder="00000-000"
                maxLength={10}
              />
              {fetchingCep && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1 space-y-1.5">
            <Label>UF</Label>
            <Input value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} placeholder="SP" maxLength={2} />
          </div>
          <div className="col-span-4 sm:col-span-2 space-y-1.5">
            <Label>Endereço</Label>
            <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, número" maxLength={300} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Bairro</Label>
            <Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" maxLength={100} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" maxLength={100} />
          </div>
        </div>
      </fieldset>

      {/* ── Dados da Dívida ── */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-2 w-full">
          Dados da Dívida
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Credor <span className="text-destructive">*</span></Label>
            <Select value={credor} onValueChange={setCredor}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MAXFAMA">MAXFAMA</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Valor da Dívida (R$) <span className="text-destructive">*</span></Label>
            <Input type="number" step="0.01" min="0" value={valorEntrada} onChange={(e) => setValorEntrada(e.target.value)} placeholder="0,00" required />
          </div>
          <div className="space-y-1.5">
            <Label>Data de Vencimento <span className="text-destructive">*</span></Label>
            <Input type="date" value={dataVencimento} onChange={(e) => setDataVencimento(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Nº Parcela</Label>
            <Input type="number" min={1} value={numeroParcela} onChange={(e) => setNumeroParcela(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Total Parcelas</Label>
            <Input type="number" min={1} value={totalParcelas} onChange={(e) => setTotalParcelas(e.target.value)} disabled={!!defaultValues} />
          </div>
          <div className="space-y-1.5">
            <Label>ID Externo (contrato)</Label>
            <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="Gerado automaticamente se vazio" maxLength={100} />
          </div>
        </div>

        {/* Campos opcionais colapsáveis */}
        <Collapsible>
          <CollapsibleTrigger className="text-xs text-primary hover:underline cursor-pointer">
            + Campos opcionais (valor parcela, valor pago)
          </CollapsibleTrigger>
          <CollapsibleContent className="grid grid-cols-2 gap-3 pt-2">
            <div className="space-y-1.5">
              <Label>Valor da Parcela (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="0,00" />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Pago (R$)</Label>
              <Input type="number" step="0.01" min="0" value={valorPago} onChange={(e) => setValorPago(e.target.value)} placeholder="0,00" />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </fieldset>

      {/* ── Observações ── */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-semibold text-foreground border-b border-border pb-1 mb-2 w-full">
          Observações
        </legend>
        <Textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Anotações sobre o cliente"
          maxLength={1000}
          className="min-h-[60px]"
        />
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : defaultValues ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default ClientForm;
