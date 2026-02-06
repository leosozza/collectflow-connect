
-- Fix infinite recursion in RLS policies by using has_role() function

-- Drop all existing policies on profiles that cause recursion
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Drop all existing policies on clients that cause recursion
DROP POLICY IF EXISTS "Admins can view all clients" ON public.clients;
DROP POLICY IF EXISTS "Admins can insert any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can update any client" ON public.clients;
DROP POLICY IF EXISTS "Admins can delete any client" ON public.clients;
DROP POLICY IF EXISTS "Operators can view own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can insert own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Operators can delete own clients" ON public.clients;

-- =====================
-- PROFILES POLICIES (using has_role to avoid recursion)
-- =====================

-- Users can always view their own profile
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can insert their own profile (for signup trigger)
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =====================
-- CLIENTS POLICIES (using has_role and get_my_profile_id)
-- =====================

-- Admins can do everything on clients
CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert any client"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update any client"
ON public.clients FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete any client"
ON public.clients FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Operators can manage their own clients
CREATE POLICY "Operators can view own clients"
ON public.clients FOR SELECT
TO authenticated
USING (operator_id = public.get_my_profile_id());

CREATE POLICY "Operators can insert own clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (operator_id = public.get_my_profile_id());

CREATE POLICY "Operators can update own clients"
ON public.clients FOR UPDATE
TO authenticated
USING (operator_id = public.get_my_profile_id());

CREATE POLICY "Operators can delete own clients"
ON public.clients FOR DELETE
TO authenticated
USING (operator_id = public.get_my_profile_id());
