
-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can update any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete any client" ON public.clients;
DROP POLICY IF EXISTS "Operators can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can delete own clients" ON public.clients;

-- PROFILES: Recreate as PERMISSIVE (blocks anonymous)
CREATE POLICY "Users can view own profile" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update all profiles" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- CLIENTS: Recreate as PERMISSIVE (blocks anonymous)
CREATE POLICY "Admins can view all clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert any client" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update any client" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete any client" ON public.clients AS PERMISSIVE FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Operators can view own clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING (operator_id = public.get_my_profile_id());
CREATE POLICY "Operators can insert own clients" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (operator_id = public.get_my_profile_id());
CREATE POLICY "Operators can update own clients" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING (operator_id = public.get_my_profile_id());
CREATE POLICY "Operators can delete own clients" ON public.clients AS PERMISSIVE FOR DELETE TO authenticated USING (operator_id = public.get_my_profile_id());
