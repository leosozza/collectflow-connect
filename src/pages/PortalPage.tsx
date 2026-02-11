import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, FileText, Handshake } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";

interface DebtItem {
  nome_completo: string;
  credor: string;
  numero_parcela: number;
  total_parcelas: number;
  valor_parcela: number;
  valor_pago: number;
  data_vencimento: string;
  status: string;
}

const PortalPage = () => {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { toast } = useToast();
  const [cpf, setCpf] = useState("");
  const [debts, setDebts] = useState<DebtItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showAgreementForm, setShowAgreementForm] = useState(false);
  const [agreementNote, setAgreementNote] = useState("");
  const [submittingAgreement, setSubmittingAgreement] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11) {
      toast({ title: "CPF inválido", description: "Informe um CPF com 11 dígitos.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const { data, error } = await supabase.functions.invoke("portal-lookup", {
        body: { cpf: cleanCpf, tenant_slug: tenantSlug },
      });
      if (error) throw error;
      setDebts(data?.debts || []);
    } catch (err: any) {
      toast({ title: "Erro na consulta", description: err.message, variant: "destructive" });
      setDebts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAgreementRequest = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    setSubmittingAgreement(true);
    try {
      const { error } = await supabase.functions.invoke("portal-lookup", {
        body: { cpf: cleanCpf, tenant_slug: tenantSlug, action: "request_agreement", notes: agreementNote },
      });
      if (error) throw error;
      toast({ title: "Solicitação enviada!", description: "A empresa analisará sua proposta." });
      setShowAgreementForm(false);
      setAgreementNote("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingAgreement(false);
    }
  };

  const statusLabels: Record<string, string> = { pendente: "Pendente", pago: "Pago", quebrado: "Quebrado" };

  return (
    <div className="min-h-screen bg-muted/30 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <FileText className="w-12 h-12 mx-auto text-primary" />
          <h1 className="text-2xl font-bold">Portal do Devedor</h1>
          <p className="text-muted-foreground">Consulte suas pendências financeiras</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Digite seu CPF (somente números)"
                  value={cpf}
                  onChange={e => setCpf(e.target.value)}
                  maxLength={14}
                />
              </div>
              <Button type="submit" disabled={loading}>
                <Search className="w-4 h-4 mr-2" /> {loading ? "Buscando..." : "Consultar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {searched && debts.length === 0 && !loading && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Nenhuma pendência encontrada para este CPF.
            </CardContent>
          </Card>
        )}

        {debts.length > 0 && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Suas Pendências</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Credor</TableHead>
                        <TableHead>Parcela</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead>Vencimento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debts.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell>{d.credor}</TableCell>
                          <TableCell>{d.numero_parcela}/{d.total_parcelas}</TableCell>
                          <TableCell className="text-right">{formatCurrency(d.valor_parcela)}</TableCell>
                          <TableCell>{format(new Date(d.data_vencimento + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant={d.status === "pendente" ? "outline" : d.status === "pago" ? "default" : "destructive"}>
                              {statusLabels[d.status] || d.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {!showAgreementForm ? (
                  <Button variant="outline" className="w-full" onClick={() => setShowAgreementForm(true)}>
                    <Handshake className="w-4 h-4 mr-2" /> Solicitar Acordo
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <Label>Descreva sua proposta de acordo</Label>
                    <Textarea
                      rows={3}
                      value={agreementNote}
                      onChange={e => setAgreementNote(e.target.value)}
                      placeholder="Ex: Gostaria de parcelar em 6x com desconto..."
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleAgreementRequest} disabled={submittingAgreement || !agreementNote.trim()}>
                        {submittingAgreement ? "Enviando..." : "Enviar Solicitação"}
                      </Button>
                      <Button variant="outline" onClick={() => setShowAgreementForm(false)}>Cancelar</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalPage;
