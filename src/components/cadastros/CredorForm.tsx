import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "@/hooks/useTenant";
import { upsertCredor } from "@/services/cadastrosService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, Pencil, Copy, Upload, ImageIcon, FileText } from "lucide-react";
import CredorReguaTab from "./CredorReguaTab";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const BANCOS = ["Banco do Brasil", "Itaú", "Bradesco", "Santander", "Caixa Econômica", "Nubank", "Inter", "Sicoob", "Sicredi", "Safra", "BTG Pactual", "Outro"];
const GATEWAYS = ["Negociarie", "Asaas", "Mercado Pago", "PagSeguro", "Outro"];

const TEMPLATE_ACORDO_DEFAULT = "Pelo presente instrumento, {razao_social_credor}, CNPJ {cnpj_credor}, e {nome_devedor}, CPF {cpf_devedor}, acordam o pagamento da dívida no valor de R$ {valor_divida}, com desconto de {desconto_concedido}%, totalizando R$ {valor_acordo}, em {quantidade_parcelas} parcelas de R$ {valor_parcela}, vencendo a primeira em {data_vencimento}.";
const TEMPLATE_RECIBO_DEFAULT = "Recebi de {nome_devedor}, CPF {cpf_devedor}, a quantia de R$ {valor_pago}, referente à parcela {numero_parcela}/{total_parcelas} do acordo firmado em {data_acordo}. {razao_social_credor} - CNPJ {cnpj_credor}. Data: {data_pagamento}";
const TEMPLATE_QUITACAO_DEFAULT = "{razao_social_credor}, CNPJ {cnpj_credor}, declara para os devidos fins que {nome_devedor}, CPF {cpf_devedor}, quitou integralmente o débito no valor original de R$ {valor_divida}, mediante acordo de {quantidade_parcelas} parcelas. Nada mais há a reclamar. Data: {data_atual}";
const TEMPLATE_DESCRICAO_DIVIDA_DEFAULT = `DESCRIÇÃO DE DÍVIDA

Credor: {razao_social_credor} - CNPJ: {cnpj_credor}
Devedor: {nome_devedor} - CPF: {cpf_devedor}

Informamos que consta em nossos registros o seguinte débito em nome do devedor acima qualificado:

Valor Original: R$ {valor_divida}
Data de Vencimento: {data_vencimento}
Parcela: {numero_parcela}/{total_parcelas}
Valor da Parcela: R$ {valor_parcela}

O débito acima descrito encontra-se vencido e não quitado até a presente data ({data_atual}), estando sujeito à incidência de juros, multa e correção monetária conforme previsto contratualmente.

Colocamo-nos à disposição para negociação e regularização do débito.

{razao_social_credor}
CNPJ: {cnpj_credor}`;

const VARIAVEIS = [
  "{nome_devedor}", "{cpf_devedor}", "{valor_divida}", "{valor_acordo}", "{quantidade_parcelas}",
  "{valor_parcela}", "{data_vencimento}", "{desconto_concedido}", "{razao_social_credor}", "{cnpj_credor}",
  "{data_atual}", "{valor_pago}", "{numero_parcela}", "{total_parcelas}", "{data_acordo}", "{data_pagamento}",
];

interface CredorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: any;
}

