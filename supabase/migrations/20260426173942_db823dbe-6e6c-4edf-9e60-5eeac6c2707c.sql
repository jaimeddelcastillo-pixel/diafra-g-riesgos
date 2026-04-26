-- ============================================================
-- BLOQUE B: Org insert + folio_sequence + bucket evidencias
-- ============================================================

-- ---------- FIX 4: organizations INSERT ----------
-- Eliminar la policy permisiva que permite a cualquier {public} (incluso anónimos) crear orgs
DROP POLICY IF EXISTS "usuarios pueden crear su org al registrarse" ON public.organizations;

-- La policy "self_registration_org_insert" ya restringe correctamente:
-- TO authenticated WITH CHECK (NOT EXISTS membership previa). La dejamos.

-- ---------- FIX 5: folio_sequence RLS ----------
ALTER TABLE public.folio_sequence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read own folio sequence"
ON public.folio_sequence
FOR SELECT
TO authenticated
USING (org_id = public.get_user_org_id() OR public.is_super_admin());

-- INSERT/UPDATE solo via la función next_folio_code() que es SECURITY DEFINER, así que no
-- exponemos policies de mutación a usuarios. Service role siempre puede.

-- ---------- FIX 5b: _folio_seq_backup ----------
-- Tabla obsoleta de backup (ver schema: solo year/last_number sin org_id ni id). Eliminar.
DROP TABLE IF EXISTS public._folio_seq_backup;

-- ---------- FIX 6: Bucket evidencias scoped por org ----------
-- Recrear policies validando que el folio (primera carpeta de la ruta) pertenezca a la org del usuario

-- Limpiar policies existentes del bucket evidencias
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%evidencias%' OR with_check ILIKE '%evidencias%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- SELECT: solo si el folio (primera carpeta) pertenece a la org del usuario
CREATE POLICY "Evidencias read same org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.org_id = public.get_user_org_id()
    )
  )
);

-- INSERT: idem, validar org del folio
CREATE POLICY "Evidencias insert same org"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'evidencias'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.org_id = public.get_user_org_id()
    )
  )
);

-- UPDATE: idem
CREATE POLICY "Evidencias update same org"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.org_id = public.get_user_org_id()
    )
  )
);

-- DELETE: solo admin de la org
CREATE POLICY "Evidencias delete admin same org"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'evidencias'
  AND (
    public.is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.folios f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.org_id = public.get_user_org_id()
        AND public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);
