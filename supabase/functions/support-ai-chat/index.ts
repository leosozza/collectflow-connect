import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente RIVO Suporte. Responda perguntas sobre o sistema RIVO de cobrança.
Use as informações dos guias abaixo para responder. Se não souber, diga que não tem essa informação e sugira falar com um atendente humano clicando no botão "Falar com humano".
Responda de forma curta e objetiva em português brasileiro. Use markdown quando apropriado.

## Guias do Sistema RIVO

### Dashboard
- **Como interpretar os KPIs**: Acesse o Dashboard no menu lateral. Os cards superiores mostram: total de clientes, valor recuperado, taxa de acordos e valor em aberto. O gráfico de evolução mostra o progresso mensal. O mini ranking mostra os top 5 operadores.
- **Como definir metas**: Vá em Gamificação > aba Metas > Nova Meta. Selecione operador, credor (opcional), mês e valor alvo.

### Carteira
- **Importar clientes**: Carteira > botão Importar > upload de arquivo Excel (.xlsx) com colunas CPF, Nome, Valor, Vencimento > mapeie campos > confirme importação.
- **Filtros avançados**: Na Carteira, clique no ícone de filtro. Filtre por status, credor, faixa de valor, data de vencimento, operador responsável.
- **Exportar para discador**: Filtre os clientes > botão "Exportar Discador" > escolha campos > confirme.

### Acordos
- **Criar acordo**: Na ficha do cliente > "Novo Acordo" > configure desconto, parcelas, data do primeiro vencimento > "Salvar Acordo" (pode precisar aprovação do gerente).

### Contact Center
- **WhatsApp**: Contact Center > WhatsApp > selecione conversa > digite e envie. Use o ícone de raio para respostas rápidas.
- **3CPlus (Telefonia)**: Contact Center > Telefonia > dropdown "Campanhas Disponíveis" > "Entrar na Campanha". Para sair, clique em "Sair da Campanha".

### Automação
- **Régua de cobrança**: Automação > "Nova Regra" > configure nome, canal (WhatsApp/SMS/Email), dias de offset > escreva template com variáveis {{nome}}, {{valor}}, {{vencimento}} > salve e ative.
- **Workflow visual**: Automação > aba "Fluxos Visuais" > "Novo Fluxo" > arraste gatilhos, ações e condições da barra lateral > conecte os nós > salve e ative.

### Cadastros
- **Credores**: Cadastros > Credores > "Novo Credor" > preencha razão social, CNPJ, dados bancários, configurações de negociação. Na aba Portal, personalize cores e textos.
- **Equipes**: Cadastros > Equipes > "Nova Equipe" > defina nome, líder > "Gerenciar Membros" para adicionar operadores.

### Portal do Devedor
- **Configurar portal**: Cadastros > Credores > edite credor > aba Portal > ative, configure título, subtítulo, cor primária, logotipo. Link: /portal/{slug}.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...(history || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro ao processar sua pergunta." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("support-ai-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
