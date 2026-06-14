// Catálogo de motivos para cancelar un folio (sin tabla en BD).
// Si agregas un nuevo código aquí, agrégalo también en la función
// public.cancelar_folio() (CHECK del p_motivo_codigo).

export type MotivoCancelacionCodigo =
  | "error_creacion"
  | "proceso_duplicado"
  | "proceso_modificado"
  | "proceso_no_aplica"
  | "otro";

export interface MotivoCancelacion {
  codigo: MotivoCancelacionCodigo;
  label: string;
}

export const MOTIVOS_CANCELACION: MotivoCancelacion[] = [
  { codigo: "error_creacion", label: "Error en la creación del folio" },
  { codigo: "proceso_duplicado", label: "Proceso duplicado — existe otro folio para este proceso" },
  { codigo: "proceso_modificado", label: "Proceso modificado antes de ser analizado" },
  { codigo: "proceso_no_aplica", label: "Proceso ya no aplica a la organización" },
  { codigo: "otro", label: "Otro (especificar)" },
];

export function getMotivoLabel(codigo?: string | null): string {
  if (!codigo) return "—";
  const m = MOTIVOS_CANCELACION.find((x) => x.codigo === codigo);
  return m?.label ?? codigo;
}