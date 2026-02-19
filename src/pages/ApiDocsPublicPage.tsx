import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, Copy, Code2, BookOpen, Zap, Shield, CreditCard, Handshake, Globe, MessageSquare, Bell, Settings2, AlertTriangle } from "lucide-react";

const BASE_URL = "https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{lang}</span>
        <button onClick={handleCopy} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 text-sm overflow-x-auto text-zinc-200 font-mono leading-relaxed">{code}</pre>
    </div>
  );
}

function EndpointRow({ method, path, description, children }: { method: string; path: string; description: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const colors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    POST: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    PUT: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    DELETE: "bg-red-500/10 text-red-600 border-red-500/30",
  };
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
      <button className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-left" onClick={() => setOpen(!open)}>
        <Badge variant="outline" className={`font-mono text-xs font-bold ${colors[method]}`}>{method}</Badge>
        <code className="text-sm font-mono text-zinc-900 dark:text-zinc-100 flex-1">{path}</code>
        <span className="text-sm text-zinc-500 hidden sm:block">{description}</span>
      </button>
      {open && children && <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">{children}</div>}
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4 mt-8 first:mt-0">
      <Icon className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
    </div>
  );
}

export default function ApiDocsPublicPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center"><Code2 className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">CollectFlow API</h1>
              <p className="text-xs text-zinc-500">REST API completa para gestão de cobranças</p>
            </div>
          </div>
          <Badge className="bg-blue-600/10 text-blue-600 border-blue-600/30 hover:bg-blue-600/10">v2.0</Badge>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-2">
        {/* URL Base */}
        <Card className="border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">URL Base da API</p>
            <CodeBlock code={BASE_URL} lang="URL" />
            <p className="text-xs text-zinc-500 mt-3 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Todas as requisições requerem <code className="bg-zinc-200 dark:bg-zinc-800 px-1 rounded text-xs">X-API-Key</code>
            </p>
          </CardContent>
        </Card>

        {/* ── Autenticação ── */}
        <SectionHeader icon={Shield} title="1. Autenticação" />
        <Card>
          <CardContent className="pt-6 space-y-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Inclua sua chave no header <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">X-API-Key</code>. 
              Chaves têm prefixo <code className="font-mono">cf_</code> e são vinculadas a um tenant.
            </p>
            <CodeBlock code={`curl "${BASE_URL}/health" \\\n  -H "X-API-Key: cf_xxxxxxxxxxxxxxxxxxxxxxxx"`} lang="cURL" />
          </CardContent>
        </Card>

        {/* ── Clientes ── */}
        <SectionHeader icon={BookOpen} title="2. Clientes / Mailing" />
        <div className="space-y-2">
          <EndpointRow method="GET" path="/clients" description="Listar clientes (paginado)">
            <p className="text-sm text-zinc-500 mb-2">Query params: <code>page</code>, <code>limit</code> (max 500), <code>status</code>, <code>credor</code>, <code>cpf</code></p>
            <CodeBlock code={`curl "${BASE_URL}/clients?page=1&limit=100&status=pendente" \\\n  -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="GET" path="/clients/:id" description="Buscar cliente por UUID">
            <CodeBlock code={`curl "${BASE_URL}/clients/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="POST" path="/clients" description="Criar/atualizar 1 cliente (upsert)">
            <p className="text-sm text-zinc-500 mb-2">Aceita formato mailing (NOME_DEVEDOR, CNPJ_CPF, etc.) ou formato interno</p>
            <CodeBlock code={`{\n  "CREDOR": "EMPRESA",\n  "COD_DEVEDOR": "12345",\n  "COD_CONTRATO": "CTR-2026-001",\n  "NOME_DEVEDOR": "João Silva",\n  "CNPJ_CPF": "123.456.789-00",\n  "FONE_1": "(11) 99999-0000",\n  "FONE_2": "(11) 88888-0000",\n  "FONE_3": "(11) 77777-0000",\n  "PARCELA": 1,\n  "DT_VENCIMENTO": "01/03/2026",\n  "DT_PAGAMENTO": "",\n  "VL_TITULO": 1000,\n  "VL_ATUALIZADO": 1100,\n  "VL_SALDO": 900,\n  "STATUS": "ATIVO"\n}`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="POST" path="/clients/bulk" description="Inserção em massa (até 500/chamada)">
            <CodeBlock code={`{\n  "records": [\n    { "CREDOR": "EMPRESA", "NOME_DEVEDOR": "João", "CNPJ_CPF": "123...", "PARCELA": 1, "DT_VENCIMENTO": "01/03/2026", "VL_ATUALIZADO": 1100, "STATUS": "ATIVO" }\n  ],\n  "upsert": true,\n  "upsert_key": "external_id"\n}`} lang="JSON" />
            <p className="text-sm text-zinc-500 mt-2 font-medium">Resposta:</p>
            <CodeBlock code={`{ "success": true, "inserted": 450, "updated": 30, "skipped": 20, "errors": [...], "total": 500 }`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="PUT" path="/clients/:id" description="Atualizar cliente por UUID">
            <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid" \\\n  -H "X-API-Key: cf_..." -d '{"status":"pago","valor_pago":500}'`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="PUT" path="/clients/by-external/:id" description="Atualizar por external_id">
            <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/by-external/EXT-001" \\\n  -H "X-API-Key: cf_..." -d '{"status":"pago"}'`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="PUT" path="/clients/:id/status" description="Atualizar status de cobrança (funil)">
            <CodeBlock code={`curl -X PUT "${BASE_URL}/clients/uuid/status" \\\n  -H "X-API-Key: cf_..." -d '{"status_cobranca_id":"uuid-do-status"}'`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="DELETE" path="/clients/:id" description="Deletar por UUID">
            <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="DELETE" path="/clients/by-cpf/:cpf" description="Deletar todos de um CPF">
            <CodeBlock code={`curl -X DELETE "${BASE_URL}/clients/by-cpf/123.456.789-00" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
        </div>

        {/* ── Acordos ── */}
        <SectionHeader icon={Handshake} title="3. Acordos / Negociação" />
        <div className="space-y-2">
          <EndpointRow method="GET" path="/agreements" description="Listar acordos (paginado)">
            <p className="text-sm text-zinc-500">Filtros: <code>status</code> (pending, approved, rejected), <code>cpf</code>, <code>credor</code></p>
            <CodeBlock code={`curl "${BASE_URL}/agreements?status=pending" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="GET" path="/agreements/:id" description="Buscar acordo por UUID">
            <CodeBlock code={`curl "${BASE_URL}/agreements/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="POST" path="/agreements" description="Criar proposta de acordo">
            <CodeBlock code={`{\n  "client_cpf": "123.456.789-00",\n  "client_name": "João Silva",\n  "credor": "EMPRESA",\n  "original_total": 5000,\n  "proposed_total": 3500,\n  "new_installments": 10,\n  "new_installment_value": 350,\n  "first_due_date": "2026-04-01",\n  "discount_percent": 30,\n  "notes": "Proposta via API"\n}`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="PUT" path="/agreements/:id/approve" description="Aprovar acordo">
            <CodeBlock code={`curl -X PUT "${BASE_URL}/agreements/uuid/approve" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="PUT" path="/agreements/:id/reject" description="Rejeitar acordo">
            <CodeBlock code={`curl -X PUT "${BASE_URL}/agreements/uuid/reject" \\\n  -H "X-API-Key: cf_..." -d '{"reason":"Valor abaixo do mínimo"}'`} lang="cURL" />
          </EndpointRow>
        </div>

        {/* ── Pagamentos ── */}
        <SectionHeader icon={CreditCard} title="4. Pagamentos" />
        <div className="space-y-2">
          <EndpointRow method="GET" path="/payments" description="Listar pagamentos (paginado)">
            <p className="text-sm text-zinc-500">Filtros: <code>status</code>, <code>client_id</code></p>
            <CodeBlock code={`curl "${BASE_URL}/payments?status=pendente" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="GET" path="/payments/:id" description="Status de um pagamento">
            <p className="text-sm text-zinc-500 mb-2">Retorna: valor, status, tipo, pix_copia_cola, link_boleto, link_cartao</p>
            <CodeBlock code={`curl "${BASE_URL}/payments/uuid" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="POST" path="/payments/pix" description="Gerar cobrança PIX">
            <CodeBlock code={`{\n  "client_id": "uuid-do-cliente",\n  "valor": 350.00,\n  "data_vencimento": "2026-04-01"\n}`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="POST" path="/payments/cartao" description="Gerar cobrança Cartão">
            <CodeBlock code={`{\n  "client_id": "uuid-do-cliente",\n  "valor": 350.00,\n  "data_vencimento": "2026-04-01"\n}`} lang="JSON" />
          </EndpointRow>
        </div>

        {/* ── Portal ── */}
        <SectionHeader icon={Globe} title="5. Portal do Devedor" />
        <div className="space-y-2">
          <EndpointRow method="POST" path="/portal/lookup" description="Consultar dívidas por CPF">
            <p className="text-sm text-zinc-500 mb-2">Retorna parcelas pendentes do CPF</p>
            <CodeBlock code={`curl -X POST "${BASE_URL}/portal/lookup" \\\n  -H "X-API-Key: cf_..." -d '{"cpf":"123.456.789-00"}'`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="POST" path="/portal/agreement" description="Criar proposta via portal">
            <p className="text-sm text-zinc-500 mb-2">Mesmos campos de POST /agreements. Marca como origem portal.</p>
            <CodeBlock code={`{\n  "client_cpf": "123.456.789-00",\n  "client_name": "João Silva",\n  "credor": "EMPRESA",\n  "original_total": 5000,\n  "proposed_total": 3500,\n  "new_installments": 10,\n  "new_installment_value": 350,\n  "first_due_date": "2026-04-01"\n}`} lang="JSON" />
          </EndpointRow>
        </div>

        {/* ── Cadastros ── */}
        <SectionHeader icon={Settings2} title="6. Cadastros" />
        <div className="space-y-2">
          <EndpointRow method="GET" path="/status-types" description="Listar status de cobrança">
            <p className="text-sm text-zinc-500 mb-2">Retorna id, nome, cor e ordem (etapas do funil)</p>
            <CodeBlock code={`curl "${BASE_URL}/status-types" -H "X-API-Key: cf_..."\n\n// Resposta:\n// { "data": [{ "id": "uuid", "nome": "Novo", "cor": "#3b82f6", "ordem": 1 }, ...] }`} lang="cURL" />
          </EndpointRow>
          <EndpointRow method="GET" path="/credores" description="Listar credores ativos">
            <p className="text-sm text-zinc-500 mb-2">Retorna dados com regras de negociação (parcelas, desconto, juros)</p>
            <CodeBlock code={`curl "${BASE_URL}/credores" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
        </div>

        {/* ── WhatsApp ── */}
        <SectionHeader icon={MessageSquare} title="7. WhatsApp" />
        <div className="space-y-2">
          <EndpointRow method="POST" path="/whatsapp/send" description="Enviar mensagem individual">
            <p className="text-sm text-zinc-500 mb-2">Requer instância WhatsApp conectada</p>
            <CodeBlock code={`{\n  "phone": "5511999990000",\n  "message": "Olá! Sua parcela vence em breve. Acesse o portal para negociar."\n}`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="POST" path="/whatsapp/bulk" description="Envio em massa (até 200/chamada)">
            <CodeBlock code={`{\n  "messages": [\n    { "phone": "5511999990000", "message": "Mensagem 1" },\n    { "phone": "5511888880000", "message": "Mensagem 2" }\n  ]\n}`} lang="JSON" />
          </EndpointRow>
        </div>

        {/* ── Webhooks ── */}
        <SectionHeader icon={Bell} title="8. Webhooks" />
        <div className="space-y-2">
          <EndpointRow method="POST" path="/webhooks/configure" description="Registrar callback URL">
            <CodeBlock code={`{\n  "url": "https://seu-sistema.com/webhook",\n  "events": ["agreement.approved", "payment.confirmed", "client.updated"]\n}`} lang="JSON" />
          </EndpointRow>
          <EndpointRow method="GET" path="/webhooks" description="Ver configuração atual">
            <CodeBlock code={`curl "${BASE_URL}/webhooks" -H "X-API-Key: cf_..."`} lang="cURL" />
          </EndpointRow>
        </div>

        {/* ── Propensity Score ── */}
        <SectionHeader icon={Zap} title="9. Propensity Score (IA)" />
        <div className="space-y-2">
          <EndpointRow method="POST" path="/propensity/calculate" description="Calcular score de propensão ao pagamento">
            <p className="text-sm text-zinc-500 mb-2">Score 0-100 calculado por IA analisando histórico do devedor</p>
            <CodeBlock code={`// CPF único\n{ "cpf": "123.456.789-00" }\n\n// Lote\n{ "cpfs": ["123.456.789-00", "987.654.321-00"] }`} lang="JSON" />
          </EndpointRow>
        </div>

        {/* ── Campos aceitos ── */}
        <SectionHeader icon={BookOpen} title="10. Campos aceitos (Clientes/Mailing)" />
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
                  {[
                    ["NOME_DEVEDOR / nome_completo", "string", "✅", "Nome completo do devedor"],
                    ["CNPJ_CPF / cpf", "string", "✅", "CPF ou CNPJ"],
                    ["CREDOR / credor", "string", "✅", "Nome do credor"],
                    ["VL_ATUALIZADO / valor_parcela", "number", "✅", "Valor atualizado da parcela"],
                    ["DT_VENCIMENTO / data_vencimento", "string", "✅", "DD/MM/YYYY ou YYYY-MM-DD"],
                    ["COD_DEVEDOR / external_id", "string", "—", "ID externo (upsert key)"],
                    ["COD_CONTRATO / cod_contrato", "string", "—", "Número do contrato"],
                    ["PARCELA / numero_parcela", "integer", "—", "Nº parcela (padrão: 1)"],
                    ["total_parcelas", "integer", "—", "Total de parcelas"],
                    ["DT_PAGAMENTO / data_pagamento", "date", "—", "Data efetiva do pagamento"],
                    ["VL_SALDO / valor_saldo", "number", "—", "Valor do saldo devedor"],
                    ["STATUS / status", "string", "—", "ATIVO | CANCELADO | PAGO | QUEBRADO"],
                    ["status_cobranca_id", "UUID", "—", "UUID do status de cobrança"],
                    ["FONE_1 / phone", "string", "—", "Telefone principal"],
                    ["FONE_2 / phone2", "string", "—", "Telefone secundário"],
                    ["FONE_3 / phone3", "string", "—", "Telefone terciário"],
                    ["EMAIL / email", "string", "—", "Email do devedor"],
                    ["ENDERECO, NUMERO, BAIRRO", "string", "—", "Componentes do endereço"],
                    ["CIDADE / cidade", "string", "—", "Cidade"],
                    ["ESTADO / uf", "string", "—", "UF (2 letras)"],
                    ["CEP / cep", "string", "—", "CEP"],
                  ].map(([field, type, req, desc]) => (
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

        {/* ── Exemplos ── */}
        <SectionHeader icon={Zap} title="11. Exemplos de Código" />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Python — Importação em Massa + Acordos</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock code={`import requests

API_KEY = "cf_xxxxxxxxxxxxxxxxxxxxxxxx"
BASE = "${BASE_URL}"
H = {"X-API-Key": API_KEY, "Content-Type": "application/json"}

# 1. Importar mailing em lotes de 500
all_clients = [...]
for i in range(0, len(all_clients), 500):
    batch = all_clients[i:i+500]
    r = requests.post(f"{BASE}/clients/bulk", json={"records": batch, "upsert": True}, headers=H)
    print(r.json())

# 2. Listar credores
credores = requests.get(f"{BASE}/credores", headers=H).json()

# 3. Criar acordo
acordo = requests.post(f"{BASE}/agreements", json={
    "client_cpf": "123.456.789-00", "client_name": "João",
    "credor": "EMPRESA", "original_total": 5000, "proposed_total": 3500,
    "new_installments": 10, "new_installment_value": 350,
    "first_due_date": "2026-04-01"
}, headers=H).json()

# 4. Aprovar acordo
requests.put(f"{BASE}/agreements/{acordo['data']['id']}/approve", headers=H)

# 5. Gerar cobrança PIX
pix = requests.post(f"{BASE}/payments/pix", json={
    "client_id": "uuid", "valor": 350, "data_vencimento": "2026-04-01"
}, headers=H).json()

# 6. Enviar WhatsApp
requests.post(f"{BASE}/whatsapp/send", json={
    "phone": "5511999990000", "message": "Sua cobrança PIX foi gerada!"
}, headers=H)`} lang="python" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Node.js — Fluxo Completo</CardTitle></CardHeader>
          <CardContent>
            <CodeBlock code={`const API_KEY = "cf_xxxxxxxxxxxxxxxxxxxxxxxx";
const BASE = "${BASE_URL}";
const H = { "X-API-Key": API_KEY, "Content-Type": "application/json" };

// Listar clientes pendentes
const clients = await fetch(\`\${BASE}/clients?status=pendente&limit=100\`, { headers: H }).then(r => r.json());

// Consultar dívidas via portal
const debts = await fetch(\`\${BASE}/portal/lookup\`, {
  method: "POST", headers: H, body: JSON.stringify({ cpf: "123.456.789-00" })
}).then(r => r.json());

// Criar acordo
const agreement = await fetch(\`\${BASE}/agreements\`, {
  method: "POST", headers: H,
  body: JSON.stringify({
    client_cpf: "123.456.789-00", client_name: "João Silva",
    credor: "EMPRESA", original_total: 5000, proposed_total: 3500,
    new_installments: 10, new_installment_value: 350, first_due_date: "2026-04-01"
  })
}).then(r => r.json());

// Verificar status de pagamento
const payment = await fetch(\`\${BASE}/payments/uuid\`, { headers: H }).then(r => r.json());

// Configurar webhook
await fetch(\`\${BASE}/webhooks/configure\`, {
  method: "POST", headers: H,
  body: JSON.stringify({ url: "https://meu-sistema.com/webhook", events: ["agreement.approved"] })
});`} lang="javascript" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">cURL — Referência Rápida</CardTitle></CardHeader>
          <CardContent>
            <CodeBlock code={`# Listar clientes
curl "${BASE_URL}/clients?page=1&limit=100" -H "X-API-Key: cf_..."

# Criar cliente (formato mailing)
curl -X POST "${BASE_URL}/clients" -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\
  -d '{"NOME_DEVEDOR":"João","CNPJ_CPF":"123...","CREDOR":"EMPRESA","VL_ATUALIZADO":1100,"DT_VENCIMENTO":"01/03/2026","PARCELA":1,"STATUS":"ATIVO"}'

# Listar acordos pendentes
curl "${BASE_URL}/agreements?status=pending" -H "X-API-Key: cf_..."

# Aprovar acordo
curl -X PUT "${BASE_URL}/agreements/uuid/approve" -H "X-API-Key: cf_..."

# Gerar PIX
curl -X POST "${BASE_URL}/payments/pix" -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\
  -d '{"client_id":"uuid","valor":350,"data_vencimento":"2026-04-01"}'

# Verificar pagamento
curl "${BASE_URL}/payments/uuid" -H "X-API-Key: cf_..."

# Listar credores
curl "${BASE_URL}/credores" -H "X-API-Key: cf_..."

# Listar status de cobrança
curl "${BASE_URL}/status-types" -H "X-API-Key: cf_..."

# Enviar WhatsApp
curl -X POST "${BASE_URL}/whatsapp/send" -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\
  -d '{"phone":"5511999990000","message":"Olá!"}'

# Calcular propensity
curl -X POST "${BASE_URL}/propensity/calculate" -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\
  -d '{"cpf":"123.456.789-00"}'

# Configurar webhook
curl -X POST "${BASE_URL}/webhooks/configure" -H "X-API-Key: cf_..." -H "Content-Type: application/json" \\
  -d '{"url":"https://meu-sistema.com/webhook"}'`} lang="bash" />
          </CardContent>
        </Card>

        {/* ── Erros e Rate Limits ── */}
        <SectionHeader icon={AlertTriangle} title="12. Códigos de Erro e Rate Limits" />
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Significado</TableHead>
                  <TableHead>Ação recomendada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["200", "Sucesso", "—"],
                  ["201", "Criado com sucesso", "—"],
                  ["401", "API Key inválida ou ausente", "Verifique o header X-API-Key"],
                  ["404", "Recurso não encontrado", "Verifique o UUID ou rota"],
                  ["422", "Validação falhou", "Corrija os campos indicados no campo 'errors'"],
                  ["429", "Rate limit excedido", "Aguarde 60s e tente novamente"],
                  ["500", "Erro interno", "Tente novamente. Se persistir, contate suporte"],
                ].map(([code, meaning, action]) => (
                  <TableRow key={code}>
                    <TableCell><Badge variant="outline" className={`font-mono ${code === "200" || code === "201" ? "text-emerald-600" : code.startsWith("4") ? "text-amber-600" : "text-red-600"}`}>{code}</Badge></TableCell>
                    <TableCell className="text-sm">{meaning}</TableCell>
                    <TableCell className="text-sm text-zinc-500">{action}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="mt-6 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h4 className="text-sm font-semibold mb-2">Rate Limits</h4>
              <ul className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
                <li>• <strong>Geral:</strong> 100 requisições/minuto por API Key</li>
                <li>• <strong>Bulk:</strong> 500 registros/chamada, recomendado delay de 200-500ms entre lotes</li>
                <li>• <strong>WhatsApp Bulk:</strong> 200 mensagens/chamada</li>
                <li>• <strong>Propensity:</strong> 50 CPFs/chamada</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Boas práticas */}
        <Card className="mt-4">
          <CardHeader><CardTitle className="text-base">Boas práticas</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {[
                "Use external_id para garantir idempotência — reenvios não criam duplicatas",
                "Sempre use upsert: true no /bulk para reenvios seguros",
                "Monitore o campo 'errors' na resposta para tratar registros inválidos",
                "Use /health para verificar disponibilidade antes de importações grandes",
                "Configure webhooks para receber notificações em tempo real",
                "Use o Propensity Score para priorizar devedores com maior chance de pagamento",
                "Revogue chaves antigas e gere novas regularmente por segurança",
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center space-y-2">
          <p className="text-sm text-zinc-500">Para obter sua chave de API, solicite ao administrador do sistema CollectFlow.</p>
          <p className="text-xs text-zinc-400">Esta documentação é pública e não expõe dados sensíveis.</p>
        </div>
      </footer>
    </div>
  );
}
