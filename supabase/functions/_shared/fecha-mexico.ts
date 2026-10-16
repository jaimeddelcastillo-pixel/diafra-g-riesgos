/** Fecha civil del servidor en Ciudad de México, independiente de su zona horaria. */
export function fechaMexico(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(ahora);
  const valor = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

export function contextoFechaMexico(ahora = new Date()): string {
  return `Fecha de hoy: ${fechaMexico(ahora)} (hora de México)`;
}