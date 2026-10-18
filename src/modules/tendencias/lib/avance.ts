import {lunesDe, lecturasCapturadas, lecturasEsperadas, esSemanaCompleta, type Registro, type Semana, type PuntoLectura} from "./semanas";
import type {Instrumento} from "./catalogos";
import {format} from "date-fns";
interface Fila {semanas: Map<string, Semana>; modulo: string; sinDatos: boolean; registro: Registro;}

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

function fueraDeLimites(r: Registro, s: Semana, ins?: Instrumento): number {
  const cuenta = (arr: PuntoLectura[] | undefined, lie?: number | null, lse?: number | null) =>
    (arr ?? []).filter((p) => !p._na && p.valor != null && Number.isFinite(p.valor) &&
      ((lie != null && p.valor < lie) || (lse != null && p.valor > lse))).length;
  if (r.modulo === "temphr") return cuenta(s.lecturas, r.lie_t, r.lse_t) + cuenta(s.lecturas_hr, r.lie_hr, r.lse_hr);
  return cuenta(s.lecturas, r.lie ?? ins?.lie_pa, r.lse ?? ins?.lse_pa);
}

export function lunesDelPeriodo(desde: Date, hasta: Date): string[] {
  const out: string[] = [];
  const d = new Date(lunesDe(desde) + "T00:00:00");
  const fin = format(hasta, "yyyy-MM-dd");
  while (format(d, "yyyy-MM-dd") <= fin && out.length < 60) {
    out.push(format(d, "yyyy-MM-dd"));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

export type Estado = "completa" | "parcial" | "vacia" | "fuera";
export function estadoSemana(f: Fila, lunes: string, instrMap: Map<string, Instrumento>) {
  const s = f.semanas.get(lunes);
  const esTHR = f.modulo === "temphr";
  if (!s) return { estado: "vacia" as Estado, cap: 0, esp: 0, fuera: 0 };
  if (f.sinDatos) return { estado: "vacia" as Estado, cap: 0, esp: 0, fuera: 0 };
  const cap = lecturasCapturadas(s, esTHR);
  const esp = lecturasEsperadas(s, esTHR);
  const fuera = fueraDeLimites(f.registro, s, f.registro.instrumento_id ? instrMap.get(f.registro.instrumento_id) : undefined);
  const estado: Estado = fuera > 0 ? "fuera" : cap === 0 ? "vacia" : esSemanaCompleta(s, esTHR) ? "completa" : "parcial";
  return { estado, cap, esp, fuera };
}


export function resumenAvance(filas: Fila[], lunes: string[], instrumentos: Map<string, Instrumento>) {
 let alDia=0, pendientes=0, fuera=0;
 for(const f of filas){
  if(lunes.length && estadoSemana(f,lunes[lunes.length-1],instrumentos).estado==='completa') alDia++;
  for(const l of lunes){const e=estadoSemana(f,l,instrumentos); if(e.estado==='vacia'||e.estado==='parcial') pendientes++; fuera+=e.fuera;}
 }
 return {alDia,pendientes,fuera};
}
