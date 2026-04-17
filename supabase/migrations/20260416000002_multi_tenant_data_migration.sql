-- ============================================================
-- Fase 1 — Multi-tenant: Migración de datos existentes
-- Crea la organización DIAFRA y asocia todos los datos históricos.
-- Depende de migración 20260416000001 (tablas ya creadas).
-- ============================================================

DO $$
DECLARE
  v_diafra_id UUID;
BEGIN

  -- ── 1. Crear organización DIAFRA (empresa fundadora del sistema) ──
  INSERT INTO public.organizations (nombre, slug, descripcion, plan, activo)
  VALUES (
    'DIAFRA',
    'diafra',
    'Organización fundadora — datos migrados del sistema original',
    'professional',
    true
  )
  RETURNING id INTO v_diafra_id;

  RAISE NOTICE 'Organización DIAFRA creada con id: %', v_diafra_id;

  -- ── 2. Migrar user_roles → org_members ──
  --    Si un usuario tiene múltiples roles, se conserva el de mayor privilegio.
  --    Orden: admin > comite_tecnico > operador > lectura
  INSERT INTO public.org_members (org_id, user_id, role)
  SELECT
    v_diafra_id,
    user_id,
    role::public.app_role
  FROM (
    SELECT
      user_id,
      role,
      ROW_NUMBER() OVER (
        PARTITION BY user_id
        ORDER BY CASE role
          WHEN 'admin'          THEN 1
          WHEN 'comite_tecnico' THEN 2
          WHEN 'operador'       THEN 3
          WHEN 'lectura'        THEN 4
          ELSE 5
        END
      ) AS rn
    FROM public.user_roles
  ) ranked
  WHERE rn = 1
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Usuarios migrados a org_members: %',
    (SELECT COUNT(*) FROM public.org_members WHERE org_id = v_diafra_id);

  -- ── 3. Asignar todos los folios existentes a DIAFRA ──
  UPDATE public.folios
     SET org_id = v_diafra_id
   WHERE org_id IS NULL;

  RAISE NOTICE 'Folios actualizados: %', (SELECT COUNT(*) FROM public.folios WHERE org_id = v_diafra_id);

  -- ── 4. Asignar registros de audit_trail existentes a DIAFRA ──
  UPDATE public.audit_trail
     SET org_id = v_diafra_id
   WHERE org_id IS NULL;

  -- ── 5. Migrar folio_sequence al nuevo esquema (org_id, year) ──
  INSERT INTO public.folio_sequence (org_id, year, last_number)
  SELECT v_diafra_id, year, last_number
  FROM public._folio_seq_backup
  ON CONFLICT (org_id, year) DO UPDATE
    SET last_number = EXCLUDED.last_number;

  RAISE NOTICE 'Migración completada exitosamente. DIAFRA org_id = %', v_diafra_id;

END;
$$;

-- ── 6. Ahora que todos los folios tienen org_id, lo hacemos NOT NULL ──
ALTER TABLE public.folios
  ALTER COLUMN org_id SET NOT NULL;

-- ── 7. Actualizar next_folio_code() para usar org del usuario en sesión ──
CREATE OR REPLACE FUNCTION public.next_folio_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id     UUID    := public.get_user_org_id();
  current_year INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
  next_num     INTEGER;
BEGIN
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Usuario sin organización asignada — no puede crear folios';
  END IF;

  INSERT INTO public.folio_sequence (org_id, year, last_number)
  VALUES (v_org_id, current_year, 1)
  ON CONFLICT (org_id, year) DO UPDATE
    SET last_number = folio_sequence.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'GR-' || current_year || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$;
