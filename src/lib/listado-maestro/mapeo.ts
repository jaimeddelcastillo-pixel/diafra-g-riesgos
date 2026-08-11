/** Detección y propuesta de mapeo de columnas del Listado Maestro. */
import { normalizar } from "./parse";
import type { CampoTracea, Confianza, MapeoColumna, RegistroImport, TablaCruda } from "./tipos";

export const CAMPOS: { campo: CampoTracea; etiqueta: string; sinonimos: string[] }[] = [
  { campo: "codigo", etiqueta: "Código", sinonimos: ["codigo", "clave", "no documento", "num", "numero", "folio", "identificador"] },
  { campo: "nombre", etiqueta: "Nombre del documento", sinonimos: ["nombre", "titulo", "documento", "procedimiento", "descripcion", "nombre del documento"] },
  { campo: "revision", etiqueta: "Revisión", sinonimos: ["revision", "version", "edicion", "rev", "ver", "ed"] },
  { campo: "fecha", etiqueta: "Fecha", sinonimos: ["fecha", "vigencia", "fecha vigencia", "fecha emision", "fecha de emision", "vigente desde"] },
  { campo: "area", etiqueta: "Área", sinonimos: ["area", "departamento", "direccion", "unidad", "gerencia"] },
  { campo: "responsable", etiqueta: "Responsable", sinonimos: ["responsable", "dueno", "owner", "elaboro", "elaborado por"] },
  { campo: "estado", etiqueta: "Estado", sinonimos: ["estado", "estatus", "activo", "situacion"] },
  { campo: "tipo", etiqueta: "Tipo", sinonimos: ["tipo", "tipo documento", "tipo de documento", "categoria", "clasificacion"] },
];

function puntuar(encabezado: string, sinonimos: string[]): { score: number; confianza: Confianza } {
  const h = normalizar(encabezado);
  if (!h) return { score: 0, confianza: "baja" };
  for (const s of sinonimos) {
    if (h === s) return { score: 100, confianza: "alta" };
  }
  for (const s of sinonimos) {
    if (h.startsWith(s) || s.startsWith(h)) return { score: 70, confianza: "media" };
  }
  for (const s of sinonimos) {
    if (h.includes(s) || s.includes(h)) return { score: 45, confianza: "baja" };
  }
  return { score: 0, confianza: "baja" };
}

/** Propone un mapeo columna→campo; cada campo se asigna a lo sumo una vez. */
export function proponerMapeo(tabla: TablaCruda): MapeoColumna[] {
  const candidatos: { i: number; campo: CampoTracea; score: number; confianza: Confianza }[] = [];
  tabla.encabezados.forEach((h, i) => {
    for (const { campo, sinonimos } of CAMPOS) {
      const { score, confianza } = puntuar(h, sinonimos);
      if (score > 0) candidatos.push({ i, campo, score, confianza });
    }
  });
  candidatos.sort((a, b) => b.score - a.score);

  const usadosCampo = new Set<CampoTracea>();
  const usadoIndice = new Map<number, { campo: CampoTracea; confianza: Confianza }>();
  for (const c of candidatos) {
    if (usadosCampo.has(c.campo) || usadoIndice.has(c.i)) continue;
    usadosCampo.add(c.campo);
    usadoIndice.set(c.i, { campo: c.campo, confianza: c.confianza });
  }

  return tabla.encabezados.map((h, i) => ({
    origen: h,
    indice: i,
    campo: usadoIndice.get(i)?.campo ?? null,
    confianza: usadoIndice.get(i)?.confianza ?? "baja",
  }));
}

export function mapeoValido(mapeo: MapeoColumna[]): boolean {
  return mapeo.some((m) => m.campo === "nombre");
}

/** Aplica el mapeo a las filas; descarta registros sin nombre. */
export function aplicarMapeo(tabla: TablaCruda, mapeo: MapeoColumna[]): RegistroImport[] {
  const registros: RegistroImport[] = [];
  tabla.filas.forEach((fila, idx) => {
    const r: any = { fila: tabla.filaEncabezado + idx + 2 };
    for (const m of mapeo) {
      if (!m.campo) continue;
      const v = (fila[m.indice] ?? "").trim();
      if (v) r[m.campo] = v;
    }
    if (r.nombre) registros.push(r as RegistroImport);
  });
  return registros;
}

/** Áreas explícitas detectadas en la columna mapeada como "area". */
export function areasDetectadas(registros: RegistroImport[]): string[] {
  const set = new Map<string, string>();
  for (const r of registros) {
    if (r.area) set.set(normalizar(r.area), r.area.trim());
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b));
}

const VERBOS_PROCESO = [
  "limpieza", "fabricacion", "control de cambios", "capa", "calibracion",
  "mantenimiento", "validacion", "capacitacion", "auditoria", "muestreo",
  "liberacion", "almacenamiento", "distribucion", "quejas", "desviaciones",
  "retiro", "manejo", "gestion", "revision", "verificacion",
];

/** Procesos inferidos del título de los PNO — SIEMPRE propuesta, nunca confirmados. */
export function procesosCandidatos(registros: RegistroImport[]): { nombre: string; evidencia: string }[] {
  const out = new Map<string, string>();
  for (const r of registros) {
    const n = normalizar(r.nombre);
    for (const v of VERBOS_PROCESO) {
      if (n.includes(v) && !out.has(v)) {
        out.set(v, r.nombre);
      }
    }
  }
  return Array.from(out.entries()).map(([nombre, evidencia]) => ({
    nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1),
    evidencia,
  }));
}
