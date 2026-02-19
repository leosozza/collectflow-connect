import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
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
import { Key, Plus, Copy, ShieldX, CheckCircle2, AlertCircle, Code2, BookOpen, Zap, Loader2, ExternalLink, Link2 } from "lucide-react";

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
        <button
          onClick={handleCopy}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto text-foreground font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointCard({
  method,
  path,
  description,
  children,
}: {
  method: string;
  path: string;
  description: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    GET: "bg-primary/10 text-primary border-primary/30",
    POST: "bg-green-600/10 text-green-600 border-green-600/30 dark:text-green-400",
    PUT: "bg-yellow-600/10 text-yellow-600 border-yellow-600/30 dark:text-yellow-400",
    DELETE: "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <Badge variant="outline" className={`font-mono text-xs font-bold ${colors[method]}`}>
          {method}
        </Badge>
        <code className="text-sm font-mono text-foreground flex-1">{path}</code>
        <span className="text-sm text-muted-foreground hidden sm:block">{description}</span>
      </button>
      {open && children && (
        <div className="border-t border-border bg-muted/20 p-4 space-y-3">{children}</div>
      )}
    </div>
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

  const singlePayloadExample = `{
  "credor": "EMPRESA XYZ",
  "nome_completo": "João da Silva",
  "cpf": "123.456.789-00",
  "phone": "11999999999",
  "email": "joao@email.com",
  "external_id": "EXT-001",
  "endereco": "Rua das Flores, 123",
  "cidade": "São Paulo",
  "uf": "SP",
  "cep": "01310-100",
  "observacoes": "Cliente VIP",
  "numero_parcela": 1,
  "total_parcelas": 3,
  "valor_entrada": 500.00,
  "valor_parcela": 300.00,
  "valor_pago": 0,
  "data_vencimento": "2026-03-01",
  "status": "pendente",
  "status_cobranca_id": "uuid-do-status-de-cobranca"
}`;

  const bulkPayloadExample = `{
  "records": [
    { "nome_completo": "Cliente 1", "cpf": "111.111.111-11", "credor": "EMPRESA", "valor_parcela": 500, "data_vencimento": "2026-03-01", "external_id": "EXT-001" },
    { "nome_completo": "Cliente 2", "cpf": "222.222.222-22", "credor": "EMPRESA", "valor_parcela": 300, "data_vencimento": "2026-04-01", "external_id": "EXT-002" }
  ],
  "upsert": true,
  "upsert_key": "external_id"
}`;

  const responseExample = `{
  "success": true,
  "inserted": 450,
  "updated": 30,
  "skipped": 20,
  "errors": [
    { "index": 5, "external_id": "EXT-005", "error": "CPF inválido" }
  ],
  "total": 500
}`;

  const pythonExample = `import requests
import time

API_KEY = "cf_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE_URL = "${BASE_URL}"
HEADERS = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# Importar 10.000 clientes em lotes de 500
all_clients = [...]  # Sua lista de 10.000 clientes

BATCH_SIZE = 500
for i in range(0, len(all_clients), BATCH_SIZE):
    batch = all_clients[i:i + BATCH_SIZE]
    resp = requests.post(
        f"{BASE_URL}/clients/bulk",
        json={"records": batch, "upsert": True, "upsert_key": "external_id"},
        headers=HEADERS
    )
    result = resp.json()
    print(f"Lote {i//BATCH_SIZE + 1}: {result['inserted']} inseridos, {result['skipped']} ignorados")
    time.sleep(0.5)  # Opcional: respeitar rate limits`;

  const nodeExample = `const API_KEY = "cf_xxxxxxxxxxxxxxxxxxxxxxxx";
const BASE_URL = "${BASE_URL}";
const headers = { "X-API-Key": API_KEY, "Content-Type": "application/json" };

// Importar 10.000 clientes em lotes de 500
async function importClients(allClients) {
  const BATCH_SIZE = 500;
  for (let i = 0; i < allClients.length; i += BATCH_SIZE) {
    const batch = allClients.slice(i, i + BATCH_SIZE);
    const res = await fetch(\`\${BASE_URL}/clients/bulk\`, {
      method: "POST",
      headers,
      body: JSON.stringify({ records: batch, upsert: true, upsert_key: "external_id" })
    });
    const result = await res.json();
    console.log(\`Lote \${Math.floor(i / BATCH_SIZE) + 1}: \${result.inserted} inseridos\`);
    await new Promise(r => setTimeout(r, 500)); // delay opcional
  }
}`;

  const curlExample = `# Upsert único
curl -X POST "${BASE_URL}/clients" \\
  -H "X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"nome_completo":"João Silva","cpf":"123.456.789-00","credor":"EMPRESA","valor_parcela":500,"data_vencimento":"2026-03-01"}'

# Bulk (até 500 registros)
curl -X POST "${BASE_URL}/clients/bulk" \\
  -H "X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{"records":[...],"upsert":true}'

# Listar clientes (paginado)
curl "${BASE_URL}/clients?page=1&limit=100&status=pendente" \\
  -H "X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxx"

# Deletar por CPF
curl -X DELETE "${BASE_URL}/clients/by-cpf/123.456.789-00" \\
  -H "X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxx"`;

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
          <h1 className="text-2xl font-bold text-foreground">API REST — Documentação</h1>
          <p className="text-sm text-muted-foreground">Integre sistemas externos para gerenciar leads em massa</p>
        </div>
      </div>

      {/* Card de Link Público */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Link2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-sm font-semibold text-foreground">Compartilhar Documentação</p>
                <p className="text-xs text-muted-foreground">
                  Envie este link para devs ou IA para integração — não expõe dados ou chaves
                </p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono truncate">
                  {publicUrl}
                </code>
                <Button size="sm" variant="outline" onClick={handleCopyLink} className="flex-shrink-0">
                  {linkCopied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
                  <span className="ml-1.5">{linkCopied ? "Copiado!" : "Copiar"}</span>
                </Button>
                <Button size="sm" variant="outline" asChild className="flex-shrink-0">
                  <a href="/api-docs/public" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="keys">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="keys" className="flex items-center gap-2">
            <Key className="w-4 h-4" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Endpoints
          </TabsTrigger>
          <TabsTrigger value="examples" className="flex items-center gap-2">
            <Zap className="w-4 h-4" /> Exemplos
          </TabsTrigger>
        </TabsList>

        {/* ── API Keys ── */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>
                  Gere e revogue chaves para autenticar sistemas externos via header{" "}
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">X-API-Key</code>
                </CardDescription>
              </div>
              {isTenantAdmin && (
                <Button onClick={() => setShowGenerateDialog(true)} className="flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Nova Chave
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {newKeyToken && (
                <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-semibold text-primary">
                        ⚠️ Copie agora — esta chave não será exibida novamente!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs bg-background border border-border rounded px-3 py-2 font-mono break-all">
                          {newKeyToken}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(newKeyToken);
                            toast.success("Copiado!");
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button size="sm" variant="ghost" className="text-xs" onClick={() => setNewKeyToken(null)}>
                        Entendido, fechar
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Key className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Nenhuma chave gerada ainda</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead>Prefixo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Último uso</TableHead>
                      <TableHead>Criado em</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">{key.label}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{key.key_prefix}••••</code>
                        </TableCell>
                        <TableCell>
                          {key.is_active ? (
                            <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Ativa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              <ShieldX className="w-3 h-3 mr-1" /> Revogada
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {key.last_used_at ? new Date(key.last_used_at).toLocaleString("pt-BR") : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(key.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {key.is_active && isTenantAdmin && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => handleRevoke(key.id)}
                              disabled={revoking === key.id}
                            >
                              {revoking === key.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">URL Base da API</CardTitle>
            </CardHeader>
            <CardContent>
              <CodeBlock code={BASE_URL} lang="URL" />
              <p className="text-xs text-muted-foreground mt-2">
                Inclua o header <code className="bg-muted px-1 rounded">X-API-Key: cf_sua_chave</code> em todas as requisições.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Endpoints ── */}
        <TabsContent value="docs" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Autenticação</CardTitle>
              <CardDescription>Todas as requisições requerem o header X-API-Key</CardDescription>
            </CardHeader>
            <CardContent>
              <CodeBlock code={`X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} lang="Header HTTP" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Endpoints disponíveis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <EndpointCard method="GET" path="/health" description="Status da API">
                <CodeBlock code={`curl "${BASE_URL}/health"`} lang="cURL" />
              </EndpointCard>

              <EndpointCard method="GET" path="/clients" description="Listar clientes (paginado)">
                <p className="text-sm text-muted-foreground">Query params: <code>page</code>, <code>limit</code> (max 500), <code>status</code>, <code>credor</code>, <code>cpf</code></p>
                <CodeBlock code={`${BASE_URL}/clients?page=1&limit=100&status=pendente`} lang="URL" />
              </EndpointCard>

              <EndpointCard method="GET" path="/clients/:id" description="Buscar cliente por ID">
                <CodeBlock code={`${BASE_URL}/clients/uuid-do-cliente`} lang="URL" />
              </EndpointCard>

              <EndpointCard method="POST" path="/clients" description="Criar ou atualizar 1 cliente (upsert)">
                <p className="text-sm text-muted-foreground mb-2">Campos obrigatórios: <code>nome_completo</code>, <code>cpf</code>, <code>credor</code>, <code>valor_parcela</code>, <code>data_vencimento</code></p>
                <CodeBlock code={singlePayloadExample} lang="JSON — Body" />
              </EndpointCard>

              <EndpointCard method="POST" path="/clients/bulk" description="Inserção em massa (até 500 por chamada)">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Máximo 500 registros por chamada. Para 10.000+ registros, faça múltiplas chamadas paginadas.</p>
                  <CodeBlock code={bulkPayloadExample} lang="JSON — Body" />
                  <p className="text-sm font-medium mt-2">Resposta:</p>
                  <CodeBlock code={responseExample} lang="JSON — Response" />
                </div>
              </EndpointCard>

              <EndpointCard method="PUT" path="/clients/:id" description="Atualizar cliente por ID">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid" \\\n  -H "X-API-Key: cf_..." \\\n  -d '{"status":"pago","valor_pago":500}'`} lang="cURL" />
              </EndpointCard>

              <EndpointCard method="PUT" path="/clients/by-external/:external_id" description="Atualizar por external_id">
                <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/by-external/EXT-001" \\\n  -H "X-API-Key: cf_..." \\\n  -d '{"status":"pago"}'`} lang="cURL" />
              </EndpointCard>

              <EndpointCard method="DELETE" path="/clients/:id" description="Deletar cliente por ID">
                <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>

              <EndpointCard method="DELETE" path="/clients/by-cpf/:cpf" description="Deletar todos os registros de um CPF">
                <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/by-cpf/123.456.789-00" -H "X-API-Key: cf_..."`} lang="cURL" />
              </EndpointCard>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Campos aceitos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Obrigatório</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["nome_completo", "string", "✅", "Nome completo do devedor"],
                    ["cpf", "string", "✅", "CPF (qualquer formato)"],
                    ["credor", "string", "✅", "Nome do credor/empresa"],
                    ["valor_parcela", "number", "✅", "Valor da parcela em R$"],
                    ["data_vencimento", "string", "✅", "Data YYYY-MM-DD"],
                    ["external_id", "string", "—", "ID no sistema externo (usado para upsert)"],
                    ["numero_parcela", "integer", "—", "Número da parcela (padrão: 1)"],
                    ["total_parcelas", "integer", "—", "Total de parcelas"],
                    ["valor_entrada", "number", "—", "Valor de entrada"],
                    ["valor_pago", "number", "—", "Valor já pago"],
                    ["status", "string", "—", "pendente | pago | quebrado"],
                    ["status_cobranca_id", "string (UUID)", "—", "UUID do status de cobrança (cadastrado em Cadastros > Status)"],
                    ["phone", "string", "—", "Telefone"],
                    ["email", "string", "—", "Email"],
                    ["endereco", "string", "—", "Endereço completo"],
                    ["cidade", "string", "—", "Cidade"],
                    ["uf", "string", "—", "UF (2 letras)"],
                    ["cep", "string", "—", "CEP"],
                    ["observacoes", "string", "—", "Observações livres"],
                  ].map(([field, type, req, desc]) => (
                    <TableRow key={field}>
                      <TableCell><code className="text-xs font-mono bg-muted px-1 py-0.5 rounded">{field}</code></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{type}</TableCell>
                      <TableCell className="text-sm">{req}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Exemplos ── */}
        <TabsContent value="examples" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Importação em Massa — 10.000+ Clientes</CardTitle>
              <CardDescription>
                Divida os registros em lotes de até 500 e faça chamadas sequenciais ao endpoint /bulk
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Registros/lote", value: "500" },
                  { label: "Lotes para 10k", value: "20" },
                  { label: "Upsert idempotente", value: "✅" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted rounded-lg p-3">
                    <p className="text-xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Python (requests)</p>
                <CodeBlock code={pythonExample} lang="python" />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">Node.js / JavaScript</p>
                <CodeBlock code={nodeExample} lang="javascript" />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">cURL</p>
                <CodeBlock code={curlExample} lang="bash" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Boas práticas</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {[
                  "Use external_id para garantir idempotência — reenvios não criam duplicatas",
                  "Sempre use upsert: true no /bulk para reenvios seguros",
                  'Monitore o campo "errors" na resposta para tratar registros inválidos',
                  "Adicione um delay de 200-500ms entre lotes para não sobrecarregar",
                  "Revogue chaves antigas e gere novas regularmente por segurança",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Key Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerar Nova API Key</DialogTitle>
            <DialogDescription>
              O token será exibido apenas uma vez. Guarde-o com segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="label">Label da chave</Label>
            <Input
              id="label"
              value={newKeyLabel}
              onChange={(e) => setNewKeyLabel(e.target.value)}
              placeholder="Ex: Sistema de CRM, ERP Interno..."
            />
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
