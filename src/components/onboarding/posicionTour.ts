interface Rectangulo {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
  height: number;
}

/** Prefer a free side of the target, then constrain the measured message to the viewport. */
export function posicionTour(
  rect: Rectangulo | null,
  mensaje: { width: number; height: number },
  pantalla: { width: number; height: number },
) {
  const margen = 16;
  const separacion = 16;
  const width = Math.min(mensaje.width, Math.max(0, pantalla.width - margen * 2));
  const height = Math.min(mensaje.height, Math.max(0, pantalla.height - margen * 2));
  const centrar = { left: (pantalla.width - width) / 2, top: (pantalla.height - height) / 2 };
  const limitar = (p: { left: number; top: number }) => ({
    left: Math.max(margen, Math.min(p.left, pantalla.width - width - margen)),
    top: Math.max(margen, Math.min(p.top, pantalla.height - height - margen)),
  });
  if (!rect) return limitar(centrar);

  const horizontal = Math.max(margen, Math.min(rect.left + (rect.width - width) / 2, pantalla.width - width - margen));
  const vertical = Math.max(margen, Math.min(rect.top, pantalla.height - height - margen));
  const derecha = { left: rect.right + separacion, top: vertical };
  const izquierda = { left: rect.left - separacion - width, top: vertical };
  const abajo = { left: horizontal, top: rect.bottom + separacion };
  const arriba = { left: horizontal, top: rect.top - separacion - height };
  const candidatos = rect.width > pantalla.width / 2 || pantalla.width < 768
    ? [abajo, arriba, derecha, izquierda]
    : [derecha, izquierda, abajo, arriba];
  const cabe = candidatos.find((p) => p.left >= margen && p.top >= margen
    && p.left + width <= pantalla.width - margen && p.top + height <= pantalla.height - margen);
  return limitar(cabe ?? abajo);
}