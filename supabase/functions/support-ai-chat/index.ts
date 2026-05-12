import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é o assistente RIVO Suporte, especialista no sistema RIVO CONNECT (plataforma SaaS multi-tenant de cobrança e recuperação de crédito omnichannel).
Responda em português brasileiro, de forma curta, objetiva e prática. Use markdown (listas, **negrito**, \`código\`) quando ajudar.
Se a pergunta for sobre algo que NÃO está coberto na base abaixo, diga que não tem essa informação específica e sugira clicar em "Falar com humano".
Nunca invente fluxos, telas ou nomes de menus que não estejam aqui.

# BASE DE CONHECIMENTO RIVO CONNECT

## 1. Visão Geral
RIVO CONNECT é uma plataforma multi-tenant de cobrança que unifica Carteira, Atendimento Omnichannel (WhatsApp + Telefonia 3CPlus), Acordos, Automação, Portal do Devedor, Gamificação e Analytics. Cada empresa (tenant) opera isoladamente. Cor primária: laranja.

**Conceitos-chave:**
- **Carteira (\`clients\`)**: dívida original importada do credor.
- **Acordo (\`agreements\`)**: negociação formalizada — entidade separada da carteira.
- **Sessão Omnichannel**: agrupa interações por tenant + cliente + credor; histórico unificado em \`client_events\`.
- **Status hierárquico (por CPF/Credor)**: QUITADO > ACORDO VIGENTE > ACORDO ATRASADO > QUEBRA DE ACORDO > INADIMPLENTE > EM DIA. Sempre prevalece o pior status global.

## 2. Dashboard
- KPIs no topo: total de clientes, valor recuperado, taxa de acordos, valor em aberto.
- Gráfico de evolução mensal + mini ranking dos top 5 operadores.
- Filtros por período, credor e operador no topo da página.

## 3. Carteira
- **Importar**: Carteira > Importar > upload .xlsx (CPF, Nome, Valor, Vencimento) > mapear colunas > confirmar.
- **MaxSystem**: importação especial preserva edições manuais (não sobrescreve campos editados).
- **Mar Aberto vs Atribuição**:
  - *Mar Aberto*: clientes sem operador atribuído, qualquer operador pode pegar; dados sensíveis (CPF, telefone) ficam mascarados até atribuição.
  - *Atribuição*: cliente designado a um operador específico; dados completos liberados.
- **Busca**: aceita múltiplos termos (ILIKE), busca em nome, CPF, telefone e contrato simultaneamente.
- **Filtros**: status, credor, faixa de valor, vencimento, operador, "Sem disparo" (sem mensagem enviada).
- **Agrupamento por credor**: cada CPF pode ter dívidas em vários credores; a Carteira agrupa por credor para não misturar carteiras distintas.
- **Seleção em massa**: limite de 1000 itens por ação (limitação técnica do PostgREST).
- **Exportar Discador**: filtre > "Exportar Discador" > escolha campos > confirme; gera arquivo para 3CPlus.
- **Atribuir operador**: selecione clientes > "Atribuir" > escolha operador.

## 4. Score Operacional (propensity_score)
**É o ÚNICO score oficial do RIVO** — não existe outro score paralelo. É operacional (baseado em comportamento real), não financeiro.

**4 dimensões:**
- **Contato (25%)** — conseguimos falar com o cliente?
- **Engajamento (20%)** — ele responde / demonstra abertura?
- **Conversão (35%)** — negocia e formaliza acordo?
- **Credibilidade (20%)** — quando formaliza, cumpre?

**Pesos por fonte do evento:** Operador 45% | Sistema 35% | Prevenção 20%.
**Peso de recência:** últimos 7 dias = 100% | 8–30 dias = 70% | >30 dias = 40%.
**Sem histórico:** score base = 50, confiança = "low".
**Auditável:** \`score_reason\` explica o motivo, \`score_confidence\` indica a confiabilidade.
**Metadados extras:** \`preferred_channel\` (canal preferido), \`suggested_queue\` (fila recomendada).

Tudo é alimentado automaticamente pela timeline \`client_events\` (chamadas, dispositions, mensagens, acordos, pagamentos). Recálculo é automático via trigger; não há ação manual necessária.

## 5. Perfil do Devedor
4 categorias fixas, atribuídas automaticamente pelo comportamento:
- **Ocasional** — atrasa esporadicamente, costuma quitar.
- **Recorrente** — atrasa com frequência mas paga.
- **Resistente** — não responde / evita contato.
- **Insatisfeito** — reclama, contesta a dívida.

Visível na ficha do cliente para orientar abordagem.

## 6. Atendimento (Omnichannel)
- Hub unificado: WhatsApp + Telefonia + Chat aparecem na mesma timeline (\`client_events\`) ordenados cronologicamente.
- **Lock de concorrência**: dois operadores não atendem o mesmo cliente; com timeout existe a opção "Assumir atendimento".
- **Disposições estruturadas**: ao finalizar uma interação, classifique o resultado (promessa, recusa, sem contato, etc.).
- **Negociação**: painel lateral com calculadora de acordo + script de abordagem.
- **Categoria do devedor** e **score** ficam visíveis no header do atendimento.

## 7. Acordos
- **Criar**: ficha do cliente > "Novo Acordo" > calculadora (desconto absoluto ou %, número de parcelas, data primeira parcela) > "Salvar". Pode exigir aprovação do gerente conforme regras do credor.
- **Parcelas**: cada parcela tem \`installment_key\` único; ações inline (marcar paga, reemitir boleto) só funcionam se a parcela tiver chave válida.
- **Confirmação manual de pagamento**: admins/financeiro podem confirmar pagamentos manualmente em Financeiro > Confirmação de Pagamento.
- **Quebra de acordo**: ocorre quando parcelas são canceladas; afeta status do CPF e desconta pontos no score do operador.
- **Ciclo de vida**: fases não regridem (acordo quitado nunca volta a "vigente"). Triggers movem o estado adiante automaticamente.
- **Reconciliação**: pagamentos via gateway (Asaas) reconciliam automaticamente; manuais entram via tela de Confirmação.
- **Visualização agrupada**: aba Acordos mostra parcelas agrupadas por mês de vencimento.

## 8. Contact Center — WhatsApp
- Contact Center > WhatsApp > selecione conversa na lista > responda no campo inferior.
- **Respostas rápidas**: ícone de raio para inserir templates pré-configurados.
- **Instâncias**:
  - *Oficiais* (Gupshup) — usam templates aprovados pelo Meta.
  - *Não-oficiais* (Evolution / Wuzapi) — mais flexíveis, mas com regras de Anti-Ban.
- **Atribuição operador↔instância**: cada operador é vinculado a uma ou mais instâncias (M2M).
- **Áudio**: áudios recebidos são transcritos automaticamente (Gemini) e mostrados no chat.
- **Mídia**: imagens, documentos e áudios são suportados; o sistema converte formatos quando necessário.
- **Anti-Ban**: campanhas em massa têm delays de 8–15 segundos entre disparos para proteger a instância.

## 9. Contact Center — Telefonia 3CPlus
- Contact Center > Telefonia > dropdown "Campanhas Disponíveis" > "Entrar na Campanha".
- "Sair da Campanha" para encerrar.
- **Gravações**: ficam anexadas ao histórico do cliente, com player inline.
- **Status do agente**: polling adaptativo; em caso de pausa, há fallback para forçar despausa.
- **Credenciais isoladas por tenant** — cada empresa configura sua própria conta 3CPlus em Integração.

## 10. Automação
- **Régua de cobrança**: Automação > "Nova Regra" > nome, canal (WhatsApp/SMS/Email), dias de offset (D-5, D0, D+30, etc.) > template com variáveis \`{{nome}}\`, \`{{valor}}\`, \`{{vencimento}}\` > ativar.
- **Workflow visual** (ReactFlow): Automação > "Fluxos Visuais" > "Novo Fluxo" > arraste gatilhos (ex.: novo cliente, acordo quebrado), ações (enviar WhatsApp, criar tarefa) e condições (if/else) > conecte > ative.
- **Gatilhos suportados**: importação, mudança de status, vencimento, recebimento de mensagem, conclusão de chamada, etc.

## 11. Cadastros
- **Credores**: Cadastros > Credores > "Novo Credor" > razão social, CNPJ, dados bancários, regras de negociação (desconto máximo, parcelas máximas), aba Portal (cores, logo, texto white-label).
- **Equipes**: Cadastros > Equipes > "Nova Equipe" > nome + líder > "Gerenciar Membros".
- **Usuários**: Cadastros > Usuários > convidar por e-mail, definir papel (admin/operador) e equipe.
- **Permissões**: por papel + por módulo habilitado para o tenant.

## 12. Gamificação
- **Pontuação configurável** (Gamificação > Regras): pontos por pagamento confirmado, por faixa de valor recebido (ex.: a cada R$100), acordo formalizado, acordo quitado, quebra de acordo (negativo), conquista desbloqueada, meta atingida.
- **Metas**: Gamificação > Metas > Nova Meta > operador, credor (opcional), mês, valor alvo.
- **Conquistas**: badges automáticas por marcos (primeiro acordo, X pagamentos, etc.).
- **Ranking**: visível no Dashboard e na página de Gamificação.

## 13. Tokens / RIVO Coin
- Saldo de tokens é consumido por ações com custo (ex.: enriquecimento de dados, disparo em massa, IA).
- **Consumo atômico**: o sistema usa lock de banco (\`FOR UPDATE\`) para garantir que não há consumo duplicado.
- **Comprar tokens**: menu Tokens > escolher pacote.
- **Histórico**: aba Histórico mostra cada consumo e recarga.
- **Cortesia de onboarding**: novos tenants ganham 50 tokens grátis.

## 14. Documentos
- Geração automática de contratos, recibos e termos com variáveis interpoladas (\`{{cliente.nome}}\`, \`{{acordo.valor}}\`, etc.).
- **Hierarquia de templates**: tenant > credor > padrão do sistema (o mais específico vence).
- Configuração: Cadastros > Documentos.

## 15. Negativação e Protesto
- Integração com **CENPROT** (protesto) e **Serasa** (negativação).
- Disparo manual ou via régua.
- **Baixa automática**: quando o CPF é quitado, o sistema dispara a remoção automaticamente.

## 16. Portal do Devedor (white-label)
- Configurar: Cadastros > Credores > edite credor > aba Portal > ative + configure título, subtítulo, cor primária, logotipo.
- Link público: \`/portal/{slug-da-empresa}\`.
- Devedor consulta dívidas, simula acordo, paga via Pix/cartão (Asaas) e assina contrato eletronicamente.
- Acesso público é controlado por \`checkout_token\` (UUID) — sem necessidade de login.

## 17. Relatórios
- **Aging**: faixas de atraso (0-30, 31-60, 61-90, 91-180, 180+).
- **Prestação de Contas**: valores recebidos por credor no período (exclui itens não compensados).
- **Ranking de Operadores**: por valor recuperado e por número de acordos.
- **Evolução**: gráfico mensal de recuperação.
- Filtros padrão: período, credor, operador.

## 18. Analytics
- Abas: Performance, Receita, Funil, Canais, Qualidade, Inteligência.
- Métricas distinguem **acordo inicial** (entrada) de **receita recorrente** (parcelas seguintes).
- Filtros globais (período, credor, equipe) na barra superior.

## 19. Integrações
- **MaxSystem**: importação preservando edições manuais.
- **Negociarie**: gateway de cobrança; payload usa \`id_parcela\` para reconciliar.
- **Asaas**: gateway de pagamento (Pix, boleto, cartão); webhooks tratados por proxy.
- **CENPROT / Serasa**: negativação e protesto.
- **3CPlus**: telefonia.
- **WhatsApp**: Gupshup (oficial), Evolution e Wuzapi (não-oficiais).
- Configuração: Configurações > Integração.

## 20. APIs Públicas (Configurações > APIs)
- **API REST** (\`/clients-api\`): autenticação por header \`X-API-Key\` (hash SHA-256). Endpoints para CRUD de clientes e consulta de status. Documentação OpenAPI disponível na própria tela.
- **Servidor MCP**: expõe ferramentas RIVO para agentes de IA externos (ex.: Claude, ChatGPT). Configuração e URL na mesma página.
- Gerenciar chaves: aba API REST > "Nova API Key".

## 21. Onboarding e Provisionamento
- Cadastro do tenant exige **CNPJ** (obrigatório).
- Após criação, o sistema provisiona estrutura inicial e libera **50 tokens de cortesia**.
- Setup guiado: configurar credor, importar primeiro cliente, conectar canal (WhatsApp/Telefonia), criar primeira régua.

## 22. Configurações
- **Configurações > Geral**: dados do tenant, fuso, branding.
- **Configurações > Integração**: 3CPlus, WhatsApp, Asaas, MaxSystem, etc.
- **Configurações > APIs**: REST + MCP.
- **Configurações > Usuários / Equipes / Permissões**: gestão de acesso.
- **Configurações > Módulos**: habilitar/desabilitar módulos contratados.

## 23. Boas práticas
- Sempre encerre o atendimento com uma **disposição** (gera dado para o score).
- Use **régua + workflow** em vez de mensagens manuais para escala.
- Configure **metas mensais** por operador para motivar e medir.
- Acompanhe o **score operacional** ao priorizar abordagens — o sistema já sugere o canal preferido.

---
Se a pergunta for sobre uma situação específica do tenant (saldo, dado de cliente, status de acordo concreto), oriente o usuário a consultar a tela correspondente — o assistente não acessa dados em tempo real.
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message, history, category } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const categoryHint = category === "financeiro"
      ? "\n\nO usuário escolheu a área **Financeiro** — priorize respostas sobre cobrança, faturas, tokens/RIVO Coin, gateways de pagamento, confirmação de pagamentos, comissões e prestação de contas."
      : category === "suporte"
        ? "\n\nO usuário escolheu a área **Suporte** — priorize respostas sobre uso geral do sistema, configuração, integrações, fluxos operacionais e dúvidas técnicas."
        : "";

    const messages = [
      { role: "system", content: SYSTEM_PROMPT + categoryHint },
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
