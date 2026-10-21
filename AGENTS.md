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

- T5d platform substitutions are managed at /configuracion/suplencias; exact-role permissions come from rol_efectivo through shared server context/has_role, accepted and time-bounded only. RS substitution never grants user administration, admin substitution never authorizes AT; immutable audit and records retain actor/titular identity and self-authorization is forbidden; why: shared governance without cross-role escalation.

- P1 «Mis pendientes» is computed only by the server function pendientes_usuario (read-only, active company, rol_efectivo incl. accepted valid substitution, only modules active via org_tiene_modulo); semaphore thresholds live per company in org_pendientes_semaforo written only via guardar_semaforo_pendientes (admin/RS), with the same colour rule mirrored in src/lib/pendientes.ts; profiles.perfil_confirmado_en gates signer eligibility (list and issuance); why: one auditable source for pending items without per-module client logic.
