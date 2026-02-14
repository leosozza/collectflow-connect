import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { batchCreateSerasaRecords } from "@/services/serasaService";
import { useTenant } from "@/hooks/useTenant";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface PreviewClient {
  cpf: string;
  nome_completo: string;
  credor: string;
  valor_parcela: number;
  data_vencimento: string;
}

interface Props {
  onCreated: () => void;
}

const SerasaBatchDialog = ({ onCreated }: Props) => {
  const { tenant } = useTenant();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<PreviewClient[]>([]);

  const [filters, setFilters] = useState({
    credor: "",
    dias_atraso_min: "30",
    valor_min: "",
    valor_max: "",
  });

  const handleSearch = async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const diasAtraso = parseInt(filters.dias_atraso_min) || 30;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - diasAtraso);

      let query = supabase
        .from("clients")
        .select("cpf, nome_completo, credor, valor_parcela, data_vencimento")
        .eq("status", "pendente")
        .lte("data_vencimento", cutoffDate.toISOString().split("T")[0])
        .limit(500);

      if (filters.credor) query = query.ilike("credor", `%${filters.credor}%`);
      if (filters.valor_min) query = query.gte("valor_parcela", parseFloat(filters.valor_min));
      if (filters.valor_max) query = query.lte("valor_parcela", parseFloat(filters.valor_max));

      const { data, error } = await query;
      if (error) throw error;

      const cpfMap = new Map<string, PreviewClient>();
      (data || []).forEach((c: any) => {
        if (!cpfMap.has(c.cpf)) {
          cpfMap.set(c.cpf, c);
        }
      });
      setPreview(Array.from(cpfMap.values()));
    } catch (e: any) {
      toast({ title: "Erro na busca", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!tenant || !user || preview.length === 0) return;
    setSending(true);
    try {
      const records = preview.map((c) => ({
        cpf: c.cpf,
        nome_devedor: c.nome_completo,
        valor: c.valor_parcela,
        data_vencimento: c.data_vencimento,
        credor: c.credor,
      }));
      await batchCreateSerasaRecords(records, tenant.id, user.id);
      toast({ title: "Lote enviado", description: `${records.length} negativação(ões) registrada(s)` });
      setOpen(false);
      setPreview([]);
      onCreated();
    } catch (e: any) {
      toast({ title: "Erro no envio em lote", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="w-4 h-4" />
          Envio em Lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Negativação em Lote - Serasa</DialogTitle>
          <DialogDescription>
            Filtre os devedores e envie múltiplas negativações de uma vez
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Credor</Label>
            <Input
              value={filters.credor}
              onChange={(e) => setFilters((f) => ({ ...f, credor: e.target.value }))}
              placeholder="Filtrar por credor"
            />
          </div>
          <div className="space-y-2">
            <Label>Dias de Atraso Mínimo</Label>
            <Input
              type="number"
              value={filters.dias_atraso_min}
              onChange={(e) => setFilters((f) => ({ ...f, dias_atraso_min: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor Mínimo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={filters.valor_min}
              onChange={(e) => setFilters((f) => ({ ...f, valor_min: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Valor Máximo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={filters.valor_max}
              onChange={(e) => setFilters((f) => ({ ...f, valor_max: e.target.value }))}
            />
          </div>
        </div>

        <Button onClick={handleSearch} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          Buscar Devedores
        </Button>

        {preview.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{preview.length} devedor(es) encontrado(s)</Badge>
            </div>
            <div className="max-h-60 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CPF</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Credor</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((c) => (
                    <TableRow key={c.cpf}>
                      <TableCell className="font-mono text-xs">{c.cpf}</TableCell>
                      <TableCell>{c.nome_completo}</TableCell>
                      <TableCell>{c.credor}</TableCell>
                      <TableCell className="text-right">
                        R$ {c.valor_parcela.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={handleSend} disabled={sending} className="w-full gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Negativar {preview.length} Devedor(es)
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SerasaBatchDialog;
