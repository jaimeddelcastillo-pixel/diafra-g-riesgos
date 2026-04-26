-- ============================================================
-- BLOQUE C: Cierre de hallazgos del re-escaneo
-- ============================================================

-- ---------- FIX 7b: self-registration org_id binding ----------
-- Un usuario puede unirse como admin SOLO si acaba de crear esa organización
-- (es decir, es el ÚNICO miembro y la org no tiene otros miembros aún)

DROP POLICY IF EXISTS "self_registration_org_members_insert" ON public.org_members;

CREATE POLICY "self_registration_org_members_insert"
ON public.org_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.user_id = auth.uid()
  )
  AND role IN ('admin'::app_role, 'operador'::app_role)
  -- CRÍTICO: solo puede unirse a una org que NO tenga otros miembros (recién creada por él)
  AND NOT EXISTS (
    SELECT 1 FROM public.org_members om2
    WHERE om2.org_id = org_members.org_id
  )
);

-- ---------- FIX 8: Bucket firmas → privado y scoped ----------
UPDATE storage.buckets SET public = false WHERE id = 'firmas';

-- Limpiar policies del bucket firmas
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (qual ILIKE '%firmas%' OR with_check ILIKE '%firmas%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

-- Convención: las firmas se guardan como `{user_id}/...` o `{user_id}.png`.
-- La primera carpeta o el nombre base debe coincidir con auth.uid().

-- SELECT: el dueño, admins/responsable_sanitario de su org, o super_admin
CREATE POLICY "Firmas read own or org admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'firmas'
  AND (
    public.is_super_admin()
    -- Dueño: el path empieza con su user_id
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '.', 1) = auth.uid()::text
    -- Admin/responsable sanitario de la misma org del dueño
    OR EXISTS (
      SELECT 1
      FROM public.org_members om_target
      JOIN public.org_members om_self ON om_self.org_id = om_target.org_id
      WHERE om_self.user_id = auth.uid()
        AND (
          om_target.user_id::text = (storage.foldername(name))[1]
          OR om_target.user_id::text = split_part(name, '.', 1)
        )
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'responsable_sanitario'::app_role)
        )
    )
  )
);

-- INSERT: solo el propio usuario sube su firma
CREATE POLICY "Firmas insert own"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'firmas'
  AND (
    public.is_super_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '.', 1) = auth.uid()::text
  )
);

-- UPDATE: solo el propio usuario
CREATE POLICY "Firmas update own"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'firmas'
  AND (
    public.is_super_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '.', 1) = auth.uid()::text
  )
);

-- DELETE: dueño, admin de su org, o super_admin
CREATE POLICY "Firmas delete own or admin"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'firmas'
  AND (
    public.is_super_admin()
    OR (storage.foldername(name))[1] = auth.uid()::text
    OR split_part(name, '.', 1) = auth.uid()::text
    OR (
      public.has_role(auth.uid(), 'admin'::app_role)
      AND EXISTS (
        SELECT 1
        FROM public.org_members om_target
        JOIN public.org_members om_self ON om_self.org_id = om_target.org_id
        WHERE om_self.user_id = auth.uid()
          AND (
            om_target.user_id::text = (storage.foldername(name))[1]
            OR om_target.user_id::text = split_part(name, '.', 1)
          )
      )
    )
  )
);
