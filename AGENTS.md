Base principles (always):
- Company and role come only from contexto_org_actual(), get_user_org_id() and has_role (role in the active company); never trust a client-sent org_id.
- Support restoration adopts contexto_org_actual on reload; browser storage is synchronization only and never closes or authorizes support; why: persistence without client-derived access.
- Nothing is deleted: users are deactivated, records retired/obsoleted/voided; audit_trail is insert-only.
- AI proposes; it never validates, approves or signs.
- Tests run only in es_prueba companies, never with DIAFRA data.
- organizations whitelist: admin/RS change only allowed fields; commercial fields only support or the system.
- Never add, upgrade or bump packages/dependencies, nor apply security or version updates, without the user's explicit authorization; report a needed update in one line (package, current → new version, reason) and wait; why: preserve the verified environment and avoid unapproved regressions.

Technical rules — one line each; full text and "why" in docs/reglas-detalle.md (read it before touching the area):
- R1 Document types classify only via SQL clasificar_tipo_documento.
- R2 Recursos never references brain_*; file/hash immutable; retention only via org_documento_retencion.
- R3 Per-plan caps live only in plan_limites (plan_limite/mi_plan_limite).
- R4 File reading only in _shared/documento-contenido.ts; extraction checks SHA-256 first.
- R5 Extracted knowledge enters por_validar with an 'archivo' fuente or is deleted.
- R6 Document state/copy/revision from extraction are proposals confirmed only by admin/RS.
- R7 Every extraction is logged in brain_extracciones.
- R8 Modules are hybrid: DB decides access, src/modules/<clave>/module.ts decides UI.
- R9 Headers/route ownership resolve from the module registry.
- R10 Overdue review cutoff only via folios_revision_corte.
- R11 Training routes belong to module registries; courses filtered by modulo_clave.
- R12 Course access only via mi_acceso_curso; Mis diplomas never filters by module.
- R13 Tours tracked per person in onboarding_estado; placement via posicionTour.
- R14 Setup checklist only via pendientes_configuracion.
- R15 External auditors are never org_members; access via SECURITY DEFINER functions.
- R16 All AI prompts are versioned skills in agent_prompts read via _shared/skills.ts; no hardcoded fallback.
- R17 Riesgos block composition is per-company (ia_config_org) and block pieces publish only with all test cases passed.
- R18 AI date context uses the shared Mexico City server-date formatter, outside fixed risk blocks; why: consistent dates without invalidating fixed-block caching.
- R19 Response provenance renders through one super-admin-only control; skill presentation helpers preserve restored text and count configured composition by norm (MULTI counts in both); why: consistent inspection and exact hashes.
- R20 Riesgos reads validated Cerebro knowledge only through contexto_cerebro (explicit codes, Spanish OR/rank, bounded process fallback); response metadata preserves context diagnostics; insert triggers derive atomic citations from the owned assistant message; why: module isolation and audited attribution.
- R21 Tendencias writes and substitutions use active-company guards; server-only issuance snapshots retain week IDs and substitution identity, week corrections require audited reasons, origin/date/photo are server guarded; why: tenant isolation, immutable issuance and independent approval.
- R23 Bitacora AI uses server-loaded task skills and task-catalog model configuration changed only by an audited super-admin RPC; proposals preserve model, skill hashes and usage before human confirmation; notification claims and terminal AI blocks persist server-side; why: no fixed model, duplicate sends, silent overwrites or repeated blocked billing.
- R22, R24–R27 (Tendencias engines, capture, reports, screens, normative catalog) live in src/modules/tendencias/AGENTS.md; subdirectories may have their own AGENTS.md — read it before changing files there.
- T5b: module access per company is toggled only by super_admin via admin_set_modulo (organization_features upsert, mandatory reason, audit_trail); an explicit inactive feature row overrides plan access in org_tiene_modulo; platform normative specs live in Panel › Normas y especificaciones (/admin/normas), never under Empresas; why: auditable per-company access without deleting data.

- T5d platform substitutions are managed at /configuracion/suplencias; exact-role permissions come from rol_efectivo through shared server context/has_role, accepted and time-bounded only. RS substitution never grants user administration, admin substitution never authorizes AT; immutable audit and records retain actor/titular identity; T5d-1: a folio creator who is a committee member signs as usual, and a creator dictamen is allowed only with a mandatory reason, audited and flagged dictamen_autoemitido («Dictamen emitido por su autor»); why: shared governance without cross-role escalation, with small-company autoemission traceable.

- P1 «Mis pendientes» is computed only by the server function pendientes_usuario (read-only, active company, rol_efectivo incl. accepted valid substitution, only modules active via org_tiene_modulo); semaphore thresholds live per company in org_pendientes_semaforo written only via guardar_semaforo_pendientes (admin/RS), with the same colour rule mirrored in src/lib/pendientes.ts; profiles.perfil_confirmado_en gates signer eligibility (list and issuance); why: one auditable source for pending items without per-module client logic.
- P1-b sidebar preference is presentation-only and keyed by authenticated user in the shared layout; mobile drawers always show labels. Pending counts consume server colours and temporal labels read company thresholds without reclassifying items; platform breadcrumbs live in the shared layout; why: consistent navigation across modules without changing authorization or pending rules.
- P1-a audit_trail substitution context (audit_suplencia_contexto) exits early via indexed check and is resolved once per client statement (xact+statement_timestamp+actor+org cache), never per row; why: bulk imports stay under the statement timeout without changing permission rules.
- K1 Indicadores owns independent catalogs/Excel in src/modules/indicadores; guarded server writers derive active company, require reason and audit, never delete, and import always drafts. AC has effective committee permissions elsewhere but only its own accepted/time-bounded substitution, never implicit RS/admin; why: reusable registry navigation without cross-module coupling or privilege escalation.
- K1-a General audit (/auditoria) is a platform route shown with any active module to admin/RS/comite_tecnico/AC (super_admin in support); readable tables, catalogs and record labels live only in src/config/auditoria.ts, filters/pagination run server-side via src/lib/auditoria.ts; module audit screens (e.g. /tendencias/auditoria) stay independent; KPI weight applies only to nivel SGC (DB check kpi_peso_solo_sgc); why: one auditable view across modules without per-module screens.
- K1-c audit_trail read RLS evaluates puede_ver_auditoria once per query via wrapped subselects (InitPlan) and the general audit paginates without exact counts (page+1 rows, export in bounded batches); org_members role changes/removals by users require tracea.motivo (≥5) and go through cambiar_rol_miembro, with org_members/user_roles audited by audit_trigger_func; KPI pending items are one line per catalog; why: no statement timeouts and full role traceability without changing who can see or edit.
- K2 KPI results live in kpi_resultados with server-computed valor/cumplimiento/semáforo (kpi_calcular), an immutable meta/tendencia/unidad snapshot, one active result per KPI+period, periods only via kpi_periodo/kpi_ultimo_cerrado (America/Mexico_City, open periods rejected) mirrored in src/modules/indicadores/lib/resultados.ts; writes only via guardar/revisar/anular/asignar_capturistas/registrar_kpi_evidencia/ligar_kpi_evidencia RPCs (GUC tracea.kpi_resultados_rpc); KPI records are read with explicit per-table columns (kpi_puesto has no nivel); SGC requires referencia_fuente, files are optional period evidence in kpi_evidencias linked via kpi_resultado_evidencia; why: auditable capture that never recalculates past periods nor bypasses human review.
