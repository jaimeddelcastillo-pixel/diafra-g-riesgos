import { construirTabla } from "@/lib/listado-maestro/parse";
const r = construirTabla([["1","2"]], "csv");
export const x = r.ok ? null : r.reason;
