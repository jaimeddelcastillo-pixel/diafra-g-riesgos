import { describe, it, expect } from 'vitest';
import { APENDICE_A, REFERENCIA_APENDICE_A, citarNormasCompartidas } from '../apendice-a';
import { ISO_CLASES } from '../catalogos';
import { sugerir, type NormaEspecificacion } from '../norma';
import { readFileSync } from 'node:fs';
import { TABLA_APENDICE_A } from '../apendice-a';

describe('T4f Apéndice A compartido', () => {
  it('las nuevas emisiones congelan exactamente los mismos valores normativos que el Word', () => {
    const sql = readFileSync('drizzle/migrations/0069_t4f_snapshot_apendice_compartido.sql','utf8');
    const tabla = sql.match(/\$tabla\$([\s\S]*?)\$tabla\$/)?.[1];
    expect(tabla?.split('\n').map(r => r.split(' | '))).toEqual(TABLA_APENDICE_A.split('\n').map(r => r.split(' | ')));
  });
  const filas = [
    ['Clase A', '3 520 / 3 520', '20 / 20', 'Continuo', 'n.a.'],
    ['Clase B', '3 520 / 352 000', '29 / 2 900', 'Cada 3 meses', '20 a 50'],
    ['ISO-7', '352 000 / 3 520 000', '2 900 / 29 000', 'Cada 6 meses', '20 a 50'],
    ['ISO-8', '3 520 000 / n.a.', '29 000 / n.a.', 'Cada 6 meses', '10 a 20'],
    ['ISO-9', '35 200 000 / n.a.', '293 000 / n.a.', 'Anual', 'n.a.'],
  ];
  it.each(filas)('%s conserva partículas, frecuencia y cambios de aire', (clase, particulas05, particulas5, monitoreo, aire) => {
    expect(APENDICE_A.find(c => c.clase === clase)).toMatchObject({ particulas05, particulas5, monitoreo, aire, temperatura: '18–25 °C' });
  });
  it.each([
    ['Clase A', '< 1/placa sed.; < 1/m³; < 1/placa contacto; < 1/guante'],
    ['Clase B', '< 5/placa sed.; < 10/m³; < 5/placa contacto; < 5/guante'],
    ['ISO-7', '< 50/placa sed.; < 100/m³; < 25/placa contacto'],
    ['ISO-8', '< 100/placa sed.; < 200/m³; < 50/placa contacto'],
    ['ISO-9', 'n.a.'],
  ])('%s conserva los límites microbiológicos estrictos', (clase, ufc) => {
    expect(APENDICE_A.find(c => c.clase === clase)?.ufc).toBe(ufc);
  });
  it.each([
    ['Clase A', '> 15 Pa con respecto a cuartos adyacentes, en cascada'],
    ['Clase B', '> 15 Pa con respecto a áreas no asépticas, en cascada'],
    ['ISO-7', '> 10 Pa'],
    ['ISO-8', '> 5 Pa; negativa donde se generan polvos con respecto a adyacentes y positiva donde no'],
    ['ISO-9', 'Positiva con respecto a áreas no clasificadas'],
  ])('%s conserva el requisito de presión', (clase, presion) => {
    expect(APENDICE_A.find(c => c.clase === clase)?.presion).toBe(presion);
  });
  it.each(['Clase A','Clase B','ISO-7','ISO-8'])('%s requiere HR 30–65 %%', clase => {
    expect(APENDICE_A.find(c => c.clase === clase)?.hr).toBe('30–65 % HR');
  });
  it('ISO-9 no establece HR', () => expect(APENDICE_A.find(c => c.clase === 'ISO-9')?.hr).toBe('n.a.'));
  it.each(['Área limpia','Área gris'])('%s no establece valores salvo temperatura en limpia', clase => {
    expect(APENDICE_A.find(c => c.clase === clase)).toMatchObject({ particulas05: 'n.a.', particulas5: 'n.a.', monitoreo: 'n.a.', ufc: 'n.a.', presion: 'n.a.', aire: 'n.a.', hr: 'n.a.', temperatura: clase === 'Área limpia' ? '18–25 °C' : 'n.a.' });
  });
  it.each(['Clase A','Clase B','Área limpia','Área gris'])('permite %s en Áreas', clase => expect(ISO_CLASES).toContain(clase));
  it('ISO-5 recibe la sugerencia de Clase A sin validar el instrumento', () => {
    const n: NormaEspecificacion = { id:'qa', norma:REFERENCIA_APENDICE_A, apartado:'Apéndice A', clase_iso:'Clase A', variable:'presion', texto:'> 15 Pa', lie:15, lse:null, lie_estricto:true, lse_estricto:false, unidad:'Pa', sin_valor:false, nota:null, activo:true };
    expect(sugerir([n], 'ISO-5', 'presion')).toMatchObject({ lie:15, lie_estricto:true });
  });
  it('las citas previas de ambas normas se normalizan sin duplicarse', () => {
    for (const texto of ['NOM-241','NOM-241-SSA1-2025','NOM-059-SSA1-2015', REFERENCIA_APENDICE_A]) expect(citarNormasCompartidas(texto)).toBe(REFERENCIA_APENDICE_A);
  });
});