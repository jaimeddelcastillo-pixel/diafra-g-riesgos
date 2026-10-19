// T4c: catálogo normativo. Sugerencias (la persona acepta o cambia) y revisión automática del catálogo.
// Nada aquí valida ni guarda: solo propone y señala.
import type { Instrumento } from "./catalogos";

export type VariableNorma = "presion" | "temperatura" | "hr";
export interface NormaEspecificacion {
  id: string; norma: string; apartado: string | null; clase_iso: string; variable: VariableNorma;
  texto: string; lie: number | null; lse: number | null; lie_estricto: boolean; lse_estricto: boolean;
  unidad: string | null; sin_valor: boolean; nota: string | null; activo: boolean;
}
export interface Sugerencia {
  texto: string; lie: number | null; lse: number | null; lie_estricto: boolean; lse_estricto: boolean;
  referencia: string; sin_valor: boolean; nota: string | null;
}

export const CLASES_INSTRUMENTO = [
  { value: "diferencial_sala", label: "Diferencial de sala" },
  { value: "filtro_ducto", label: "Filtro o ducto" },
  { value: "aire_proceso", label: "Aire comprimido o proceso" },
  { value: "equipo", label: "Equipo" },
] as const;

/** Variable(s) del instrumento según su tipo. */
export function variablesDe(i: Pick<Instrumento, "tipo">): VariableNorma[] {
  return i.tipo === "termohigrometro" ? ["temperatura", "hr"] : ["presion"];
}

export function sugerir(normas: NormaEspecificacion[], iso: string | null | undefined, variable: VariableNorma): Sugerencia | null {
  if (!iso) return null;
  const n = normas.find((x) => x.activo && x.clase_iso === iso && x.variable === variable);
  if (!n) return null;
  return {
    texto: n.texto, lie: n.lie, lse: n.lse, lie_estricto: n.lie_estricto, lse_estricto: n.lse_estricto,
    referencia: [n.norma, n.apartado].filter(Boolean).join(" "), sin_valor: n.sin_valor, nota: n.nota,
  };
}

/** Criterio interno: la empresa exige más que la norma (o la norma no da valor y la empresa sí). */
export function esCriterioInterno(s: Sugerencia | null, lie: number | null | undefined, lse: number | null | undefined): boolean {
  if (!s) return false;
  if (s.sin_valor) return lie != null || lse != null;
  if (s.lie != null && lie != null && lie > s.lie) return true;
  if (s.lse != null && lse != null && lse < s.lse) return true;
  return false;
}

/** Números presentes en un texto de especificación ("> 10 Pa" → [10]; "18 a 25 °C" → [18, 25]). */
export function numerosDeTexto(t: string | null | undefined): number[] {
  return (t ?? "").replace(/ISO[-\s]?\d/gi, "").match(/-?\d+(?:[.,]\d+)?/g)?.map((x) => Number(x.replace(",", "."))) ?? [];
}

export type Nivel = "rojo" | "amarillo";
export interface Hallazgo { clave: string; nivel: Nivel; mensaje: string }

export function revisarInstrumento(
  i: Instrumento, iso: string | null | undefined, media: number | null | undefined, normas: NormaEspecificacion[],
): Hallazgo[] {
  const h: Hallazgo[] = [];
  const presion = !variablesDe(i).includes("temperatura");
  const lie = i.spec_lie ?? null, lse = i.spec_lse ?? null;
  const texto = (i.spec_texto ?? i.especificacion ?? "").trim();

  if (!i.spec_estado || i.spec_estado === "pendiente" || (lie == null && lse == null && i.spec_estado !== "na"))
    h.push({ clave: "sin_spec", nivel: "amarillo", mensaje: "Sin especificación o pendiente de validar" });

  if (texto) {
    const nums = numerosDeTexto(texto);
    const lim = [lie, lse].filter((v): v is number => v != null);
    if (lim.length && !lim.every((v) => nums.includes(v)))
      h.push({ clave: "texto_limites", nivel: "rojo", mensaje: `El texto «${texto}» no coincide con LIE/LSE` });
    const m = texto.match(/ISO[-\s]?(\d)/i);
    if (m && iso && iso.startsWith("ISO") && `ISO-${m[1]}` !== iso)
      h.push({ clave: "iso_texto", nivel: "rojo", mensaje: `El texto menciona ISO-${m[1]} pero el área es ${iso}` });
  }

  const s = sugerir(normas, iso, presion ? "presion" : "temperatura");
  if (s && s.lie != null && s.lie_estricto && lie === s.lie && !i.spec_lie_estricto)
    h.push({ clave: "comparacion", nivel: "rojo", mensaje: `Dice «≥ ${lie}» donde la norma dice «> ${s.lie}»` });

  if (presion && lie != null && lse != null && ((lie >= 18 && lse <= 25) || (lie >= 30 && lse <= 65)))
    h.push({ clave: "valores_thr", nivel: "rojo", mensaje: "Los límites parecen de temperatura o HR, no de presión" });

  if (media != null) {
    if (lie != null && lie > media)
      h.push({ clave: "lie_media", nivel: "rojo", mensaje: `LIE ${lie} mayor que la media del trimestre (${media.toFixed(1)})` });
    else if ((lie != null && media - lie < 1) || (lse != null && lse - media < 1))
      h.push({ clave: "margen", nivel: "amarillo", mensaje: `Margen justo: media ${media.toFixed(1)} a menos de 1 unidad del límite` });
    const emax = i.escala_max ?? null, emin = i.escala_min ?? 0;
    if (emax != null && emax > emin && (media - emin) / (emax - emin) >= 0.9)
      h.push({ clave: "tope_escala", nivel: "amarillo", mensaje: `Media cerca del tope de la escala (${emax})` });
  }

  const bit = (i.codigo_bitacora ?? "").trim();
  if (!bit) h.push({ clave: "bitacora", nivel: "amarillo", mensaje: "Código de bitácora vacío" });
  else if (bit.length > 24 || /\s/.test(bit)) h.push({ clave: "bitacora", nivel: "amarillo", mensaje: "Código de bitácora con texto largo" });

  return h;
}

export const semaforo = (h: Hallazgo[]): "verde" | "amarillo" | "rojo" =>
  h.some((x) => x.nivel === "rojo") ? "rojo" : h.length ? "amarillo" : "verde";

/** Solo «diferencial de sala» entra al análisis de presiones de áreas; «filtro o ducto» va a Banco de filtros. */
export function claseEfectiva(i: Pick<Instrumento, "tipo" | "clase_instrumento">): Instrumento["clase_instrumento"] {
  if (i.clase_instrumento) return i.clase_instrumento;
  return i.tipo === "manometro_diferencial" || i.tipo === "otro" ? "diferencial_sala" : i.tipo === "manometro_filtro" ? "filtro_ducto" : "equipo";
}
