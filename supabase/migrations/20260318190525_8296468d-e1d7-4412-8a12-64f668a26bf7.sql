
-- Re-seed system_modules (idempotent via ON CONFLICT)
INSERT INTO public.system_modules (slug, name, description, category, icon, is_core, sort_order)
VALUES
  ('crm_core', 'CRM Core', 'Gestão de clientes e carteira', 'core', 'Users', true, 1),
  ('contact_center', 'Contact Center', 'Central de atendimento multicanal', 'comunicacao', 'Headphones', false, 2),
  ('whatsapp', 'WhatsApp', 'Mensageria via WhatsApp', 'comunicacao', 'MessageCircle', false, 3),
  ('telefonia', 'Telefonia', 'Discador e telefonia VoIP', 'comunicacao', 'Phone', false, 4),
  ('automacao', 'Automação', 'Régua de cobrança e workflows', 'produtividade', 'Zap', false, 5),
  ('portal_devedor', 'Portal do Devedor', 'Autosserviço para devedores', 'negociacao', 'Globe', false, 6),
  ('relatorios', 'Relatórios', 'Relatórios e prestação de contas', 'analytics', 'BarChart3', false, 7),
  ('gamificacao', 'Gamificação', 'Campanhas, ranking e loja', 'engajamento', 'Trophy', false, 8),
  ('financeiro', 'Financeiro', 'Gestão financeira e comissões', 'financeiro', 'DollarSign', false, 9),
  ('integracoes', 'Integrações', 'Conexões com serviços externos', 'tecnico', 'Plug', false, 10),
  ('api_publica', 'API Pública', 'Acesso via API REST', 'tecnico', 'Code', false, 11),
  ('ia_negociacao', 'IA Negociação', 'Inteligência artificial para negociação', 'ia', 'Brain', false, 12)
ON CONFLICT (slug) DO NOTHING;

-- Enable all non-core modules for tenant Y.BRASIL
INSERT INTO public.tenant_modules (tenant_id, module_id, enabled, enabled_at)
SELECT '39a450f8-7a40-46e5-8bc7-708da5043ec7', sm.id, true, now()
FROM public.system_modules sm
WHERE sm.is_core = false
ON CONFLICT (tenant_id, module_id) DO NOTHING;
