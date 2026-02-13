import { useState } from "react";
import { ClientFormData } from "@/services/clientService";
import { formatCPF } from "@/lib/formatters";
import { clientSchema } from "@/lib/validations";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ClientFormProps {
  defaultValues?: Partial<ClientFormData>;
  onSubmit: (data: ClientFormData) => void;
  submitting: boolean;
}

const ClientForm = ({ defaultValues, onSubmit, submitting }: ClientFormProps) => {
  const [credor, setCredor] = useState(defaultValues?.credor || "MAXFAMA");
  const [nomeCompleto, setNomeCompleto] = useState(defaultValues?.nome_completo || "");
  const [cpf, setCpf] = useState(defaultValues?.cpf || "");
  const [numeroParcela, setNumeroParcela] = useState(
    defaultValues?.numero_parcela?.toString() || "1"
  );
  const [totalParcelas, setTotalParcelas] = useState(
    defaultValues?.total_parcelas?.toString() || "1"
  );
  const [valorEntrada, setValorEntrada] = useState(
    defaultValues?.valor_entrada?.toString() || ""
  );
  const [valorParcela, setValorParcela] = useState(
    defaultValues?.valor_parcela?.toString() || ""
  );
  const [valorPago, setValorPago] = useState(
    defaultValues?.valor_pago?.toString() || "0"
  );
  const [dataVencimento, setDataVencimento] = useState(
    defaultValues?.data_vencimento || ""
  );
  const [status, setStatus] = useState<"pendente" | "pago" | "quebrado">(
    defaultValues?.status || "pendente"
  );
  const [phone, setPhone] = useState(defaultValues?.phone || "");
  const [email, setEmail] = useState(defaultValues?.email || "");
  const [externalId, setExternalId] = useState(defaultValues?.external_id || "");
  const [endereco, setEndereco] = useState(defaultValues?.endereco || "");
  const [cidade, setCidade] = useState(defaultValues?.cidade || "");
  const [uf, setUf] = useState(defaultValues?.uf || "");
  const [cep, setCep] = useState(defaultValues?.cep || "");
  const [observacoes, setObservacoes] = useState(defaultValues?.observacoes || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = {
      credor,
      nome_completo: nomeCompleto.trim(),
      cpf: cpf.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      external_id: externalId.trim() || undefined,
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
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-2">
          <Label>Nome Completo</Label>
          <Input
            value={nomeCompleto}
            onChange={(e) => setNomeCompleto(e.target.value)}
            placeholder="Nome do cliente"
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label>CPF</Label>
          <Input
            value={cpf}
            onChange={(e) => setCpf(formatCPF(e.target.value))}
            placeholder="000.000.000-00"
            maxLength={14}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Telefone (WhatsApp)</Label>
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5511999999999"
            maxLength={20}
          />
        </div>

        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="cliente@email.com"
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <Label>ID Externo</Label>
          <Input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="Contrato, ID CRM, etc."
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label>Credor</Label>
          <Select value={credor} onValueChange={setCredor}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MAXFAMA">MAXFAMA</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Nº da Parcela</Label>
          <Input
            type="number"
            min={1}
            value={numeroParcela}
            onChange={(e) => setNumeroParcela(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Total de Parcelas</Label>
          <Input
            type="number"
            min={1}
            value={totalParcelas}
            onChange={(e) => setTotalParcelas(e.target.value)}
            required
            disabled={!!defaultValues}
          />
        </div>

        <div className="space-y-2">
          <Label>Data de Vencimento</Label>
          <Input
            type="date"
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Valor de Entrada (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valorEntrada}
            onChange={(e) => setValorEntrada(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Valor das Demais Parcelas (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valorParcela}
            onChange={(e) => setValorParcela(e.target.value)}
            placeholder="0,00"
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Valor Pago (R$)</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={valorPago}
            onChange={(e) => setValorPago(e.target.value)}
            placeholder="0,00"
          />
        </div>

        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="pago">Pago</SelectItem>
              <SelectItem value="quebrado">Quebrado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 space-y-2">
          <Label>Endereço</Label>
          <Input
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua, número, bairro"
            maxLength={300}
          />
        </div>

        <div className="space-y-2">
          <Label>Cidade</Label>
          <Input
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Cidade"
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <Label>UF</Label>
          <Input
            value={uf}
            onChange={(e) => setUf(e.target.value.toUpperCase())}
            placeholder="SP"
            maxLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label>CEP</Label>
          <Input
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            placeholder="00000-000"
            maxLength={10}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label>Observações</Label>
          <textarea
            className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Anotações sobre o cliente"
            maxLength={1000}
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Salvando..." : defaultValues ? "Atualizar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
};

export default ClientForm;
