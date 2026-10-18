import type {Registro} from "./semanas";
export function claveInstrumento(r: Registro): string {
  if (r.instrumento_id) return `i:${r.instrumento_id}`;
  if (r.par_cuartos_id) return `p:${r.par_cuartos_id}`;
  if (r.hvac_id) return `h:${r.hvac_id}:${r.etapa ?? ""}`;
  return `m:${r.modulo}`;
}

/**
 * Consolida múltiples registros del mismo instrumento (uno por importación/semana)
 * en un único Registro lógico con TODAS sus semanas fusionadas y ordenadas.
 * Esto garantiza que el reporte genere 1 página por instrumento, no 1 por semana.
 */
export function consolidarPorInstrumento(regs: Registro[]): Registro[] {
  const grupos = new Map<string, Registro[]>();
  for (const r of regs) {
    const k = claveInstrumento(r);
    const arr = grupos.get(k);
    if (arr) arr.push(r);
    else grupos.set(k, [r]);
  }
  const out: Registro[] = [];
  for (const grupo of grupos.values()) {
    if (grupo.length === 1) { out.push(grupo[0]); continue; }
    // Tomar el más antiguo como base; combinar semanas dedup por semana_inicio
    const base = [...grupo].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    const semanasMap = new Map<string, typeof base.semanas[number]>();
    for (const r of grupo) {
      for (const s of r.semanas) {
        const prev = semanasMap.get(s.semana_inicio);
        // Conservar la más reciente si hay duplicado por fecha
        if (!prev || (s.saved_at ?? "") > (prev.saved_at ?? "")) {
          semanasMap.set(s.semana_inicio, s);
        }
      }
    }
    const semanas = Array.from(semanasMap.values()).sort((a, b) => a.semana_inicio.localeCompare(b.semana_inicio));
    out.push({ ...base, semanas });
  }
  return out;
}

