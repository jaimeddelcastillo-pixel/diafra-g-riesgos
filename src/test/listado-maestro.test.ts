import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  construirTabla, detectarEncabezado, detectarFormato, parseCsv,
  parseDesdeTexto, parseTextoTabular, parseXlsxBuffer, validarTamano,
} from "@/lib/listado-maestro/parse";
import { aplicarMapeo, areasDetectadas, mapeoValido, procesosCandidatos, proponerMapeo } from "@/lib/listado-maestro/mapeo";
import { clasificarRegistros } from "@/lib/listado-maestro/duplicados";
import { LIMITES } from "@/lib/listado-maestro/tipos";

const HEAD = "Código,Nombre del documento,Revisión,Área";
const CSV = `${HEAD}\nPNO-001,Limpieza de equipos,02,Producción\nPNO-002,Control de cambios,01,Calidad\n`;

describe("parse", () => {
  it("detecta formato por extensión", () => {
    expect(detectarFormato("a.xlsx")).toBe("xlsx");
    expect(detectarFormato("a.CSV")).toBe("csv");
    expect(detectarFormato("a.exe")).toBeNull();
  });

  it("CSV con comas", () => {
    const r = parseDesdeTexto(CSV, "csv");
    expect(r.ok && r.tabla.filas.length).toBe(2);
  });

  it("CSV con punto y coma", () => {
    const r = parseDesdeTexto(CSV.replace(/,/g, ";"), "csv");
    expect(r.ok && r.tabla.encabezados.length).toBe(4);
  });

  it("respeta comillas en CSV", () => {
    const g = parseCsv('a,b\n"uno, dos",tres');
    expect(g[1][0]).toBe("uno, dos");
  });

  it("encabezado en primera fila", () => {
    const r = parseDesdeTexto(CSV, "csv");
    expect(r.ok && r.tabla.filaEncabezado).toBe(0);
  });

  it("encabezado después de membrete", () => {
    const r = parseDesdeTexto(`ACME S.A. de C.V.\nListado Maestro\n${CSV}`, "csv");
    expect(r.ok && r.tabla.encabezados[0]).toBe("Código");
  });

  it("ignora filas vacías y celdas vacías", () => {
    const r = parseDesdeTexto(`${HEAD}\n\nPNO-003,Muestreo,,Calidad\n`, "csv");
    expect(r.ok && r.tabla.filas.length).toBe(1);
    expect(r.ok && r.tabla.filas[0][2]).toBe("");
  });

  it("UTF-8 y acentos", () => {
    const r = parseDesdeTexto(`${HEAD}\nPNO-9,Calibración de básculas,01,Metrología\n`, "csv");
    expect(r.ok && r.tabla.filas[0][1]).toBe("Calibración de básculas");
  });

  it("tabla markdown", () => {
    const md = "| Código | Nombre | Revisión |\n|---|---|---|\n| P-1 | Limpieza | 01 |";
    const g = parseTextoTabular(md);
    expect(g.length).toBe(2);
    const r = construirTabla(g, "md");
    expect(r.ok && r.tabla.filas[0][1]).toBe("Limpieza");
  });

  it("XLSX válido", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Código", "Nombre", "Revisión"],
      ["PNO-1", "Fabricación", "03"],
    ]), "Hoja1");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    const r = parseXlsxBuffer(buf);
    expect(r.ok && r.tabla.filas[0][1]).toBe("Fabricación");
  });

  it("sin encabezados detectables", () => {
    const r = construirTabla([["1", "2"], ["3", "4"]], "csv");
    expect((r.ok ? null : r.reason)).toBe("no_headers");
  });

  it("2000 filas exactas se aceptan y 2001 se rechazan", () => {
    const fila = (i: number) => `PNO-${i},Doc ${i},01,Calidad`;
    const ok = parseDesdeTexto([HEAD, ...Array.from({ length: LIMITES.MAX_FILAS }, (_, i) => fila(i))].join("\n"), "csv");
    expect(ok.ok).toBe(true);
    const ko = parseDesdeTexto([HEAD, ...Array.from({ length: LIMITES.MAX_FILAS + 1 }, (_, i) => fila(i))].join("\n"), "csv");
    expect((ko.ok ? null : ko.reason)).toBe("too_many_rows");
  });

  it("más de 40 columnas se rechaza", () => {
    const cols = Array.from({ length: 41 }, (_, i) => `Columna${i}`);
    const r = construirTabla([cols, cols.map(() => "x")], "csv");
    expect((r.ok ? null : r.reason)).toBe("too_many_cols");
  });

  it("más de 10MB se rechaza", () => {
    expect(validarTamano(LIMITES.MAX_BYTES + 1)?.ok).toBe(false);
    expect(validarTamano(1024)).toBeNull();
  });

  it("detectarEncabezado descarta filas con celdas repetidas", () => {
    expect(detectarEncabezado([["a", "a", "a"], ["Código", "Nombre", "Revisión"]])).toBe(1);
  });
});

describe("mapeo", () => {
  const tabla = (parseDesdeTexto(CSV, "csv") as any).tabla;

  it("propone mapeo por sinónimos", () => {
    const m = proponerMapeo(tabla);
    expect(m[0].campo).toBe("codigo");
    expect(m[1].campo).toBe("nombre");
    expect(m[2].campo).toBe("revision");
    expect(m[3].campo).toBe("area");
    expect(mapeoValido(m)).toBe(true);
  });

  it("columnas desconocidas quedan sin campo", () => {
    const t = (parseDesdeTexto("Código,Nombre,Zzz Rara\nP-1,Doc,valor", "csv") as any).tabla;
    const m = proponerMapeo(t);
    expect(m[2].campo).toBeNull();
  });

  it("aplica mapeo y detecta áreas y procesos candidatos", () => {
    const m = proponerMapeo(tabla);
    const regs = aplicarMapeo(tabla, m);
    expect(regs.length).toBe(2);
    expect(areasDetectadas(regs)).toEqual(["Calidad", "Producción"]);
    expect(procesosCandidatos(regs).map((p) => p.nombre)).toContain("Limpieza");
  });
});

describe("duplicados", () => {
  const base = [{ fila: 2, codigo: "PNO-001", nombre: "Limpieza", revision: "02" }];

  it("código + revisión igual → posible duplicado", () => {
    const r = clasificarRegistros(base, [{ id: "1", nombre: "Limpieza", codigo: "PNO-001", revision: "02" }]);
    expect(r[0].clasificacion).toBe("posible_duplicado");
  });

  it("código con revisión distinta → posible actualización", () => {
    const r = clasificarRegistros(base, [{ id: "1", nombre: "Limpieza", codigo: "PNO-001", revision: "01" }]);
    expect(r[0].clasificacion).toBe("posible_actualizacion");
  });

  it("sin código con título coincidente → requiere revisión", () => {
    const r = clasificarRegistros([{ fila: 2, nombre: "Limpieza de Equipos" }], [{ id: "1", nombre: "limpieza de equipos" }]);
    expect(r[0].clasificacion).toBe("requiere_revision");
  });

  it("sin coincidencia → nuevo", () => {
    const r = clasificarRegistros(base, []);
    expect(r[0].clasificacion).toBe("nuevo");
  });

  it("código repetido dentro del archivo → requiere revisión", () => {
    const r = clasificarRegistros([...base, { ...base[0], fila: 3 }], []);
    expect(r[1].clasificacion).toBe("requiere_revision");
  });
});
