/** Clasificación de registros contra los documentos existentes del Cerebro. */
import { normalizar } from "./parse";
import type { DocumentoExistente, RegistroClasificado, RegistroImport } from "./tipos";

export function clasificarRegistros(
  registros: RegistroImport[],
  existentes: DocumentoExistente[],
): RegistroClasificado[] {
  const porCodigo = new Map<string, DocumentoExistente[]>();
  const porTitulo = new Map<string, DocumentoExistente>();
  for (const d of existentes) {
    if (d.codigo) {
      const k = normalizar(d.codigo);
      porCodigo.set(k, [...(porCodigo.get(k) ?? []), d]);
    }
    porTitulo.set(normalizar(d.nombre), d);
  }

  const vistosCodigo = new Set<string>();
  const vistosTitulo = new Set<string>();

  return registros.map((r) => {
    const kCodigo = r.codigo ? normalizar(r.codigo) : "";
    const kTitulo = normalizar(r.nombre);

    if (kCodigo) {
      const matches = porCodigo.get(kCodigo);
      if (matches && matches.length > 0) {
        const igual = matches.find((m) => normalizar(m.revision ?? "") === normalizar(r.revision ?? ""));
        if (igual) {
          return { ...r, clasificacion: "posible_duplicado", documento_existente_id: igual.id, motivo: "Código y revisión coinciden con un documento existente." };
        }
        return { ...r, clasificacion: "posible_actualizacion", documento_existente_id: matches[0].id, motivo: "El código existe con otra revisión." };
      }
      if (vistosCodigo.has(kCodigo)) {
        return { ...r, clasificacion: "requiere_revision", motivo: "El código se repite dentro del archivo." };
      }
      vistosCodigo.add(kCodigo);
      return { ...r, clasificacion: "nuevo" };
    }

    const porNombre = porTitulo.get(kTitulo);
    if (porNombre) {
      return { ...r, clasificacion: "requiere_revision", documento_existente_id: porNombre.id, motivo: "Título coincide con un documento existente pero no hay código." };
    }
    if (vistosTitulo.has(kTitulo)) {
      return { ...r, clasificacion: "requiere_revision", motivo: "El título se repite dentro del archivo." };
    }
    vistosTitulo.add(kTitulo);
    return { ...r, clasificacion: "nuevo" };
  });
}

export function resumenClasificacion(regs: RegistroClasificado[]) {
  return {
    nuevos: regs.filter((r) => r.clasificacion === "nuevo").length,
    actualizaciones: regs.filter((r) => r.clasificacion === "posible_actualizacion").length,
    duplicados: regs.filter((r) => r.clasificacion === "posible_duplicado").length,
    revision: regs.filter((r) => r.clasificacion === "requiere_revision").length,
    total: regs.length,
  };
}
