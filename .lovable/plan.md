## Plan: Corrección de 2 vulnerabilidades críticas de seguridad

Orden de ejecución estricto: **Problema 2 → Problema 1 → Verificación**.

---

### PASO 1 — Problema 2: Escalación de privilegios a `super_admin`

**Migración SQL única** que ejecuta en orden:

1. **Limpieza preventiva**: `DELETE FROM org_members WHERE role = 'super_admin'` (por si existiera alguna fila huérfana — los super_admin legítimos viven en `user_roles`).
2. **Constraint duro** en `org_members`:
   ```sql
   ALTER TABLE public.org_members
   ADD CONSTRAINT no_super_admin_in_org_members
   CHECK (role <> 'super_admin');
   ```
3. **Reescritura de `is_super_admin()`** — eliminar rama de `org_members`, leer solo de `user_roles`:
   ```sql
   CREATE OR REPLACE FUNCTION public.is_super_admin()
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
   SET search_path = public AS $$
     SELECT EXISTS (SELECT 1 FROM public.user_roles
                    WHERE user_id = auth.uid() AND role = 'super_admin')
   $$;
   ```
4. **Endurecer `self_registration_org_members_insert`**:
   ```sql
   DROP POLICY "self_registration_org_members_insert" ON public.org_members;
   CREATE POLICY "self_registration_org_members_insert"
   ON public.org_members FOR INSERT TO authenticated
   WITH CHECK (
     user_id = auth.uid()
     AND role = 'operador'
     AND NOT EXISTS (SELECT 1 FROM public.org_members om WHERE om.user_id = auth.uid())
     AND NOT EXISTS (SELECT 1 FROM public.org_members om2 WHERE om2.org_id = org_members.org_id)
   );
   ```
   (Mantiene la lógica de "primer miembro de la org" pero ya no depende de la columna `role` siendo restringida solo por el CHECK.)
5. **Revisar `has_role`**: actualmente lee de `org_members` y trata `super_admin` como comodín. Como ya no podrá existir `super_admin` en `org_members`, el comportamiento queda automáticamente seguro — no requiere cambio.

---

### PASO 2 — Problema 1: Aislamiento de canales Realtime por organización

**A. Migración SQL**:

```sql
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "realtime_org_isolation"
ON realtime.messages FOR SELECT TO authenticated
USING (
  public.is_super_admin()
  OR (
    split_part(extension, ':', 1) IN ('comite_votos','comite_comentarios')
    AND split_part(extension, ':', 2)::uuid = public.get_user_org_id()
  )
  -- Canales que NO siguen el formato 'tabla:org_id:...' quedan denegados implícitamente
);
```

> Nota técnica: en Supabase Realtime el nombre del canal lo emite el cliente vía `supabase.channel('...')`. El topic se expone en `realtime.messages.topic`. Validaremos con `split_part(topic, ':', 1/2)` usando el formato `{tabla}:{org_id}:{folio_id}`. Cualquier suscripción a un canal sin org_id válido será rechazada por RLS.

**B. Cambios en frontend** — pasar `orgId` y construir canales con formato seguro `{tabla}:{org_id}:{folio_id}`:

- `src/components/comite/PanelVotacion.tsx` → canal `comite_votos:${orgId}:${folioId}`
- `src/components/comite/PanelComentarios.tsx` → canal `comite_comentarios:${orgId}:${folioId}`
- `ComiteTab.tsx` ya recibe `orgId` y lo pasa a ambos paneles ✅ (no requiere cambio estructural).

---

### PASO 3 — Verificación

1. Ejecutar `supabase--linter` para confirmar que ambas alertas desaparecen.
2. Confirmar que el panel del comité sigue actualizando en tiempo real para el usuario correcto.
3. Marcar ambos findings como resueltos vía `security--manage_security_finding`.
4. Actualizar `security--update_memory` documentando: (a) `is_super_admin` solo lee `user_roles`, (b) CHECK constraint en `org_members.role`, (c) RLS en `realtime.messages` con formato de canal `{tabla}:{org_id}:{folio_id}`.

---

### Archivos afectados

- **Nuevas migraciones**: 2 (una por problema, en orden).
- **Frontend**: `src/components/comite/PanelVotacion.tsx`, `src/components/comite/PanelComentarios.tsx`.
- **Sin cambios**: `ComiteTab.tsx`, `FolioDetail.tsx`, edge functions.

### Riesgos y mitigaciones

- **`is_super_admin` cambia comportamiento**: si existe un super_admin que solo está en `org_members` y no en `user_roles`, perdería privilegios. Mitigación: la migración hace `INSERT INTO user_roles SELECT user_id, 'super_admin' FROM org_members WHERE role='super_admin' ON CONFLICT DO NOTHING` antes del DELETE.
- **Canales viejos en caché**: usuarios con sesión abierta se reconectarán automáticamente al hacer re-render; sin downtime.
- **Formato de topic Realtime**: si Supabase usa `realtime:{topic}` internamente, ajustaremos el `split_part` tras probar con `supabase--read_query` sobre `realtime.messages`.

¿Apruebas? Procedo en el orden indicado: migración 1 (privilegios) → migración 2 (Realtime) → cambios frontend → verificación.