// Helpers para campos multi-elemento de un riesgo (secuencia de eventos, causas,
// controles). La plataforma los guarda como líneas numeradas ("1. …\n2. …") y el
// wizard los vuelve a separar por salto de línea. El asistente de IA a veces
// entrega un solo párrafo: aquí lo normalizamos a elementos separados.

const VINETA_RE = /^\s*(?:\d{1,2}[.)\-–]|[-–•*·])\s*/;

/** Quita numeración/viñeta inicial de un elemento. */
export function limpiarElemento(s: string): string {
  return String(s ?? "").replace(VINETA_RE, "").trim();
}

/**
 * Normaliza un valor (arreglo o string) a una lista de elementos.
 * Si es string intenta dividir por: saltos de línea → viñetas/numeración inline
 * → separadores de secuencia (→, ->, ;) → conectores ("luego", "después").
 */
export function normalizarLista(value: unknown, maxItems = 12): string[] {
  if (value == null) return [];
  let items: string[] = [];

  if (Array.isArray(value)) {
    items = value.map((v) =>
      typeof v === "string" ? v : typeof v === "object" && v ? String((v as any).texto ?? "") : String(v ?? ""),
    );
  } else {
    const txt = String(value).trim();
    if (!txt) return [];
    items = txt.split(/\r?\n+/);
    if (items.length < 2) items = dividirInline(txt);
  }

  const out: string[] = [];
  for (const raw of items) {
    const v = limpiarElemento(raw);
    if (v) out.push(v);
  }
  return out.slice(0, maxItems);
}

function dividirInline(txt: string): string[] {
  // Numeración o viñetas dentro del mismo párrafo: "1. algo 2. otra"
  const numerado = txt.split(/\s*(?=\d{1,2}[.)]\s+[A-ZÁÉÍÓÚÑa-z])/g).filter((s) => s.trim());
  if (numerado.length > 1) return numerado;

  const vinetas = txt.split(/\s+[-–•*]\s+/g).filter((s) => s.trim());
  if (vinetas.length > 1) return vinetas;

  const flechas = txt.split(/\s*(?:→|->|=>|\|)\s*/g).filter((s) => s.trim());
  if (flechas.length > 1) return flechas;

  const puntoYComa = txt.split(/\s*;\s*/g).filter((s) => s.trim());
  if (puntoYComa.length > 1) return puntoYComa;

  return [txt];
}

/** Convierte una lista (o texto) al formato numerado que guarda la plataforma. */
export function aListaNumerada(value: unknown, maxItems = 12): string {
  const items = normalizarLista(value, maxItems);
  return items.map((v, i) => `${i + 1}. ${v}`).join("\n");
}

export type ControlPrevencion = { nivel: "A" | "B" | "C"; texto: string };

/**
 * Normaliza controles de prevención al formato "1. [A] texto".
 * Acepta arreglo de objetos {nivel, texto}, arreglo de strings con prefijo
 * "[A]" o un texto plano (que cae a nivel A por defecto).
 */
export function aControlesPrevencionTexto(value: unknown, maxItems = 12): string {
  if (value == null) return "";
  const crudos: ControlPrevencion[] = [];

  if (Array.isArray(value)) {
    for (const v of value) {
      if (v && typeof v === "object") {
        const nivel = String((v as any).nivel ?? "A").toUpperCase();
        const texto = limpiarElemento(String((v as any).texto ?? ""));
        if (texto) crudos.push({ nivel: nivel === "B" || nivel === "C" ? (nivel as "B" | "C") : "A", texto });
      } else {
        const parsed = parsePrefijoNivel(limpiarElemento(String(v ?? "")));
        if (parsed) crudos.push(parsed);
      }
    }
  } else {
    for (const linea of normalizarLista(value, maxItems)) {
      const parsed = parsePrefijoNivel(linea);
      if (parsed) crudos.push(parsed);
    }
  }

  return crudos
    .slice(0, maxItems)
    .map((c, i) => `${i + 1}. [${c.nivel}] ${c.texto}`)
    .join("\n");
}

function parsePrefijoNivel(linea: string): ControlPrevencion | null {
  if (!linea) return null;
  const m = linea.match(/^(?:\[\s*(A|B|C)\s*\]|(A|B|C)\s*[:\-–])\s*(.+)$/i);
  if (m && m[3].trim()) {
    return { nivel: (m[1] ?? m[2]).toUpperCase() as "A" | "B" | "C", texto: m[3].trim() };
  }
  return { nivel: "A", texto: linea };
}
