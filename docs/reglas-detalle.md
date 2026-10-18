# Reglas técnicas — detalle

## R23
Bitacora extraction loads original task prompts from versioned skills, reads tenant-private photos only in documento-contenido, reserves lifetime company consumption in tend_extracciones and persists proposals/provenance before human confirmation. The capturist corrects doubtful cells; prior readings still require audited reasons and issued weeks reject changes. Persistent server notification claims prevent concurrent duplicate dispatch; AI access/credit denials persist a blocked state without automated retries. Why: controlled prompts, tenant isolation and no silent validation or duplicate billing.

## R21
Issuance runs input snapshot protection before AT authorization and server snapshot creation; snapshots include registros[].semanas[].id. Week changes referenced by an emitted AT fail in both manual and extraction paths. Prior readings require a reason in tracea.semana_motivo and an immutable old/new audit entry. Week source is manual unless the human extraction-confirmation function sets its internal transaction flag; dates derive from semana_inicio and photo paths must match the active company without traversal. Substitution registration freezes the titular RS identity; issuance copies rs_sustituido_nombre from that substitution, never a live client value.
Tendencias uses existing active-company/module helpers through tend_acceso; super-admin can only SELECT with a live recorded support session, never write even with service-role bypass. Shared org_suplencias uses its own active-company guard independently of module access. AT state transitions stamp authenticated actors, retain issuance identity and archive the previous row; history INSERT is only allowed nested inside guarded versioning, and UPDATE/DELETE/TRUNCATE are blocked. Beta module rights come only from manual features, never plans; price/plan triggers enforce exclusion. Substitution expiry is computed at use time and separately audited hourly. Notification status is recorded without delivery until T3; why: isolate tenants, maintain immutable provenance and enforce approval separation across modules.

## R20
Riesgos retrieves validated knowledge only through contexto_cerebro (active company or authenticated server service role, contracted Cerebro, explicit codes first, Spanish OR search ranked by ts_rank). Without direct matches it returns at most five items whose area/process relates to the folio process; all paths retain the 12-item/6000-character caps. Search input includes folio process, current wizard stage and latest user message. Response diagnostics are streamed and persisted in documentos_adjuntos alongside contexto_detalle, displayed only by the super-admin provenance control. The per-company switch defaults off; only block composition loads uso_conocimiento_empresa and the dynamic knowledge section. Risk insert triggers read the user's persisted assistant proposal, store its provenance and create cited knowledge references in the same transaction, without granting ordinary users general Cerebro write access. Knowledge codes remain immutable and unique per company; why: module isolation, opt-in use and auditable, non-client-forged attribution.

Detalle completo de cada regla resumida en AGENTS.md (R1…R17).

## R1
Document types are classified only by SQL clasificar_tipo_documento over each org's documento_tipos catalog (template rows have org_id NULL and never classify); why: one rule for imports, Recursos and reclassification.

## R2
Recursos (org_documentos) never references brain_* tables; file/hash columns are immutable by trigger; retention is decided only by org_documento_retencion (trigger + purge functions); why: Recursos must work without Cerebro and no path may delete a controlled or Cerebro-linked file.

## R3
Per-plan caps (interviews, export, extraction, pages) live only in plan_limites, read via plan_limite/mi_plan_limite (NULL = unlimited); server-side export, when built, must enforce `exportar` from this table, not only the UI; why: limits change by data, not code.

## R4
File reading (PDF/Word/image) lives only in _shared/documento-contenido.ts, shared by chat-analizar-documento and brain-extract-document; brain-extract-document recomputes SHA-256 first and stops with 409 + HUELLA_NO_COINCIDE on mismatch; why: one extraction path, knowledge never from an altered file.

## R5
Extracted knowledge always enters por_validar with fuente tipo_fuente='archivo' (página/párrafo/sección/cita/método); if the fuente fails the item is deleted; why: EXTRAER ≠ VALIDAR, no source = no traceability.

## R6
Document state, uncontrolled copy and revision change are only proposals from extraction; only active-org admin/RS confirm them (brain_documents_estado_guard / org_documentos_copia_guard); why: the IA never changes an official state.

## R7
Each extraction logs brain_extracciones (text sent, except vision) and each source keeps extraccion_id; why: whoever validates can check what the IA read.

## R8
Modules are hybrid: DB (modulos, plan_modulos, organization_features via mi_org_tiene_modulo; estado proximamente never grants access) decides access and order; src/modules/<clave>/module.ts decides menu, routes, card and pendientes, guarded by ModuloGuard; shared pages (Recursos) live in rutasPlataforma and open with any module; why: add a module without touching menu, App routes or Inicio.

## R9
Headers and route ownership resolve from the module registry, including shared pages; support navigation uses mis_modulos commercial access plus an admin presentation context without global bypass; why: keep platform navigation consistent with the supported company's access.

## R10
Overdue review cutoff is computed only by public.folios_revision_corte (check-folios-revision + pendientes_riesgos), preserving UTC JavaScript month overflow; why: notification and card share one identical rule even on leap days.

## R11
Training routes belong to their owning module registry and courses are filtered by cursos.modulo_clave; course payment rules stay independent; why: module navigation must not grant new commercial rights.

## R12
Course access is decided only by public.mi_acceso_curso (completo/vista_previa/ninguno) in RLS, exam functions/trigger and emitir-diploma, read by screens via useCurso; Mis diplomas never filters by module (groups via mis_cursos_certificados), lives outside module guards, and opens read-only for suspended companies (no new diplomas or DC-3); why: one rule respects expiry and earned diplomas stay reachable.

