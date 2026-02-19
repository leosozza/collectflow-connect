import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchApiKeys, generateApiKey, revokeApiKey, type ApiKey } from "@/services/apiKeyService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Key, Plus, Copy, ShieldX, CheckCircle2, AlertCircle, Code2, BookOpen, Zap, Loader2, ExternalLink, Link2, FileSpreadsheet, Handshake, CreditCard, Globe, Settings2, Plug } from "lucide-react";

const BASE_URL = `https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api`;

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-muted border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border">
        <span className="text-xs text-muted-foreground font-mono">{lang}</span>
        <button onClick={handleCopy} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto text-foreground font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointCard({ method, path, description, children }: { method: string; path: string; description: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    GET: "bg-primary/10 text-primary border-primary/30",
    POST: "bg-green-600/10 text-green-600 border-green-600/30 dark:text-green-400",
    PUT: "bg-yellow-600/10 text-yellow-600 border-yellow-600/30 dark:text-yellow-400",
    DELETE: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left" onClick={() => setOpen(!open)}>
        <Badge variant="outline" className={`font-mono text-xs font-bold ${colors[method]}`}>{method}</Badge>
        <code className="text-sm font-mono text-foreground flex-1">{path}</code>
        <span className="text-sm text-muted-foreground hidden sm:block">{description}</span>
      </button>
      {open && children && <div className="border-t border-border bg-muted/20 p-4 space-y-3">{children}</div>}
    </div>
  );
}

