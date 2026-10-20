// T4f: referencia compartida; no participa en cálculos ni modifica instrumentos.
export const REFERENCIA_APENDICE_A = 'NOM-241-SSA1-2025 / NOM-059-SSA1-2015';
export const APENDICE_A = [
  { clase: 'Clase A', etiqueta: 'Clase A (ISO-5)', particulas05: '3 520 / 3 520', particulas5: '20 / 20', monitoreo: 'Continuo', ufc: '< 1/placa sed.; < 1/m³; < 1/placa contacto; < 1/guante', presion: '> 15 Pa con respecto a cuartos adyacentes, en cascada', aire: 'n.a.', temperatura: '18–25 °C', hr: '30–65 % HR' },
  { clase: 'Clase B', etiqueta: 'Clase B', particulas05: '3 520 / 352 000', particulas5: '29 / 2 900', monitoreo: 'Cada 3 meses', ufc: '< 5/placa sed.; < 10/m³; < 5/placa contacto; < 5/guante', presion: '> 15 Pa con respecto a áreas no asépticas, en cascada', aire: '20 a 50', temperatura: '18–25 °C', hr: '30–65 % HR' },
  { clase: 'ISO-7', etiqueta: 'Clase C (ISO-7)', particulas05: '352 000 / 3 520 000', particulas5: '2 900 / 29 000', monitoreo: 'Cada 6 meses', ufc: '< 50/placa sed.; < 100/m³; < 25/placa contacto', presion: '> 10 Pa', aire: '20 a 50', temperatura: '18–25 °C', hr: '30–65 % HR' },
  { clase: 'ISO-8', etiqueta: 'Clase D (ISO-8)', particulas05: '3 520 000 / n.a.', particulas5: '29 000 / n.a.', monitoreo: 'Cada 6 meses', ufc: '< 100/placa sed.; < 200/m³; < 50/placa contacto', presion: '> 5 Pa; negativa donde se generan polvos con respecto a adyacentes y positiva donde no', aire: '10 a 20', temperatura: '18–25 °C', hr: '30–65 % HR' },
  { clase: 'ISO-9', etiqueta: 'ISO-9', particulas05: '35 200 000 / n.a.', particulas5: '293 000 / n.a.', monitoreo: 'Anual', ufc: 'n.a.', presion: 'Positiva con respecto a áreas no clasificadas', aire: 'n.a.', temperatura: '18–25 °C', hr: 'n.a.' },
  { clase: 'Área limpia', etiqueta: 'Área limpia (libre de clasificación)', particulas05: 'n.a.', particulas5: 'n.a.', monitoreo: 'n.a.', ufc: 'n.a.', presion: 'n.a.', aire: 'n.a.', temperatura: '18–25 °C', hr: 'n.a.' },
  { clase: 'Área gris', etiqueta: 'Área gris (libre de clasificación)', particulas05: 'n.a.', particulas5: 'n.a.', monitoreo: 'n.a.', ufc: 'n.a.', presion: 'n.a.', aire: 'n.a.', temperatura: 'n.a.', hr: 'n.a.' },
] as const;

export const TABLA_APENDICE_A = [
  'Clasificación | Partículas ≥0.5 µm /m³ (estático / dinámico) | Partículas ≥5 µm /m³ (estático / dinámico) | Frecuencia de monitoreo | UFC | Presión diferencial | Cambios de aire por hora | Temperatura | Humedad relativa',
  ...APENDICE_A.map(c => [c.etiqueta, c.particulas05, c.particulas5, c.monitoreo, c.ufc, c.presion, c.aire, c.temperatura, c.hr].join(' | ')),
].join('\n');

/** Actualiza citas de borradores sin cambiar los snapshots históricos. */
export function citarNormasCompartidas(texto: string): string {
  return texto.replace(/NOM-(?:241|059)(?:-SSA1(?:-\d{4})?)?(?:\s*\/\s*NOM-(?:241|059)(?:-SSA1(?:-\d{4})?)?)?/g, REFERENCIA_APENDICE_A);
}