## R13
Tours are tracked per person in onboarding_estado (org_id NULL = plataforma); each module declares its tours in module.ts, OnboardingController triggers them and never shows/writes for super_admin/support; replay from Ayuda never deletes rows; message placement uses posicionTour (measured size vs viewport); why: tours belong to the person and must never push controls off-screen.

## R14
Company setup checklist is computed only by SQL pendientes_configuracion (active org, contracted modules); the asistente page and Inicio card only render it and link to existing screens; why: one source of truth for "configured".

## R15
External auditors are never org_members: everything goes through SECURITY DEFINER functions (auditor_mis_expedientes / auditor_ver_item / auditor_registrar_folio_pdf; duplicar_auditoria copies only still-valid items) and edge function auditoria-descargar (PDF always watermarked on screen, download only if permite_descarga), validated by auditoria_validar_acceso and logged in audit_trail; why: isolation comes from non-membership, no RLS exceptions.

## R16
All AI prompts (asistente, Cerebro, extracción, análisis, causa raíz) are versioned skills: text lives only in agent_prompts (FK ia_skills, vigente/retirada, published versions immutable), read by Edge Functions via _shared/skills.ts; a missing vigente skill fails with a clear error logged as SKILL_NO_VIGENTE; why: one controlled, auditable prompt source, no hardcoded fallbacks.

## R17
AI composition for Riesgos is per company in ia_config_org (default monolitica; only super_admin, audited). chat-asistente uses _shared/skills.ts armarRiesgos (plataforma, riesgos_amef, norma_nom241|norma_nom059, [CONTEXTO_EMPRESA], [ALCANCE_TRACEA]) only when the company is 'bloques' and the three required pieces are vigente; otherwise dm/farma and COMPOSICION_BLOQUES_INCOMPLETA is logged. Fixed blocks carry Anthropic cache_control. Block pieces are published only from a borrador via publicar_skill, and only when ia_skill_casos_faltantes = 0 (a run in ia_skill_pruebas of that sha256 with all cases 'pasa', graded by a person). skills_usadas plus modelo_ia record every piece and model; accepted causa-raiz-ai suggestions land in riesgos.ia_origen; why: no client change until piloted, and no prompt goes live untested.

## R21
Tendencias writes use active-company guards, never super-admin writes. Issuance snapshots are server-only and retain selected records, week IDs and substitution identity; prior-reading corrections require a reason and immutable before/after audit, while emitted weeks reject manual and extraction changes. Source, month/year and photo ownership are server-guarded; why: tenant isolation and immutable issuance.

## R22
Copied atdiafra engines stay separate from tenant persistence. Issued Word reads frozen format, records/catalogs, text, identities and calculation date exclusively from issuance snapshots; source regression tests preserve calculations/report structure. Live catalogs are only for drafts; why: historical reports stay reproducible after catalog/profile changes.

## R23
Bitacora AI reads versioned task skills and tenant-private originals; proposed and human-confirmed values, model, skill hashes and usage remain separate. Label normalization only reconciles original day/shift spelling, never readings. Notification claims and terminal AI blocks persist server-side; why: prevent duplicate notices, silent overwrites and repeated blocked billing.


## R24
Task model configuration lives in ia_skills.modelo_ia and is changed only with configurar_modelo_skill by super-admin with a reason; the extraction stores the resolved model in both model and skill provenance. Batch extraction uses at most two workers, stops starting work after terminal failures and retains in-flight outcomes; human confirmation remains sequential. Shared bitacora-fechas calendar checks prioritize a legible in-range written year, search candidates only for doubtful/out-of-range years, and require all visible dates to match their weekday columns in one week; unresolved dates flag review on the server and do not propose a Monday in the UI. The lower year comes from the first persisted date (including retired weeks) or the previous Mexico City year; the upper year is always current +1. Original extracted dates remain alongside corrected proposals. Raw Excel uses tend_exportar_crudo to return only the owned record's readings and before/after correction snapshots without exposing general audit_trail access. Why: configurable extraction, controlled concurrency and tenant-private traceability.
Capture batch processing creates independent server-persisted photo proposals, compresses derived uploads before AI, isolates recoverable per-item errors and stops terminal account errors. Human review precedes confirmation; detected dates remain proposals. Date correction and retirement RPCs derive the active company, require audited reasons for changed readings/retirements, preserve IDs/history and reject issued snapshot inputs. New calculations and issuance snapshots exclude inactive weeks and filter changes; historical snapshots remain untouched. Contextual catalogue creation retains admin-only permissions; why: recoverable reviewed batches without deletion, cross-tenant writes or changes to the original engine.

## R25
Report detail is registered within Tendencias and retires via tend_retirar; the validation inbox is a catalogue view using existing admin-only audited persistence, with specification and area states kept distinct (N/A only for specification). Analysis resolves linked record IDs to instruments and accepts linked date ranges. Historical selection is explicit read-only and blocks every mutation; absent historical/canceled snapshots disable calculated exports instead of consulting live catalogs. Cancellation state/reason/date come from the selected lifecycle row while issued content stays frozen. AT Excel uses xlsx-js-style to serialize canceled-row strike-through. Why: clear navigation and document lifecycle without changing the engine, permissions or audit rules.
