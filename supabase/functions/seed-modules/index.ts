import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Seed system_modules
    const systemModules = [
      { slug: "crm_core", name: "CRM Core", description: "Módulo principal de cobrança e gestão de carteira", category: "core", icon: "LayoutDashboard", is_core: true, sort_order: 1 },
      { slug: "contact_center", name: "Contact Center", description: "Central de atendimento multicanal", category: "comunicacao", icon: "Headphones", is_core: false, sort_order: 2 },
      { slug: "whatsapp", name: "WhatsApp", description: "Atendimento e disparo via WhatsApp", category: "comunicacao", icon: "MessageCircle", is_core: false, sort_order: 3 },
      { slug: "telefonia", name: "Telefonia", description: "Discador e gestão de chamadas", category: "comunicacao", icon: "Phone", is_core: false, sort_order: 4 },
      { slug: "automacao", name: "Automação", description: "Réguas de cobrança e workflows", category: "produtividade", icon: "Zap", is_core: false, sort_order: 5 },
      { slug: "portal_devedor", name: "Portal do Devedor", description: "Portal de autonegociação para devedores", category: "negociacao", icon: "Globe", is_core: false, sort_order: 6 },
      { slug: "relatorios", name: "Relatórios", description: "Relatórios operacionais e gerenciais", category: "analytics", icon: "BarChart3", is_core: false, sort_order: 7 },
      { slug: "gamificacao", name: "Gamificação", description: "Sistema de metas, ranking e recompensas", category: "engajamento", icon: "Trophy", is_core: false, sort_order: 8 },
      { slug: "financeiro", name: "Financeiro", description: "Controle financeiro e comissões", category: "financeiro", icon: "DollarSign", is_core: false, sort_order: 9 },
      { slug: "integracoes", name: "Integrações", description: "Integrações com sistemas externos", category: "tecnico", icon: "Plug", is_core: false, sort_order: 10 },
      { slug: "api_publica", name: "API Pública", description: "Acesso à API REST da plataforma", category: "tecnico", icon: "Code", is_core: false, sort_order: 11 },
      { slug: "ia_negociacao", name: "IA Negociação", description: "Inteligência artificial para negociação", category: "ia", icon: "Bot", is_core: false, sort_order: 12 },
    ];

    const { error: smError } = await supabase
      .from("system_modules")
      .upsert(systemModules, { onConflict: "slug" });

    if (smError) throw new Error(`system_modules: ${smError.message}`);

    // 2. Get all system_modules IDs
    const { data: allModules, error: fetchError } = await supabase
      .from("system_modules")
      .select("id, is_core")
      .eq("is_core", false);

    if (fetchError) throw new Error(`fetch modules: ${fetchError.message}`);

    // 3. Get all tenants
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id");

    if (tErr) throw new Error(`tenants: ${tErr.message}`);

    // 4. Seed tenant_modules for each tenant (all non-core enabled)
    const tenantModuleRows = tenants!.flatMap((t: any) =>
      allModules!.map((m: any) => ({
        tenant_id: t.id,
        module_id: m.id,
        enabled: true,
        enabled_at: new Date().toISOString(),
      }))
    );

    if (tenantModuleRows.length > 0) {
      const { error: tmError } = await supabase
        .from("tenant_modules")
        .upsert(tenantModuleRows, { onConflict: "tenant_id,module_id" });

      if (tmError) throw new Error(`tenant_modules: ${tmError.message}`);
    }

    // 5. Seed sa_modules
    const saModules = [
      { slug: "dashboard", name: "Dashboard", icon: "LayoutDashboard", sort_order: 0 },
      { slug: "comercial_pipeline", name: "Pipeline de Vendas", icon: "Target", sort_order: 0 },
      { slug: "comercial_leads", name: "Leads", icon: "UserPlus", sort_order: 1 },
      { slug: "suporte", name: "Suporte", icon: "Headphones", sort_order: 1 },
      { slug: "comercial_empresas", name: "Empresas", icon: "Building2", sort_order: 2 },
      { slug: "gestao_equipes", name: "Gestão de Equipes", icon: "Users", sort_order: 2 },
      { slug: "comercial_atividades", name: "Atividades", icon: "Calendar", sort_order: 3 },
      { slug: "treinamentos_reunioes", name: "Treinamentos e Reuniões", icon: "GraduationCap", sort_order: 3 },
      { slug: "comercial_relatorios", name: "Relatórios Comerciais", icon: "BarChart3", sort_order: 4 },
      { slug: "servicos_tokens", name: "Serviços e Tokens", icon: "Package", sort_order: 4 },
      { slug: "permissoes_modulos", name: "Permissões e Módulos", icon: "Shield", sort_order: 5 },
      { slug: "integracoes", name: "Integrações", icon: "Settings", sort_order: 7 },
      { slug: "gestao_inquilinos", name: "Gestão de Clientes", icon: "Building2", sort_order: 8 },
      { slug: "gestao_financeira", name: "Gestão Financeira", icon: "DollarSign", sort_order: 9 },
      { slug: "roadmap", name: "Roadmap", icon: "Map", sort_order: 10 },
      { slug: "gestao_usuarios", name: "Gestão de Usuários", icon: "UserPlus", sort_order: 12 },
    ];

    const { error: saError } = await supabase
      .from("sa_modules")
      .upsert(saModules, { onConflict: "slug" });

    if (saError) throw new Error(`sa_modules: ${saError.message}`);

    return new Response(
      JSON.stringify({
        success: true,
        system_modules: systemModules.length,
        tenant_modules: tenantModuleRows.length,
        sa_modules: saModules.length,
        tenants: tenants!.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
