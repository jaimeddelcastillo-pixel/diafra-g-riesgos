-- Allow all authenticated users to read profiles for the responsable dropdown
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Authenticated read profiles"
ON public.profiles FOR SELECT TO authenticated
USING (true);
