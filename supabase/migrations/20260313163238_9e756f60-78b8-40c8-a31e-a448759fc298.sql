INSERT INTO public.sa_modules (name, slug, sidebar_group, icon, route_path, sort_order)
VALUES ('Gestão de Usuários', 'gestao_usuarios', 'Configurações', 'UserPlus', '/admin/usuarios', 12)
ON CONFLICT (slug) DO NOTHING;