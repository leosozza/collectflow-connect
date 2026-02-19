import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Copy, Code2, BookOpen, Zap, Shield, ExternalLink } from "lucide-react";

const BASE_URL = "https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{lang}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
        >
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto text-zinc-200 font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointRow({
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
    GET: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    POST: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  };
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left"
        onClick={() => setOpen(!open)}
      >
        <Badge variant="outline" className={`font-mono text-xs font-bold ${colors[method]}`}>
          {method}
        </Badge>
        <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100 flex-1">{path}</code>
        <span className="text-sm text-zinc-500 hidden sm:block">{description}</span>
      </button>
      {open && children && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">{children}</div>
      )}
    </div>
  );
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

const fields = [
  ["nome_completo", "string", "✅", "Nome completo do devedor"],
  ["cpf", "string", "✅", "CPF (qualquer formato — será sanitizado)"],
  ["credor", "string", "✅", "Nome do credor/empresa"],
  ["valor_parcela", "number", "✅", "Valor da parcela em R$"],
  ["data_vencimento", "string", "✅", "Data no formato YYYY-MM-DD"],
  ["external_id", "string", "—", "ID no sistema externo (usado para upsert idempotente)"],
  ["numero_parcela", "integer", "—", "Número da parcela atual (padrão: 1)"],
  ["total_parcelas", "integer", "—", "Total de parcelas do acordo"],
  ["valor_entrada", "number", "—", "Valor de entrada pago"],
  ["valor_pago", "number", "—", "Valor já pago acumulado"],
  ["status", "string", "—", "pendente | pago | quebrado"],
  ["status_cobranca_id", "string (UUID)", "—", "UUID do status de cobrança (etapa do funil de cobrança)"],
  ["phone", "string", "—", "Telefone com DDD"],
  ["email", "string", "—", "Email do devedor"],
  ["endereco", "string", "—", "Endereço completo"],
  ["cidade", "string", "—", "Cidade"],
  ["uf", "string", "—", "UF (2 letras)"],
  ["cep", "string", "—", "CEP"],
  ["observacoes", "string", "—", "Observações livres"],
];

