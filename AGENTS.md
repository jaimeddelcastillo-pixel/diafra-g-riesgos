Base principles (always):
- Company and role come only from contexto_org_actual(), get_user_org_id() and has_role (role in the active company); never trust a client-sent org_id.
- Nothing is deleted: users are deactivated, records retired/obsoleted/voided; audit_trail is insert-only.
- AI proposes; it never validates, approves or signs.
- Tests run only in es_prueba companies, never with DIAFRA data.
- organizations whitelist: admin/RS change only allowed fields; commercial fields only support or the system.

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
