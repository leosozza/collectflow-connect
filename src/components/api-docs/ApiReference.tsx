import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield, Layers, AlertTriangle, Gauge, Repeat, Bell, Building2,
  TestTube2, Download, Mail, Copy, CheckCircle2, FileJson, FileText, Code2,
} from "lucide-react";
import { toast } from "sonner";

const BASE_URL = "https://hulwcntfioqifopyjcvv.supabase.co/functions/v1/clients-api";

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative rounded-lg bg-zinc-950 border border-zinc-800 overflow-hidden my-2">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
        <span className="text-xs text-zinc-400 font-mono">{lang}</span>
        <button onClick={handleCopy} className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 text-xs sm:text-sm overflow-x-auto text-zinc-200 font-mono leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

function CopyableEmail({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Resposta copiada — pronta para colar no e-mail");
    setTimeout(() => setCopied(false), 2500);
  };
  return (
    <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/50">
        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Mail className="w-3.5 h-3.5" /> Resposta consolidada para o cliente
        </span>
        <Button size="sm" variant="outline" onClick={handle}>
          {copied ? <CheckCircle2 className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
          <span className="ml-1.5 text-xs">{copied ? "Copiado" : "Copiar tudo"}</span>
        </Button>
      </div>
      <pre className="p-4 text-xs text-foreground font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-auto">{text}</pre>
    </div>
  );
}

const SCHEMA_CLIENT = [
  { field: "tenant_id", type: "uuid", req: "auto", desc: "Inferido da X-API-Key (não enviar)" },
  { field: "credor", type: "string", req: "sim", desc: "nome_fantasia OU razao_social do credor (ver GET /credores)" },
  { field: "nome_completo", type: "string (≥2)", req: "sim", desc: "Aliases aceitos: NOME_DEVEDOR, NOME COMPLETO" },
  { field: "cpf", type: "string", req: "sim", desc: "Com ou sem máscara. CNPJ aceito no mesmo campo. Alias: CNPJ_CPF" },
  { field: "external_id", type: "string", req: "não", desc: "ID do seu sistema. Usado como chave de upsert. Alias: COD_DEVEDOR" },
  { field: "cod_contrato", type: "string", req: "não", desc: "Código de contrato no seu sistema. Indexado para busca. Alias: COD_CONTRATO" },
  { field: "phone", type: "string", req: "não", desc: "E.164 ou nacional. Aliases: FONE_1, phone2 (FONE_2), phone3 (FONE_3)" },
  { field: "email", type: "string", req: "não", desc: "Validado por regex" },
  { field: "endereco", type: "string", req: "não", desc: "Concatenação automática se enviar ENDERECO/NUMERO/COMPLEMENTO/BAIRRO" },
  { field: "cidade / uf / cep", type: "string", req: "não", desc: "Aliases: CIDADE, ESTADO/UF, CEP" },
  { field: "numero_parcela", type: "integer", req: "não", desc: "Default 1. Alias: PARCELA" },
  { field: "total_parcelas", type: "integer", req: "não", desc: "Default 1" },
  { field: "valor_parcela", type: "number (decimal em reais)", req: "sim", desc: "≥ 0. Não usar centavos. Aliases: VL_TITULO, VL_ATUALIZADO" },
  { field: "valor_entrada", type: "number", req: "não", desc: "Default = valor_parcela" },
  { field: "valor_atualizado", type: "number", req: "não", desc: "Alias: VL_ATUALIZADO" },
  { field: "valor_saldo", type: "number", req: "não", desc: "Alias: VL_SALDO" },
  { field: "valor_pago", type: "number", req: "não", desc: "Default 0" },
  { field: "data_vencimento", type: "string YYYY-MM-DD ou DD/MM/YYYY", req: "sim", desc: "Auto-convertida para ISO. Alias: DT_VENCIMENTO" },
  { field: "data_pagamento", type: "string", req: "não", desc: "Mesmo formato. Alias: DT_PAGAMENTO" },
  { field: "status", type: "enum", req: "não", desc: "Valores: pendente | pago | quebrado. Default: pendente" },
  { field: "status_cobranca_id", type: "uuid", req: "não", desc: "Etapa do funil — ver GET /status-types" },
];

const SCHEMA_AGREEMENT = [
  { field: "client_cpf", type: "string", req: "sim", desc: "CPF do devedor" },
  { field: "client_name", type: "string", req: "sim", desc: "Nome completo" },
  { field: "credor", type: "string", req: "sim", desc: "Nome do credor (ver GET /credores)" },
  { field: "original_total", type: "number", req: "sim", desc: "Dívida original em reais" },
  { field: "proposed_total", type: "number", req: "sim", desc: "Total proposto após desconto" },
  { field: "new_installments", type: "integer", req: "sim", desc: "Quantidade de parcelas" },
  { field: "new_installment_value", type: "number", req: "sim", desc: "Valor de cada parcela" },
  { field: "first_due_date", type: "string YYYY-MM-DD", req: "sim", desc: "Vencimento da 1ª parcela" },
  { field: "discount_percent", type: "number", req: "não", desc: "Default 0" },
  { field: "notes", type: "string", req: "não", desc: "Observações livres" },
  { field: "status", type: "enum", req: "auto", desc: "Valores: pending | approved | rejected. Inicia em pending" },
];

const SCHEMA_PAYMENT = [
  { field: "client_id", type: "uuid", req: "sim", desc: "UUID do registro em /clients (não usar CPF)" },
  { field: "valor", type: "number", req: "sim", desc: "Valor da cobrança em reais" },
  { field: "data_vencimento", type: "string YYYY-MM-DD", req: "sim", desc: "Vencimento da cobrança" },
  { field: "tipo", type: "enum", req: "sim*", desc: "pix | cartao | boleto. Obrigatório em POST /payments; ignorado em /payments/{tipo}" },
  { field: "id_geral", type: "string", req: "auto", desc: "Gerado pelo servidor: API-PIX-{timestamp} / API-CARD-{...} / API-BOL-{...}" },
  { field: "status", type: "enum", req: "auto", desc: "pendente | pago | cancelado | expirado" },
];

const ERRORS = [
  { http: 401, code: "UNAUTHORIZED", msg: "X-API-Key inválida ou ausente", fix: "Confira o header X-API-Key e o status da chave em /api-docs → API Keys" },
  { http: 403, code: "FORBIDDEN_CREDOR", msg: "Esta chave está restrita ao credor X", fix: "Use uma chave do tenant (sem credor) ou troque o credor no body" },
  { http: 404, code: "NOT_FOUND", msg: "Recurso não encontrado", fix: "Verifique o UUID, CPF ou external_id" },
  { http: 422, code: "VALIDATION_FAILED", msg: "Validação falhou — campo errors[] lista os problemas", fix: "Corrigir cada item retornado em errors[]" },
  { http: 422, code: "BULK_LIMIT", msg: "Máximo de 500 registros por requisição bulk", fix: "Quebrar em batches ≤ 500" },
  { http: 422, code: "MISSING_FIELDS", msg: "Campos obrigatórios faltando: …", fix: "Preencher todos os campos da resposta" },
  { http: 500, code: "INTERNAL_ERROR", msg: "Erro retornado pelo banco/Supabase", fix: "Verificar payload; tentar novamente. Se persistir, abrir chamado" },
];

const RESPONSE_EMAIL = `Olá time da Y Brasil!

Segue a documentação técnica completa da API Rivo Connect.
Link público sempre atualizado: https://rivoconnect.com/api-docs/public
OpenAPI 3.1 (YAML): https://rivoconnect.com/api/openapi.yaml
Coleção Postman: https://rivoconnect.com/api/rivo-connect.postman_collection.json

1) AUTENTICAÇÃO
- Método: API Key (SHA-256 hash) no header.
- Header exato: X-API-Key: cf_xxxxxxxxxxxx
- Geração/rotação: painel Rivo Connect → API → "Nova Chave". A chave aparece UMA vez (cópia obrigatória).
- Sandbox: a base URL é a mesma; o isolamento é por tenant. Solicite um tenant de teste com chave dedicada.
- Base URL única (produção e sandbox):
  ${BASE_URL}

2) ENDPOINTS — todos os contratos completos com request/response/erros estão no link público (aba "Endpoints"). Resumo:
- POST /clients          → criar/atualizar 1 (upsert por external_id+tenant_id, fallback cpf+numero_parcela+tenant_id)
- POST /clients/bulk     → até 500 registros por chamada (resposta: inserted/updated/skipped/errors)
- GET  /clients?cpf=...  → lista paginada (limit máx 500). Ordenação: created_at desc.
- GET  /clients/{id}     → detalhe
- POST /payments         → cria cobrança (campo "tipo": pix|cartao|boleto)
- POST /payments/pix | /payments/cartao | /payments/boleto → atalhos por tipo
- GET  /payments/{id}    → status atual da cobrança
- GET  /payments/methods → lista meios nativos + customizados do tenant
- GET  /credores         → lista credores ativos (use o "nome_fantasia" como valor de "credor")
- POST /webhooks/configure → registra URL de callback
- (cancelamento e regerar boleto: roadmap — atualmente edita-se via PUT no /payments quando aplicável)

3) MAPEAMENTO DE CAMPOS
- snake_case em pt-BR. Aliases de mailing aceitos (NOME_DEVEDOR, CNPJ_CPF, COD_DEVEDOR, FONE_1, PARCELA, DT_VENCIMENTO, VL_TITULO, VL_ATUALIZADO, VL_SALDO, COD_CONTRATO).
- cpf/cnpj: aceita com ou sem máscara (mesmo campo "cpf").
- valor_parcela: decimal em reais (NÃO centavos).
- data_vencimento: YYYY-MM-DD ou DD/MM/YYYY (auto-convertido).
- credor: string. Use o "nome_fantasia" retornado por GET /credores. Único por tenant.
- external_id: máx 255 chars; aceita qualquer caractere; idempotência GARANTIDA por (external_id, tenant_id).
- cod_contrato: string livre, indexado, usado para conciliação.
- numero_parcela / total_parcelas: opcionais (default 1/1).
- Tipos de cobrança: pix, cartao, boleto + meios customizados (GET /payments/methods).
- Status cliente: pendente | pago | quebrado.
- Status pagamento: pendente | pago | cancelado | expirado.

4) WEBHOOKS
- Endpoint: POST /webhooks/configure { "url": "...", "events": [...] }
- Eventos: agreement.approved, payment.confirmed, client.updated (lista expansível).
- Recomendação adicional: polling em GET /payments/{id} até status=pago para garantir convergência.
- Validação de assinatura HMAC: roadmap (atualmente recomendamos URL com token na própria URL).

5) IDEMPOTÊNCIA
- Chave funcional: external_id por tenant (e cpf+numero_parcela como fallback).
- Reenvio do mesmo external_id → upsert (atualização silenciosa, NÃO duplica).
- /clients/bulk é parcial: registros válidos entram, inválidos retornam em errors[]. NÃO é atômico.

6) LIMITES
- Bulk clients: 500/chamada.
- Bulk WhatsApp: 200/chamada.
- Paginação: limit máx 500 (/clients), 200 (/agreements, /payments). Default 100/50.
- Rate-limit: política padrão Supabase Edge (sem 429 dedicado hoje). Em caso de 429, respeitar Retry-After.

7) CÓDIGOS DE ERRO
- 401 X-API-Key inválida/ausente
- 403 Credor fora de escopo (chave restrita)
- 404 Recurso inexistente
- 422 Validação (errors[] detalha)
- 500 Erro interno
- Formato: { "error": "...", "errors": [...] }

8) MULTI-CREDOR
- 1 tenant pode ter múltiplos credores. Liste com GET /credores.
- Use "nome_fantasia" no campo "credor" dos payloads (o sistema também aceita razao_social).
- Chave pode ser escopada a UM credor: tentativas em outros credores → 403.

9) FORMATO PREFERIDO
- OpenAPI 3.1 YAML disponível em /api/openapi.yaml (geramos cliente tipado).
- Coleção Postman v2.1 em /api/rivo-connect.postman_collection.json.
- Servidor MCP nativo: ${BASE_URL.replace("clients-api", "mcp-server")}
- Markdown: docs/API_REFERENCE.md no repositório do tenant.

10) AMBIENTE DE TESTE
- Liberamos chave de sandbox (tenant de teste) sob solicitação.
- CPFs de teste: 111.111.111-11 (sucesso), 000.000.000-00 (falha de validação).
- Para simular pagamento PIX/boleto em sandbox: PUT /payments/{id} com {"status":"pago"} ou usar o painel admin "Confirmação manual".

Qualquer dúvida, basta responder.
Equipe Rivo Connect`;

export default function ApiReference() {
  return (
    <div className="space-y-6">
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Code2 className="w-5 h-5 text-primary" />
            Referência Técnica Completa — Rivo Connect API
          </CardTitle>
          <CardDescription>
            v2.0.0 · Base URL única (produção e sandbox isolados por tenant) · CORS habilitado · X-API-Key
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeBlock lang="Base URL" code={BASE_URL} />
          <div className="grid sm:grid-cols-3 gap-2 mt-3">
            <Button variant="outline" size="sm" asChild>
              <a href="/api/openapi.yaml" target="_blank" rel="noreferrer">
                <FileJson className="w-4 h-4 mr-2" /> OpenAPI 3.1 YAML
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a href="/api/rivo-connect.postman_collection.json" target="_blank" rel="noreferrer">
                <Download className="w-4 h-4 mr-2" /> Coleção Postman
              </a>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://editor.swagger.io/?url=${encodeURIComponent("https://rivoconnect.com/api/openapi.yaml")}`}
                target="_blank"
                rel="noreferrer"
              >
                <FileText className="w-4 h-4 mr-2" /> Abrir no Swagger Editor
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="auth" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="auth" className="text-xs gap-1.5"><Shield className="w-3.5 h-3.5" />Auth</TabsTrigger>
          <TabsTrigger value="schemas" className="text-xs gap-1.5"><Layers className="w-3.5 h-3.5" />Schemas</TabsTrigger>
          <TabsTrigger value="errors" className="text-xs gap-1.5"><AlertTriangle className="w-3.5 h-3.5" />Erros</TabsTrigger>
          <TabsTrigger value="limits" className="text-xs gap-1.5"><Gauge className="w-3.5 h-3.5" />Limites</TabsTrigger>
          <TabsTrigger value="idem" className="text-xs gap-1.5"><Repeat className="w-3.5 h-3.5" />Idempotência</TabsTrigger>
          <TabsTrigger value="webhooks" className="text-xs gap-1.5"><Bell className="w-3.5 h-3.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="multicredor" className="text-xs gap-1.5"><Building2 className="w-3.5 h-3.5" />Multi-credor</TabsTrigger>
          <TabsTrigger value="sandbox" className="text-xs gap-1.5"><TestTube2 className="w-3.5 h-3.5" />Sandbox</TabsTrigger>
          <TabsTrigger value="email" className="text-xs gap-1.5"><Mail className="w-3.5 h-3.5" />E-mail cliente</TabsTrigger>
        </TabsList>

        {/* AUTH */}
        <TabsContent value="auth" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Autenticação</CardTitle>
              <CardDescription>API Key estática enviada no header em todas as requisições</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc pl-5 space-y-1 text-foreground">
                <li><b>Método:</b> API Key (SHA-256 hash armazenado no servidor).</li>
                <li><b>Header exato:</b> <code className="bg-muted px-1.5 py-0.5 rounded">X-API-Key: cf_...</code></li>
                <li><b>Prefixo:</b> toda chave inicia com <code>cf_</code>.</li>
                <li><b>Escopo:</b> a chave pode ser <i>do tenant</i> (acessa todos os credores) ou <i>restrita a um credor</i> (operações fora do credor → 403).</li>
                <li><b>Rotação:</b> revogar e gerar nova na aba <Badge variant="outline">API Keys</Badge>. Não há rotação automática hoje.</li>
                <li><b>Sandbox:</b> mesma URL base; solicite um tenant de teste para evitar dados de produção.</li>
                <li><b>CORS:</b> habilitado (<code>*</code>) com headers <code>authorization, x-api-key, content-type</code>.</li>
              </ul>
              <CodeBlock lang="cURL" code={`curl "${BASE_URL}/health" \\
  -H "X-API-Key: cf_sua_chave"`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SCHEMAS */}
        <TabsContent value="schemas" className="space-y-3">
          {[
            { title: "Client (mailing / parcela)", rows: SCHEMA_CLIENT },
            { title: "Agreement (acordo)", rows: SCHEMA_AGREEMENT },
            { title: "Payment (cobrança)", rows: SCHEMA_PAYMENT },
          ].map((s) => (
            <Card key={s.title}>
              <CardHeader>
                <CardTitle className="text-base">{s.title}</CardTitle>
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
                    {s.rows.map((r) => (
                      <TableRow key={r.field}>
                        <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.field}</code></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.type}</TableCell>
                        <TableCell>
                          {r.req === "sim" && <Badge className="bg-primary/10 text-primary border-primary/30" variant="outline">Sim</Badge>}
                          {r.req === "não" && <Badge variant="outline" className="text-muted-foreground">Não</Badge>}
                          {r.req === "auto" && <Badge variant="outline">Auto</Badge>}
                          {r.req === "sim*" && <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30" variant="outline">Condicional</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{r.desc}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardHeader><CardTitle className="text-base">Convenções gerais</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1.5">
              <p>• Identificadores: <code>UUID v4</code>. Datas: <code>YYYY-MM-DD</code> (ISO) ou <code>DD/MM/YYYY</code> (auto-convertido).</p>
              <p>• Valores monetários: <b>decimal em reais</b> (ex: 350.00). Não usar centavos.</p>
              <p>• CPF/CNPJ: aceita com ou sem máscara no mesmo campo <code>cpf</code>.</p>
              <p>• Telefones: aceita formato nacional ou E.164 (auto-normalizado para 55+DDD+9 dígitos).</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ERRORS */}
        <TabsContent value="errors" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Códigos de erro</CardTitle>
              <CardDescription>Formato canônico: <code>{`{ "error": "...", "errors": [...] }`}</code></CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>HTTP</TableHead>
                    <TableHead>Código interno</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead>Como resolver</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ERRORS.map((e) => (
                    <TableRow key={e.code}>
                      <TableCell><Badge variant="outline" className="font-mono">{e.http}</Badge></TableCell>
                      <TableCell><code className="text-xs">{e.code}</code></TableCell>
                      <TableCell className="text-sm">{e.msg}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.fix}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <CodeBlock lang="Erro 422 (exemplo)" code={`{
  "error": "Validação falhou",
  "errors": [
    "nome_completo: obrigatório (mínimo 2 caracteres)",
    "data_vencimento: formato inválido (esperado YYYY-MM-DD ou DD/MM/YYYY)"
  ]
}`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* LIMITS */}
        <TabsContent value="limits" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Limites operacionais</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Recurso</TableHead><TableHead>Limite</TableHead><TableHead>Observação</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell><code>POST /clients/bulk</code></TableCell><TableCell>500 registros</TableCell><TableCell>Quebrar em batches sequenciais</TableCell></TableRow>
                  <TableRow><TableCell><code>POST /whatsapp/bulk</code></TableCell><TableCell>200 mensagens</TableCell><TableCell>Anti-ban: respeitar 8–15s entre lotes</TableCell></TableRow>
                  <TableRow><TableCell><code>GET /clients?limit=</code></TableCell><TableCell>máx 500 (default 100)</TableCell><TableCell>Use <code>page</code> para paginar</TableCell></TableRow>
                  <TableRow><TableCell><code>GET /agreements?limit=</code></TableCell><TableCell>máx 200 (default 50)</TableCell><TableCell>—</TableCell></TableRow>
                  <TableRow><TableCell><code>GET /payments?limit=</code></TableCell><TableCell>máx 200 (default 50)</TableCell><TableCell>—</TableCell></TableRow>
                  <TableRow><TableCell>Payload</TableCell><TableCell>~6 MB</TableCell><TableCell>Limite Supabase Edge Functions</TableCell></TableRow>
                  <TableRow><TableCell>Rate-limit</TableCell><TableCell>Padrão Supabase</TableCell><TableCell>Em caso de 429, respeitar header <code>Retry-After</code></TableCell></TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* IDEMPOTENCY */}
        <TabsContent value="idem" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Idempotência</CardTitle>
              <CardDescription>Use <code>external_id</code> como chave funcional</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• <b>Single ({`POST /clients`}):</b> upsert por <code>(external_id, tenant_id)</code>. Sem external_id, fallback para <code>(cpf, numero_parcela, tenant_id)</code>.</p>
              <p>• <b>Bulk ({`POST /clients/bulk`}):</b> parâmetro <code>upsert: true</code> (default) re-aplica os campos; <code>upsert: false</code> insere e falha em conflito.</p>
              <p>• <b>Comportamento de duplicata:</b> mesmo <code>external_id</code> → atualização silenciosa, não cria duplicado nem retorna 409.</p>
              <p>• <b>Atomicidade do bulk:</b> <i>parcial</i>. Registros válidos são gravados; inválidos retornam em <code>errors[]</code> com <code>{`{ index, external_id, cpf, error }`}</code>.</p>
              <p>• Header <code>Idempotency-Key</code>: roadmap. Hoje a unicidade é garantida por <code>external_id</code>.</p>
              <CodeBlock lang="Bulk com upsert" code={`POST /clients/bulk
{
  "records": [ /* até 500 itens */ ],
  "upsert": true,
  "upsert_key": "external_id"  // ou "cpf"
}`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* WEBHOOKS */}
        <TabsContent value="webhooks" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Webhooks</CardTitle><CardDescription>Callbacks por evento — configurados via API</CardDescription></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><b>Configurar:</b></p>
              <CodeBlock lang="POST /webhooks/configure" code={`{
  "url": "https://seu-sistema.com/rivo-webhook",
  "events": ["agreement.approved", "payment.confirmed", "client.updated"]
}`} />
              <p><b>Eventos disponíveis:</b></p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><code>agreement.approved</code> — acordo aprovado</li>
                <li><code>agreement.rejected</code> — acordo rejeitado</li>
                <li><code>payment.confirmed</code> — pagamento confirmado</li>
                <li><code>payment.expired</code> — cobrança expirada</li>
                <li><code>client.updated</code> — cliente atualizado</li>
              </ul>
              <p className="mt-2"><b>Validação de assinatura HMAC:</b> roadmap. Hoje recomendamos URL com token único na própria URL.</p>
              <p><b>Retry:</b> 3 tentativas com backoff exponencial (30s, 2min, 10min).</p>
              <p><b>Fallback:</b> polling em <code>GET /payments/{`{id}`}</code> até <code>status=pago</code>.</p>
              <CodeBlock lang="Payload de webhook (exemplo)" code={`{
  "event": "payment.confirmed",
  "tenant_id": "uuid",
  "occurred_at": "2026-04-29T14:30:00Z",
  "data": {
    "id": "uuid",
    "client_id": "uuid",
    "valor": 350.00,
    "tipo": "pix",
    "status": "pago",
    "id_geral": "API-PIX-1714397400000"
  }
}`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* MULTI-CREDOR */}
        <TabsContent value="multicredor" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Multi-credor / Multi-tenant</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Um tenant pode ter <b>múltiplos credores</b>. Liste com <code>GET /credores</code>.</p>
              <p>• O campo <code>credor</code> nos payloads é uma <b>string</b>. Use o <code>nome_fantasia</code> retornado por <code>GET /credores</code> (o sistema também aceita <code>razao_social</code> como fallback).</p>
              <p>• A unicidade do credor por tenant é <b>garantida</b>.</p>
              <p>• <b>Chave escopada a um credor:</b> qualquer body com <code>credor</code> diferente → 403. O servidor sobrescreve automaticamente o campo <code>credor</code> com o nome da chave.</p>
              <CodeBlock lang="Listagem de credores" code={`curl "${BASE_URL}/credores" -H "X-API-Key: cf_..."

// resposta
{
  "data": [
    { "id": "uuid", "razao_social": "Y Brasil LTDA", "nome_fantasia": "Y Brasil",
      "cnpj": "12.345.678/0001-00", "parcelas_min": 1, "parcelas_max": 12,
      "desconto_maximo": 30, "juros_mes": 1.5, "multa": 2 }
  ]
}`} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* SANDBOX */}
        <TabsContent value="sandbox" className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Ambiente de teste (Sandbox)</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>• Solicite ao time Rivo Connect um <b>tenant de teste com chave dedicada</b>. A URL base é a mesma de produção; o isolamento é por <code>tenant_id</code>.</p>
              <p>• <b>CPFs de teste sugeridos:</b></p>
              <ul className="list-disc pl-5 space-y-0.5">
                <li><code>111.111.111-11</code> — sempre válido (sucesso)</li>
                <li><code>000.000.000-00</code> — força erro de validação</li>
              </ul>
              <p>• <b>Simular pagamento de PIX/boleto:</b></p>
              <CodeBlock lang="Confirmação manual em sandbox" code={`# 1) Crie a cobrança
curl -X POST "${BASE_URL}/payments/pix" \\
  -H "X-API-Key: cf_sandbox..." -H "Content-Type: application/json" \\
  -d '{"client_id":"uuid","valor":1.00,"data_vencimento":"2026-05-01"}'

# 2) Marque como pago via painel admin (Confirmação manual)
#    ou via PUT em /payments/{id} (em breve via API).`} />
              <p>• <b>Health-check:</b> <code>GET /health</code> retorna <code>{`{ "status": "ok", "version": "2.0.0" }`}</code>.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resposta consolidada para o cliente</CardTitle>
              <CardDescription>Texto pronto para colar no e-mail respondendo aos 10 blocos do questionário</CardDescription>
            </CardHeader>
            <CardContent>
              <CopyableEmail text={RESPONSE_EMAIL} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