const CredorForm = ({ open, onOpenChange, editing }: CredorFormProps) => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const [form, setForm] = useState<any>({});
  const [honorarios, setHonorarios] = useState<any[]>([]);
  const [openTemplateDialog, setOpenTemplateDialog] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setOpenTemplateDialog(null);
      if (editing) {
        setForm({ ...editing });
        setHonorarios(editing.honorarios_grade || []);
      } else {
        setForm({
          status: "ativo", tipo_conta: "corrente", gateway_ambiente: "producao", gateway_status: "ativo",
          parcelas_min: 1, parcelas_max: 12, entrada_minima_valor: 0, entrada_minima_tipo: "percent",
          desconto_maximo: 0, juros_mes: 0, multa: 0,
          template_acordo: TEMPLATE_ACORDO_DEFAULT, template_recibo: TEMPLATE_RECIBO_DEFAULT, template_quitacao: TEMPLATE_QUITACAO_DEFAULT, template_descricao_divida: TEMPLATE_DESCRICAO_DIVIDA_DEFAULT,
        });
        setHonorarios([]);
      }
    }
  }, [open, editing]);

  const set = (k: string, v: any) => setForm((p: any) => ({ ...p, [k]: v }));

  const applyMask = (value: string, mask: "cnpj" | "phone") => {
    const n = value.replace(/\D/g, "");
    if (mask === "cnpj") {
      return n.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5").slice(0, 18);
    }
    return n.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3").slice(0, 15);
  };

  const saveMutation = useMutation({
    mutationFn: (data: any) => upsertCredor(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["credores"] }); toast.success("Credor salvo!"); onOpenChange(false); },
    onError: () => toast.error("Erro ao salvar credor"),
  });

  const handleSave = () => {
    if (!form.razao_social?.trim()) { toast.error("Razão Social obrigatória"); return; }
    if (!form.cnpj?.replace(/\D/g, "") || form.cnpj.replace(/\D/g, "").length < 14) { toast.error("CNPJ inválido"); return; }
    saveMutation.mutate({
      ...(editing?.id ? { id: editing.id } : {}),
      tenant_id: tenant!.id,
      ...form,
      cnpj: form.cnpj?.replace(/\D/g, ""),
      honorarios_grade: honorarios,
    });
  };

  const addHonorario = () => setHonorarios(prev => [...prev, { faixa: "", honorario: 0 }]);
  const removeHonorario = (i: number) => setHonorarios(prev => prev.filter((_, idx) => idx !== i));
  const updateHonorario = (i: number, key: string, val: any) => setHonorarios(prev => prev.map((h, idx) => idx === i ? { ...h, [key]: val } : h));

  const insertVariable = (field: string, variable: string) => {
    set(field, (form[field] || "") + variable);
  };

  const TEMPLATES = [
    { key: "template_acordo", label: "Carta de Acordo" },
    { key: "template_recibo", label: "Recibo de Pagamento" },
    { key: "template_quitacao", label: "Carta de Quitação" },
    { key: "template_descricao_divida", label: "Descrição de Dívida" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "Editar Credor" : "Novo Credor"}</SheetTitle>
        </SheetHeader>

        <Tabs defaultValue="dados" className="mt-4">
          <TabsList className="w-full flex-wrap">
            <TabsTrigger value="dados" className="flex-1">Dados</TabsTrigger>
            <TabsTrigger value="bancario" className="flex-1">Bancário</TabsTrigger>
            <TabsTrigger value="negociacao" className="flex-1">Negociação</TabsTrigger>
            <TabsTrigger value="regua" className="flex-1">Régua</TabsTrigger>
            <TabsTrigger value="assinatura" className="flex-1">Assinatura</TabsTrigger>
            <TabsTrigger value="portal" className="flex-1">Portal</TabsTrigger>
          </TabsList>

          {/* ABA 1 - DADOS CADASTRAIS */}
          <TabsContent value="dados" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Razão Social *</Label><Input value={form.razao_social || ""} onChange={e => set("razao_social", e.target.value)} /></div>
              <div><Label>Nome Fantasia</Label><Input value={form.nome_fantasia || ""} onChange={e => set("nome_fantasia", e.target.value)} /></div>
              <div><Label>CNPJ *</Label><Input value={applyMask(form.cnpj || "", "cnpj")} onChange={e => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" /></div>
              <div><Label>Inscrição Estadual</Label><Input value={form.inscricao_estadual || ""} onChange={e => set("inscricao_estadual", e.target.value)} /></div>
              <div><Label>Contato Responsável</Label><Input value={form.contato_responsavel || ""} onChange={e => set("contato_responsavel", e.target.value)} /></div>
              <div><Label>E-mail *</Label><Input type="email" value={form.email || ""} onChange={e => set("email", e.target.value)} /></div>
              <div><Label>Telefone *</Label><Input value={applyMask(form.telefone || "", "phone")} onChange={e => set("telefone", e.target.value)} placeholder="(00) 00000-0000" /></div>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Endereço</p>
              <div className="grid grid-cols-3 gap-4">
                <div><Label>CEP</Label><Input value={form.cep || ""} onChange={e => set("cep", e.target.value)} /></div>
                <div className="col-span-2"><Label>Rua</Label><Input value={form.endereco || ""} onChange={e => set("endereco", e.target.value)} /></div>
                <div><Label>Número</Label><Input value={form.numero || ""} onChange={e => set("numero", e.target.value)} /></div>
                <div><Label>Complemento</Label><Input value={form.complemento || ""} onChange={e => set("complemento", e.target.value)} /></div>
                <div><Label>Bairro</Label><Input value={form.bairro || ""} onChange={e => set("bairro", e.target.value)} /></div>
                <div><Label>Cidade</Label><Input value={form.cidade || ""} onChange={e => set("cidade", e.target.value)} /></div>
                <div><Label>UF</Label><Input value={form.uf || ""} onChange={e => set("uf", e.target.value)} maxLength={2} /></div>
              </div>
            </div>
          </TabsContent>

          {/* ABA 2 - BANCÁRIO / GATEWAY */}
          <TabsContent value="bancario" className="space-y-4 mt-4">
            <p className="text-sm font-medium text-foreground">Dados Bancários</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Banco</Label>
                <Select value={form.banco || ""} onValueChange={v => set("banco", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{BANCOS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Agência</Label><Input value={form.agencia || ""} onChange={e => set("agencia", e.target.value)} /></div>
              <div><Label>Conta</Label><Input value={form.conta || ""} onChange={e => set("conta", e.target.value)} /></div>
              <div>
                <Label>Tipo de Conta</Label>
                <Select value={form.tipo_conta || "corrente"} onValueChange={v => set("tipo_conta", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="corrente">Corrente</SelectItem><SelectItem value="poupanca">Poupança</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Chave PIX</Label><Input value={form.pix_chave || ""} onChange={e => set("pix_chave", e.target.value)} /></div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-sm font-medium text-foreground mb-3">Gateway de Pagamento</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Gateway Ativo</Label>
                  <Select value={form.gateway_ativo || ""} onValueChange={v => set("gateway_ativo", v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{GATEWAYS.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Token / API Key</Label><Input value={form.gateway_token || ""} onChange={e => set("gateway_token", e.target.value)} type="password" /></div>
                <div>
                  <Label>Ambiente</Label>
                  <Select value={form.gateway_ambiente || "producao"} onValueChange={v => set("gateway_ambiente", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="producao">Produção</SelectItem><SelectItem value="homologacao">Homologação</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={form.gateway_status || "ativo"} onValueChange={v => set("gateway_status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2 bg-muted/50 p-2 rounded">ℹ️ Este gateway será usado automaticamente ao gerar acordos deste credor.</p>
            </div>
          </TabsContent>

          {/* ABA 3 - NEGOCIAÇÃO */}
          <TabsContent value="negociacao" className="space-y-6 mt-4">
            <div>
              <p className="text-sm font-medium text-foreground mb-3">Regras de Acordo</p>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Parcelas Mínimas</Label><Input type="number" value={form.parcelas_min ?? 1} onChange={e => set("parcelas_min", parseInt(e.target.value) || 1)} /></div>
                <div><Label>Parcelas Máximas</Label><Input type="number" value={form.parcelas_max ?? 12} onChange={e => set("parcelas_max", parseInt(e.target.value) || 12)} /></div>
                <div>
                  <Label className="flex items-center justify-between">
                    Entrada Mínima
                    <div className="flex items-center gap-2 text-xs">
                      <span>R$</span>
                      <Switch checked={form.entrada_minima_tipo === "percent"} onCheckedChange={c => set("entrada_minima_tipo", c ? "percent" : "fixed")} />
                      <span>%</span>
                    </div>
                  </Label>
                  <Input type="number" value={form.entrada_minima_valor ?? 0} onChange={e => set("entrada_minima_valor", parseFloat(e.target.value) || 0)} />
                </div>
                <div><Label>Desconto Máximo (%)</Label><Input type="number" value={form.desconto_maximo ?? 0} onChange={e => set("desconto_maximo", parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Juros ao Mês (%)</Label><Input type="number" value={form.juros_mes ?? 0} onChange={e => set("juros_mes", parseFloat(e.target.value) || 0)} /></div>
                <div><Label>Multa (%)</Label><Input type="number" value={form.multa ?? 0} onChange={e => set("multa", parseFloat(e.target.value) || 0)} /></div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Grade de Honorários</p>
                  <p className="text-xs text-muted-foreground">Defina os honorários baseado no percentual de recuperação da carteira.</p>
                </div>
                <Button size="sm" variant="outline" onClick={addHonorario}><Plus className="w-3 h-3 mr-1" /> Adicionar Faixa</Button>
              </div>
              {honorarios.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Percentual Recuperado (%)</TableHead><TableHead>Honorários (%)</TableHead><TableHead className="w-16">Ações</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {honorarios.map((h, i) => (
                      <TableRow key={i}>
                        <TableCell><Input value={h.faixa} onChange={e => updateHonorario(i, "faixa", e.target.value)} placeholder="Ex: Até 50%" className="h-8" /></TableCell>
                        <TableCell><Input type="number" value={h.honorario} onChange={e => updateHonorario(i, "honorario", parseFloat(e.target.value) || 0)} className="h-8" /></TableCell>
                        <TableCell><Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => removeHonorario(i)}><Trash2 className="w-3 h-3" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Modelos de Documentos</p>
              {TEMPLATES.map(t => (
                <Card key={t.key} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{t.label}</span>
                  </div>
                  <Button variant="outline" size="sm" type="button" onClick={() => setOpenTemplateDialog(t.key)} className="gap-1">
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                </Card>
              ))}

              {TEMPLATES.map(t => (
                <Dialog key={t.key} open={openTemplateDialog === t.key} onOpenChange={open => setOpenTemplateDialog(open ? t.key : null)}>
                  <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Editar: {t.label}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" type="button">
                            Inserir Variável <ChevronDown className="w-3 h-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 max-h-60 overflow-y-auto p-2">
                          <div className="space-y-1">
                            {VARIAVEIS.map(v => (
                              <button key={v} className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors font-mono" onClick={() => insertVariable(t.key, v)}>{v}</button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Textarea rows={8} value={form[t.key] || ""} onChange={e => set(t.key, e.target.value)} className="font-mono text-xs" />
                    </div>
                    <DialogFooter>
                      <Button type="button" onClick={() => setOpenTemplateDialog(null)}>Concluir</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              ))}
            </div>
          </TabsContent>

          {/* ABA 4 - RÉGUA DE COBRANÇA */}
          <TabsContent value="regua" className="mt-4">
            <CredorReguaTab credorId={editing?.id} />
          </TabsContent>

          {/* ABA 5 - ASSINATURA DIGITAL */}
          <TabsContent value="assinatura" className="space-y-6 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-sm font-medium text-foreground">Assinatura Digital</p>
                  <p className="text-xs text-muted-foreground">Exigir assinatura digital nos acordos deste credor</p>
                </div>
                <Switch
                  checked={form.signature_enabled || false}
                  onCheckedChange={c => set("signature_enabled", c)}
                />
              </div>

              {form.signature_enabled && (
                <div className="space-y-3 p-4 rounded-lg border border-border">
                  <Label className="text-sm font-medium">Tipo de Assinatura</Label>
                  <RadioGroup
                    value={form.signature_type || "click"}
                    onValueChange={v => set("signature_type", v)}
                    className="space-y-3"
                  >
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="click" id="sig-click" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-click" className="text-sm font-medium cursor-pointer">Aceite por Click</Label>
                        <p className="text-xs text-muted-foreground">O devedor confirma com um clique simples. Rápido e prático.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="facial" id="sig-facial" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-facial" className="text-sm font-medium cursor-pointer">Reconhecimento Facial</Label>
                        <p className="text-xs text-muted-foreground">Captura de fotos via webcam com detecção facial em tempo real.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                      <RadioGroupItem value="draw" id="sig-draw" className="mt-0.5" />
                      <div>
                        <Label htmlFor="sig-draw" className="text-sm font-medium cursor-pointer">Assinatura na Tela</Label>
                        <p className="text-xs text-muted-foreground">O devedor desenha a assinatura manualmente na tela do dispositivo.</p>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                ℹ️ Quando ativa, a assinatura digital será obrigatória no portal do devedor antes de liberar o checkout para acordos deste credor.
              </p>
            </div>
          </TabsContent>

          {/* ABA 6 - PORTAL WHITE-LABEL */}
          <TabsContent value="portal" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div>
                  <p className="font-medium text-foreground text-sm">Portal Personalizado</p>
                  <p className="text-xs text-muted-foreground">Ativar branding personalizado deste credor no Portal do Devedor</p>
                </div>
                <Switch checked={form.portal_enabled || false} onCheckedChange={v => set("portal_enabled", v)} />
              </div>

              {form.portal_enabled && (
                <div className="space-y-4 animate-fade-in">
                  {/* Link copiável do Portal */}
                  {tenant?.slug && (
                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                      <Label className="text-sm font-medium">Link do Portal</Label>
                      <p className="text-xs text-muted-foreground mb-2">Copie e envie este link aos devedores para que acessem o portal de negociação.</p>
                      <div className="flex items-center gap-2">
                        <Input
                          readOnly
                          value={`${window.location.origin}/portal/${tenant.slug}`}
                          className="flex-1 bg-background font-mono text-xs"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5 shrink-0"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/portal/${tenant.slug}`);
                            toast.success("Link copiado!");
                          }}
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Upload de Logo */}
                  <div>
                    <Label className="text-sm font-medium">Logo do Credor</Label>
                    <p className="text-xs text-muted-foreground mb-2">Faça upload da imagem ou cole uma URL externa.</p>
                    <div className="flex items-start gap-4">
                      <div
                        className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors overflow-hidden shrink-0"
                        onClick={() => logoInputRef.current?.click()}
                      >
                        {form.portal_logo_url ? (
                          <img src={form.portal_logo_url} alt="Logo preview" className="w-full h-full object-contain" />
                        ) : (
                          <div className="flex flex-col items-center gap-1 text-muted-foreground">
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[10px]">Upload</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          ref={logoInputRef}
                          type="file"
                          accept=".png,.jpg,.jpeg,.svg,.webp"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 2 * 1024 * 1024) {
                              toast.error("Imagem deve ter no máximo 2MB");
                              return;
                            }
                            setUploadingLogo(true);
                            try {
                              const credorId = editing?.id || "new";
                              const ext = file.name.split(".").pop();
                              const path = `credor-logos/${credorId}/${Date.now()}.${ext}`;
                              const { error: uploadError } = await supabase.storage
                                .from("avatars")
                                .upload(path, file, { upsert: true });
                              if (uploadError) throw uploadError;
                              const { data: urlData } = supabase.storage
                                .from("avatars")
                                .getPublicUrl(path);
                              set("portal_logo_url", urlData.publicUrl);
                              toast.success("Logo enviado com sucesso!");
                            } catch (err) {
                              console.error(err);
                              toast.error("Erro ao enviar logo");
                            } finally {
                              setUploadingLogo(false);
                              e.target.value = "";
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          disabled={uploadingLogo}
                          onClick={() => logoInputRef.current?.click()}
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {uploadingLogo ? "Enviando..." : "Fazer Upload"}
                        </Button>
                        <Input
                          value={form.portal_logo_url || ""}
                          onChange={e => set("portal_logo_url", e.target.value)}
                          placeholder="Ou cole a URL do logo aqui..."
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>Título do Hero</Label>
                      <Input value={form.portal_hero_title || ""} onChange={e => set("portal_hero_title", e.target.value)} placeholder="Ex: Negocie suas dívidas com até 90% de desconto" />
                    </div>
                    <div className="col-span-2">
                      <Label>Subtítulo do Hero</Label>
                      <Input value={form.portal_hero_subtitle || ""} onChange={e => set("portal_hero_subtitle", e.target.value)} placeholder="Consulte suas pendências e encontre as melhores condições" />
                    </div>
                    <div>
                      <Label>Cor Primária</Label>
                      <div className="flex items-center gap-2">
                        <Input type="color" value={form.portal_primary_color || "#F97316"} onChange={e => set("portal_primary_color", e.target.value)} className="w-12 h-10 p-1 cursor-pointer" />
                        <Input value={form.portal_primary_color || ""} onChange={e => set("portal_primary_color", e.target.value)} placeholder="#F97316" className="flex-1" />
                      </div>
                    </div>
                  </div>

                  {form.portal_primary_color && (
                    <div className="border border-border rounded-lg p-4">
                      <p className="text-xs text-muted-foreground mb-2">Preview</p>
                      <div className="flex items-center gap-3">
                        {form.portal_logo_url && <img src={form.portal_logo_url} alt="Logo" className="h-8 w-auto" />}
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: form.portal_primary_color }}>
                          {(form.nome_fantasia || form.razao_social || "C")?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-semibold" style={{ color: form.portal_primary_color }}>{form.nome_fantasia || form.razao_social || "Credor"}</span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    ℹ️ Quando ativo, os devedores deste credor verão a identidade visual personalizada no portal de negociação.
                  </p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>{saveMutation.isPending ? "Salvando..." : "Salvar Credor"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CredorForm;
