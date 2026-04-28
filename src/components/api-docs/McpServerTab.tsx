import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Server, Copy, Check, ExternalLink, KeyRound, BookOpen, Bot } from "lucide-react";
import { Link } from "react-router-dom";

const MCP_URL = "https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/mcp-server";

const TOOLS = [
  { name: "list_clients", desc: "Lista clientes/devedores da carteira (filtros: status, credor, cpf)." },
  { name: "get_client", desc: "Busca um cliente por id ou CPF." },
  { name: "create_client", desc: "Cria/atualiza (upsert) um cliente." },
  { name: "update_client_status", desc: "Atualiza o status de cobrança." },
  { name: "list_agreements", desc: "Lista acordos comerciais (filtros: status, cpf, credor)." },
  { name: "get_agreement", desc: "Busca acordo por id, com parcelas." },
  { name: "list_payments", desc: "Lista pagamentos por acordo ou período." },
  { name: "lookup_debtor", desc: "Consulta dívidas por CPF e devolve link do portal." },
  { name: "list_credores", desc: "Lista credores cadastrados." },
  { name: "list_status_types", desc: "Lista tipos de status de cobrança." },
  { name: "calculate_propensity", desc: "Score de propensão de pagamento (0-100)." },
  { name: "send_whatsapp", desc: "Envia mensagem WhatsApp unitária." },
  { name: "get_client_timeline", desc: "Timeline omnichannel de um cliente." },
];

const CopyBtn = ({ text }: { text: string }) => {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
};

const CodeBlock = ({ code }: { code: string }) => (
  <div className="relative">
    <pre className="bg-muted text-muted-foreground rounded-md p-4 text-xs overflow-auto border border-border">
      <code>{code}</code>
    </pre>
    <div className="absolute top-2 right-2">
      <CopyBtn text={code} />
    </div>
  </div>
);

const McpServerTab = ({ publicView = false }: { publicView?: boolean }) => {
  const claudeConfig = `{
  "mcpServers": {
    "rivo-connect": {
      "transport": {
        "type": "http",
        "url": "${MCP_URL}",
        "headers": {
          "X-API-Key": "SUA_API_KEY_AQUI"
        }
      }
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "rivo-connect": {
      "url": "${MCP_URL}",
      "headers": { "X-API-Key": "SUA_API_KEY_AQUI" }
    }
  }
}`;

  const n8nConfig = `// n8n MCP Client Tool node:
// Endpoint URL: ${MCP_URL}
// Authentication: Header Auth → name "X-API-Key", value "SUA_API_KEY_AQUI"`;

  const curlInit = `curl -X POST ${MCP_URL} \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -H "X-API-Key: SUA_API_KEY_AQUI" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center shrink-0">
                <Server className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  Servidor MCP — RIVO CONNECT
                  <Badge variant="secondary">v1.0</Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  Integre CRMs e agentes de IA (Claude, Cursor, ChatGPT, n8n, Zapier AI) com a base do
                  RIVO via Model Context Protocol. Uma única URL + sua API Key e o agente já enxerga
                  carteira, acordos, pagamentos e canais.
                </CardDescription>
              </div>
            </div>
            {!publicView && (
              <Button asChild variant="outline" size="sm">
                <Link to="/configuracoes/api">
                  <KeyRound className="w-4 h-4 mr-2" /> Gerar API Key
                </Link>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">URL do servidor MCP</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-xs font-mono">{MCP_URL}</code>
              <CopyBtn text={MCP_URL} />
            </div>
          </div>

          <Alert>
            <KeyRound className="w-4 h-4" />
            <AlertTitle>Autenticação</AlertTitle>
            <AlertDescription>
              Envie o header <code className="bg-muted px-1.5 py-0.5 rounded">X-API-Key</code> com a
              chave gerada em <strong>Configurações → API REST</strong>. A mesma chave usada na API REST
              vale para o MCP — isolamento por tenant é automático.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Configuração por cliente
          </CardTitle>
          <CardDescription>
            Cole o snippet no arquivo de configuração do seu agente. Substitua{" "}
            <code className="bg-muted px-1 rounded">SUA_API_KEY_AQUI</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="cursor">Cursor</TabsTrigger>
              <TabsTrigger value="n8n">n8n</TabsTrigger>
              <TabsTrigger value="curl">cURL (teste)</TabsTrigger>
            </TabsList>
            <TabsContent value="claude" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Arquivo: <code className="bg-muted px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code> (macOS) ou{" "}
                <code className="bg-muted px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code> (Windows)
              </p>
              <CodeBlock code={claudeConfig} />
            </TabsContent>
            <TabsContent value="cursor" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Settings → MCP → Add new server (modo HTTP).
              </p>
              <CodeBlock code={cursorConfig} />
            </TabsContent>
            <TabsContent value="n8n" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Use o node <strong>MCP Client Tool</strong> dentro de um AI Agent.
              </p>
              <CodeBlock code={n8nConfig} />
            </TabsContent>
            <TabsContent value="curl" className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Listar todas as tools disponíveis no servidor.
              </p>
              <CodeBlock code={curlInit} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Tools disponíveis
          </CardTitle>
          <CardDescription>
            {TOOLS.length} ferramentas expostas. O agente descobre input schemas automaticamente via{" "}
            <code className="bg-muted px-1 rounded">tools/list</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2">
            {TOOLS.map((t) => (
              <div key={t.name} className="border border-border rounded-md p-3 bg-card">
                <code className="text-xs font-mono text-primary font-semibold">{t.name}</code>
                <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Casos de uso típicos</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-2 text-muted-foreground list-disc pl-5">
            <li><strong>HubSpot/Pipedrive/Salesforce:</strong> agente de IA puxa dívidas do RIVO ao abrir um contato.</li>
            <li><strong>n8n / Zapier AI:</strong> workflows que decidem quando criar acordo ou disparar WhatsApp.</li>
            <li><strong>Claude/ChatGPT internos:</strong> "quanto recebi esta semana do credor X?" responde via MCP.</li>
            <li><strong>Apps próprios:</strong> qualquer agente compatível com MCP Streamable HTTP.</li>
          </ul>
          <div className="mt-4">
            <Button asChild variant="outline" size="sm">
              <a href="https://modelcontextprotocol.io" target="_blank" rel="noreferrer">
                Spec MCP <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default McpServerTab;