export default function ApiDocsPublicPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Code2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">CollectFlow API</h1>
              <p className="text-xs text-zinc-500">REST API para gestão de leads e cobranças</p>
            </div>
          </div>
          <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30 hover:bg-blue-600/10">
            Documentação Pública
          </Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* URL Base */}
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">URL Base da API</p>
            <CodeBlock code={BASE_URL} lang="URL" />
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Todas as requisições requerem autenticação via header <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">X-API-Key</code>
            </p>
          </CardContent>
        </Card>

        {/* Autenticação */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Autenticação</h2>
          </div>
          <Card>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Inclua sua chave de API no header <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code> de todas as requisições.
                A chave deve ser solicitada ao administrador do sistema.
              </p>
              <CodeBlock code={`X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`} lang="Header HTTP" />
              <p className="text-xs text-zinc-500">
                As chaves têm prefixo <code className="font-mono">cf_</code> e são vinculadas a um tenant específico. Cada chamada é registrada.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Endpoints */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Endpoints</h2>
          </div>
          <div className="space-y-2">
            <EndpointRow method="GET" path="/health" description="Status da API">
              <p className="text-sm text-zinc-500">Verifica se a API está online. Não requer autenticação.</p>
              <CodeBlock code={`curl "${BASE_URL}/health"`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="GET" path="/clients" description="Listar clientes (paginado)">
              <p className="text-sm text-zinc-500 mb-2">
                Query params: <code>page</code> (padrão 1), <code>limit</code> (max 500), <code>status</code>, <code>credor</code>, <code>cpf</code>
              </p>
              <CodeBlock code={`curl "${BASE_URL}/clients?page=1&limit=100&status=pendente" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="GET" path="/clients/:id" description="Buscar cliente por UUID">
              <CodeBlock code={`curl "${BASE_URL}/clients/uuid-do-cliente" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="POST" path="/clients" description="Criar ou atualizar 1 cliente (upsert por CPF)">
              <p className="text-sm text-zinc-500 mb-2">
                Campos obrigatórios: <code>nome_completo</code>, <code>cpf</code>, <code>credor</code>, <code>valor_parcela</code>, <code>data_vencimento</code>
              </p>
              <CodeBlock code={singlePayloadExample} lang="JSON — Body" />
            </EndpointRow>

            <EndpointRow method="POST" path="/clients/bulk" description="Inserção em massa (até 500/chamada)">
              <div className="space-y-2">
                <p className="text-sm text-zinc-500">
                  Máximo 500 registros por chamada. Para 10.000+ registros, faça múltiplas chamadas com delay de 200-500ms entre elas.
                </p>
                <CodeBlock code={bulkPayloadExample} lang="JSON — Body" />
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mt-3">Resposta:</p>
                <CodeBlock code={responseExample} lang="JSON — Response" />
              </div>
            </EndpointRow>

            <EndpointRow method="PUT" path="/clients/:id" description="Atualizar cliente por UUID">
              <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid" \\\n  -H "X-API-Key: cf_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"pago","valor_pago":500}'`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="PUT" path="/clients/by-external/:external_id" description="Atualizar por external_id">
              <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/by-external/EXT-001" \\\n  -H "X-API-Key: cf_..." \\\n  -H "Content-Type: application/json" \\\n  -d '{"status":"pago"}'`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="DELETE" path="/clients/:id" description="Deletar cliente por UUID">
              <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/uuid" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
            </EndpointRow>

            <EndpointRow method="DELETE" path="/clients/by-cpf/:cpf" description="Deletar todos os registros de um CPF">
              <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/by-cpf/123.456.789-00" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
            </EndpointRow>
          </div>
        </section>

        {/* Campos */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Campos aceitos</h2>
          </div>
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
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
                    {fields.map(([field, type, req, desc]) => (
                      <TableRow key={field}>
                        <TableCell><code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">{field}</code></TableCell>
                        <TableCell className="text-sm text-zinc-500">{type}</TableCell>
                        <TableCell className="text-sm">{req}</TableCell>
                        <TableCell className="text-sm text-zinc-500">{desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Exemplos de código */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Exemplos — Importação em Massa</h2>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estratégia para 10.000+ registros</CardTitle>
              <CardDescription>Divida em lotes de 500, use upsert para idempotência</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Registros/lote", value: "500" },
                  { label: "Lotes para 10k", value: "20" },
                  { label: "Upsert idempotente", value: "✅" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                    <p className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{stat.value}</p>
                    <p className="text-xs text-zinc-500">{stat.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Python (requests)</p>
              <CodeBlock code={pythonExample} lang="python" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Node.js / JavaScript</p>
              <CodeBlock code={nodeExample} lang="javascript" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">cURL</p>
              <CodeBlock code={curlExample} lang="bash" />
            </div>
          </div>
        </section>

        {/* Boas práticas */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Boas práticas</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                {[
                  "Use external_id para garantir idempotência — reenvios não criam duplicatas",
                  "Sempre use upsert: true no /bulk para reenvios seguros",
                  "Monitore o campo \"errors\" na resposta para tratar registros inválidos",
                  "Adicione um delay de 200-500ms entre lotes para não sobrecarregar",
                  "Revogue chaves antigas e gere novas regularmente por segurança",
                  "Use o endpoint /health para verificar disponibilidade antes de importações grandes",
                ].map((tip, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-2">
          <p className="text-sm text-zinc-500">
            Para obter sua chave de API, solicite ao administrador do sistema CollectFlow.
          </p>
          <p className="text-xs text-zinc-400">
            Esta documentação é pública e não expõe dados sensíveis, chaves ou informações de clientes.
          </p>
        </div>
      </footer>
    </div>
  );
}