function ImportLogsPanel({ tenantId }: { tenantId?: string }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["import_logs", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("import_logs" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenantId,
    refetchInterval: 30000,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="w-5 h-5 text-primary" />Histórico de Importações</CardTitle>
        <CardDescription>Monitoramento de mailings recebidos via API e importação de planilha</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Nenhuma importação registrada ainda</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Credor</TableHead>
                <TableHead className="text-center">Total</TableHead>
                <TableHead className="text-center">Inseridos</TableHead>
                <TableHead className="text-center">Erros</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{log.source === "api" ? "API" : "Planilha"}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{log.credor || "—"}</TableCell>
                  <TableCell className="text-center">{log.total_records}</TableCell>
                  <TableCell className="text-center text-primary font-medium">{log.inserted}</TableCell>
                  <TableCell className="text-center">
                    {log.skipped > 0 ? <span className="text-destructive font-medium">{log.skipped}</span> : <span className="text-muted-foreground">0</span>}
                  </TableCell>
                  <TableCell>
                    {(log.errors?.length || 0) > 0 ? (
                      <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10"><AlertCircle className="w-3 h-3 mr-1" />Com erros</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30 bg-primary/10"><CheckCircle2 className="w-3 h-3 mr-1" />Sucesso</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApiDocsPage() {
  const { user, profile } = useAuth();
  const { tenant, isTenantAdmin } = useTenant();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState("Chave Padrão");
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [newKeyToken, setNewKeyToken] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    if (tenant?.id) loadKeys();
  }, [tenant?.id]);

  async function loadKeys() {
    try {
      setLoading(true);
      const keys = await fetchApiKeys(tenant!.id);
      setApiKeys(keys);
    } catch (e: any) {
      toast.error("Erro ao carregar chaves: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerate() {
    if (!tenant?.id || !profile?.id) return;
    try {
      setGenerating(true);
      const { rawToken, record } = await generateApiKey(tenant.id, profile.id, newKeyLabel || "Nova Chave");
      setNewKeyToken(rawToken);
      setApiKeys((prev) => [record, ...prev]);
      setShowGenerateDialog(false);
      setNewKeyLabel("Chave Padrão");
    } catch (e: any) {
      toast.error("Erro ao gerar chave: " + e.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      setRevoking(id);
      await revokeApiKey(id);
      setApiKeys((prev) => prev.map((k) => (k.id === id ? { ...k, is_active: false, revoked_at: new Date().toISOString() } : k)));
      toast.success("Chave revogada com sucesso");
    } catch (e: any) {
      toast.error("Erro ao revogar: " + e.message);
    } finally {
      setRevoking(null);
    }
  }

  const publicUrl = `${window.location.origin}/api-docs/public`;
  const [linkCopied, setLinkCopied] = useState(false);
  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Code2 className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">API REST — Documentação Completa</h1>
          <p className="text-sm text-muted-foreground">Integre sistemas externos com toda a plataforma CollectFlow</p>
        </div>
      </div>

      {/* Link Público */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Compartilhar Documentação</p>
                <p className="text-xs text-muted-foreground">Envie este link para devs ou IA para integração — não expõe dados ou chaves</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono truncate">{publicUrl}</code>
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex-shrink-0">
                  {linkCopied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-1.5">{linkCopied ? "Copiado!" : "Copiar"}</span>
                </Button>
                <Button size="sm" variant="outline" asChild className="flex-shrink-0">
                  <a href="/api-docs/public" target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="keys">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="keys" className="flex items-center gap-1.5 text-xs"><Key className="w-3.5 h-3.5" />API Keys</TabsTrigger>
          <TabsTrigger value="clients" className="flex items-center gap-1.5 text-xs"><BookOpen className="w-3.5 h-3.5" />Clientes</TabsTrigger>
          <TabsTrigger value="agreements" className="flex items-center gap-1.5 text-xs"><Handshake className="w-3.5 h-3.5" />Acordos</TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-1.5 text-xs"><CreditCard className="w-3.5 h-3.5" />Pagamentos</TabsTrigger>
          <TabsTrigger value="portal" className="flex items-center gap-1.5 text-xs"><Globe className="w-3.5 h-3.5" />Portal</TabsTrigger>
          <TabsTrigger value="cadastros" className="flex items-center gap-1.5 text-xs"><Settings2 className="w-3.5 h-3.5" />Cadastros</TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-1.5 text-xs"><Plug className="w-3.5 h-3.5" />Integração</TabsTrigger>
          <TabsTrigger value="imports" className="flex items-center gap-1.5 text-xs"><FileSpreadsheet className="w-3.5 h-3.5" />Importações</TabsTrigger>
        </TabsList>

        {/* ── API Keys ── */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>Gere e revogue chaves para autenticar via header <code className="text-xs bg-muted px-1 py-0.5 rounded">X-API-Key</code></CardDescription>
              </div>
              {isTenantAdmin && (
                <Button onClick={() => setShowGenerateDialog(true)} className="flex items-center gap-2"><Plus className="w-4 h-4" />Nova Chave</Button>
              )}
            </CardHeader>
            <CardContent>
              {newKeyToken && (
                <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-semibold text-primary">⚠️ Copie agora — esta chave não será exibida novamente!</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono break-all">{newKeyToken}</code>
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKeyToken); toast.success("Copiado!"); }}><Copy className="w-4 h-4" /></Button>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setNewKeyToken(null)}>Entendido, fechar</Button>
                    </div>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><Key className="w-8 h-8 mx-auto mb-2 opacity-40" /><p className="text-sm">Nenhuma chave gerada ainda</p></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Prefixo</TableHead><TableHead>Status</TableHead><TableHead>Último uso</TableHead><TableHead>Criado em</TableHead><TableHead></TableHead></TableRow></TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.label}</TableCell>
                        <TableCell><code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{key.key_prefix}••••</code></TableCell>
                        <TableCell>{key.is_active ? <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10"><CheckCircle2 className="w-3 h-3 mr-1" />Ativa</Badge> : <Badge variant="outline" className="text-muted-foreground"><ShieldX className="w-3 h-3 mr-1" />Revogada</Badge>}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{key.last_used_at ? new Date(key.last_used_at).toLocaleString("pt-BR") : "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(key.created_at).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{key.is_active && isTenantAdmin && (
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => handleRevoke(key.id)} disabled={revoking === key.id}>
                            {revoking === key.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
                          </Button>
                        )}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle className="text-base">URL Base da API</CardTitle></CardHeader><CardContent><CodeBlock code={BASE_URL} lang="URL" /><p className="text-xs text-muted-foreground mt-2">Header: <code className="bg-muted px-1 rounded">X-API-Key: cf_sua_chave</code></p></CardContent></Card>
        </TabsContent>

        {/* ── Clientes ── */}
        <TabsContent value="clients" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Endpoints de Clientes / Mailing</CardTitle><CardDescription>CRUD completo com suporte a importação em massa no formato de mailing</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="GET" path="/clients" description="Listar clientes (paginado)">
                <p className="text-sm text-muted-foreground">Query params: <code>page</code>, <code>limit</code> (max 500), <code>status</code>, <code>credor</code>, <code>cpf</code></p>
                <CodeBlock code={`curl "${BASE_URL}/clients?page=1&limit=100&status=pendente" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="GET" path="/clients/:id" description="Buscar cliente por UUID">
                <CodeBlock code={`curl "${BASE_URL}/clients/uuid-do-cliente" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="POST" path="/clients" description="Criar ou atualizar 1 cliente (upsert)">
                <p className="text-sm text-muted-foreground mb-2">Aceita campos no formato mailing (NOME_DEVEDOR, CNPJ_CPF, etc.)</p>
                <CodeBlock code={`{\n  "CREDOR": "EMPRESA",\n  "COD_DEVEDOR": "12345",\n  "COD_CONTRATO": "CTR-2026-001",\n  "NOME_DEVEDOR": "João Silva",\n  "CNPJ_CPF": "123.456.789-00",\n  "FONE_1": "(11) 99999-0000",\n  "FONE_2": "(11) 88888-0000",\n  "FONE_3": "(11) 77777-0000",\n  "PARCELA": 1,\n  "DT_VENCIMENTO": "01/03/2026",\n  "DT_PAGAMENTO": "",\n  "VL_TITULO": 1000,\n  "VL_ATUALIZADO": 1100,\n  "VL_SALDO": 900,\n  "STATUS": "ATIVO"\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="POST" path="/clients/bulk" description="Inserção em massa (até 500/chamada)">
                <CodeBlock code={`{\n  "records": [{ ... }, { ... }],\n  "upsert": true,\n  "upsert_key": "external_id"\n}`} lang="JSON" />
                <p className="text-sm text-muted-foreground mt-2">Resposta inclui: <code>inserted</code>, <code>updated</code>, <code>skipped</code>, <code>errors</code></p>
              </EndpointCard>
              <EndpointCard method="PUT" path="/clients/:id" description="Atualizar cliente por UUID">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid" \\\n  -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\\n  -d '{"status":"pago","valor_pago":500}'`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="PUT" path="/clients/by-external/:id" description="Atualizar por external_id">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/by-external/EXT-001" \\\n  -H "X-API-Key: cf_..." -d '{"status":"pago"}'`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="PUT" path="/clients/:id/status" description="Atualizar status de cobrança">
                <p className="text-sm text-muted-foreground mb-2">Altera a etapa do funil de cobrança do cliente</p>
                <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid/status" \\\n  -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\\n  -d '{"status_cobranca_id":"uuid-do-status"}'`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="DELETE" path="/clients/:id" description="Deletar cliente por UUID">
                <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="DELETE" path="/clients/by-cpf/:cpf" description="Deletar todos de um CPF">
                <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/by-cpf/123.456.789-00" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Acordos ── */}
        <TabsContent value="agreements" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Endpoints de Acordos</CardTitle><CardDescription>Criar, consultar, aprovar e rejeitar propostas de negociação</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="GET" path="/agreements" description="Listar acordos (paginado)">
                <p className="text-sm text-muted-foreground">Filtros: <code>status</code> (pending, approved, rejected), <code>cpf</code>, <code>credor</code></p>
                <CodeBlock code={`curl "${BASE_URL}/agreements?status=pending&page=1" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="GET" path="/agreements/:id" description="Buscar acordo por UUID">
                <CodeBlock code={`curl "${BASE_URL}/agreements/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="POST" path="/agreements" description="Criar proposta de acordo">
                <p className="text-sm text-muted-foreground mb-2">Campos obrigatórios: client_cpf, client_name, credor, original_total, proposed_total, new_installments, new_installment_value, first_due_date</p>
                <CodeBlock code={`{\n  "client_cpf": "123.456.789-00",\n  "client_name": "João Silva",\n  "credor": "EMPRESA",\n  "original_total": 5000,\n  "proposed_total": 3500,\n  "new_installments": 10,\n  "new_installment_value": 350,\n  "first_due_date": "2026-04-01",\n  "discount_percent": 30,\n  "notes": "Proposta via API"\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="PUT" path="/agreements/:id/approve" description="Aprovar acordo">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/agreements/uuid/approve" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="PUT" path="/agreements/:id/reject" description="Rejeitar acordo">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/agreements/uuid/reject" \\\n  -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\\n  -d '{"reason":"Valor abaixo do mínimo"}'`} lang="cURL" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pagamentos ── */}
        <TabsContent value="payments" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Endpoints de Pagamentos</CardTitle><CardDescription>Listar cobranças, verificar status, gerar PIX e cobranças via cartão</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="GET" path="/payments" description="Listar pagamentos (paginado)">
                <p className="text-sm text-muted-foreground">Filtros: <code>status</code>, <code>client_id</code></p>
                <CodeBlock code={`curl "${BASE_URL}/payments?status=pendente" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="GET" path="/payments/:id" description="Status de um pagamento">
                <CodeBlock code={`curl "${BASE_URL}/payments/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
                <p className="text-sm text-muted-foreground mt-2">Retorna: valor, status, tipo (pix/cartao/boleto), pix_copia_cola, link_boleto, link_cartao</p>
              </EndpointCard>
              <EndpointCard method="POST" path="/payments/pix" description="Gerar cobrança PIX">
                <CodeBlock code={`{\n  "client_id": "uuid-do-cliente",\n  "valor": 350.00,\n  "data_vencimento": "2026-04-01"\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="POST" path="/payments/cartao" description="Gerar cobrança Cartão">
                <CodeBlock code={`{\n  "client_id": "uuid-do-cliente",\n  "valor": 350.00,\n  "data_vencimento": "2026-04-01"\n}`} lang="JSON" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Portal ── */}
        <TabsContent value="portal" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Endpoints do Portal do Devedor</CardTitle><CardDescription>Consulta de dívidas e criação de propostas via portal</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="POST" path="/portal/lookup" description="Consultar dívidas por CPF">
                <p className="text-sm text-muted-foreground mb-2">Retorna todas as parcelas pendentes do CPF informado</p>
                <CodeBlock code={`curl -X POST "${BASE_URL}/portal/lookup" \\\n  -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\\n  -d '{"cpf":"123.456.789-00"}'`} lang="cURL" />
              </EndpointCard>
              <EndpointCard method="POST" path="/portal/agreement" description="Criar proposta via portal">
                <p className="text-sm text-muted-foreground mb-2">Mesmos campos de POST /agreements, mas marca <code>portal_origin: true</code></p>
                <CodeBlock code={`{\n  "client_cpf": "123.456.789-00",\n  "client_name": "João Silva",\n  "credor": "EMPRESA",\n  "original_total": 5000,\n  "proposed_total": 3500,\n  "new_installments": 10,\n  "new_installment_value": 350,\n  "first_due_date": "2026-04-01"\n}`} lang="JSON" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cadastros ── */}
        <TabsContent value="cadastros" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>Endpoints de Cadastros</CardTitle><CardDescription>Status de cobrança e credores cadastrados</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="GET" path="/status-types" description="Listar tipos de status de cobrança">
                <p className="text-sm text-muted-foreground mb-2">Retorna id, nome, cor e ordem para uso no funil de cobrança</p>
                <CodeBlock code={`curl "${BASE_URL}/status-types" -H "X-API-Key: cf_..."`} lang="cURL" />
                <CodeBlock code={`// Resposta\n{\n  "data": [\n    { "id": "uuid", "nome": "Novo", "cor": "#3b82f6", "ordem": 1 },\n    { "id": "uuid", "nome": "Em negociação", "cor": "#f59e0b", "ordem": 2 }\n  ]\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="GET" path="/credores" description="Listar credores ativos">
                <p className="text-sm text-muted-foreground mb-2">Retorna dados dos credores com regras de negociação</p>
                <CodeBlock code={`curl "${BASE_URL}/credores" -H "X-API-Key: cf_..."`} lang="cURL" />
                <CodeBlock code={`// Resposta\n{\n  "data": [\n    {\n      "id": "uuid",\n      "razao_social": "Empresa LTDA",\n      "nome_fantasia": "Empresa",\n      "cnpj": "12.345.678/0001-00",\n      "parcelas_min": 1,\n      "parcelas_max": 12,\n      "desconto_maximo": 30,\n      "juros_mes": 1.5,\n      "multa": 2\n    }\n  ]\n}`} lang="JSON" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Integração ── */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <Card><CardHeader><CardTitle>WhatsApp</CardTitle><CardDescription>Envio individual e em massa de mensagens via WhatsApp</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="POST" path="/whatsapp/send" description="Enviar mensagem individual">
                <p className="text-sm text-muted-foreground mb-2">Requer instância WhatsApp conectada no sistema</p>
                <CodeBlock code={`{\n  "phone": "5511999990000",\n  "message": "Olá! Sua parcela de R$500 vence em 01/04. Acesse o portal para negociar."\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="POST" path="/whatsapp/bulk" description="Envio em massa (até 200/chamada)">
                <CodeBlock code={`{\n  "messages": [\n    { "phone": "5511999990000", "message": "Msg 1" },\n    { "phone": "5511888880000", "message": "Msg 2" }\n  ]\n}`} lang="JSON" />
              </EndpointCard>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Propensity Score</CardTitle><CardDescription>Cálculo de propensão ao pagamento via IA</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="POST" path="/propensity/calculate" description="Calcular score de propensão">
                <p className="text-sm text-muted-foreground mb-2">Score de 0 a 100 calculado por IA analisando métricas do devedor</p>
                <CodeBlock code={`// CPF único\n{"cpf": "123.456.789-00"}\n\n// Lote de CPFs\n{"cpfs": ["123.456.789-00", "987.654.321-00"]}`} lang="JSON" />
              </EndpointCard>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Webhooks</CardTitle><CardDescription>Configure callbacks para receber notificações do sistema</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="POST" path="/webhooks/configure" description="Registrar URL de callback">
                <CodeBlock code={`{\n  "url": "https://seu-sistema.com/webhook",\n  "events": ["agreement.approved", "payment.confirmed", "client.updated"]\n}`} lang="JSON" />
              </EndpointCard>
              <EndpointCard method="GET" path="/webhooks" description="Ver configuração atual">
                <CodeBlock code={`curl "${BASE_URL}/webhooks" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Importações ── */}
        <TabsContent value="imports" className="space-y-4 mt-4">
          <ImportLogsPanel tenantId={tenant?.id} />
        </TabsContent>
      </Tabs>

      {/* Generate Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Nova API Key</DialogTitle>
            <DialogDescription>O token será exibido apenas uma vez. Guarde-o com segurança.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="label">Label da chave</Label>
            <Input id="label" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)} placeholder="Ex: Sistema de CRM, ERP Interno..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancelar</Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Key className="w-4 h-4 mr-2" />}
              Gerar Chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
