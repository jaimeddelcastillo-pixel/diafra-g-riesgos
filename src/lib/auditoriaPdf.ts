import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fetchOrgLogoDataUrl } from "@/lib/orgLogo";
import { dibujarMarcaAguaCentrada } from "@/lib/pdfMarcaAgua";

/** C6c.2: PDFs del portal del auditor (ficha de conocimiento y carátula), formato BPD. */

type OrgPdf = { nombre?: string | null; razon_social?: string | null; rfc?: string | null; logo_url?: string | null;
  codigo_formato?: string | null; version_formato?: string | null };
type Persona = { nombre?: string | null; cargo?: string | null; fecha?: string | null; via?: string | null } | null | undefined;

const limpio = (s: unknown) => String(s ?? "")
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2010-\u2015\u2212]/g, "-")
  .replace(/\u2026/g, "...").replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "");
const fechaHora = (d?: string | null) => d
  ? new Date(d).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" }) : "-";
const fecha = (d?: string | null) => d
  ? new Date(d).toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium" }) : "-";
const persona = (p: Persona) => p?.nombre
  ? `${p.nombre}${p.cargo ? ` (${p.cargo})` : ""}` : "No registrado";

const M = 12, HEADER_H = 20, TOP = M + HEADER_H + 6, BOTTOM = 16;

async function nuevoDoc(org: OrgPdf, titulo: string, pie: string, marca: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const logo = await fetchOrgLogoDataUrl(org?.logo_url);
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const empresa = limpio(org?.razon_social || org?.nombre || "Empresa");
  const codigo = org?.codigo_formato ? limpio(org.codigo_formato) : "N/A";
  const version = org?.version_formato ? limpio(org.version_formato) : "N/A";

  const terminar = (soloBlob: boolean, nombre: string) => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      const logoW = 40, derW = 44, cenW = W - 2 * M - logoW - derW;
      doc.setDrawColor(0); doc.setLineWidth(0.3);
      doc.rect(M, M, logoW, HEADER_H);
      if (logo) {
        const props = doc.getImageProperties(logo.dataUrl);
        const maxW = logoW - 4, maxH = HEADER_H - 4;
        const r = Math.min(maxW / props.width, maxH / props.height);
        const w = props.width * r, h = props.height * r;
        doc.addImage(logo.dataUrl, logo.format, M + (logoW - w) / 2, M + (HEADER_H - h) / 2, w, h);
      } else {
        doc.setFont("helvetica", "bold"); doc.setFontSize(9);
        doc.text(doc.splitTextToSize(empresa, logoW - 4).slice(0, 2), M + logoW / 2, M + HEADER_H / 2, { align: "center" });
      }
      const cx = M + logoW;
      doc.rect(cx, M, cenW, HEADER_H);
      doc.setFont("helvetica", "bold"); doc.setFontSize(9.5);
      doc.text(doc.splitTextToSize(empresa.toUpperCase(), cenW - 4).slice(0, 2), cx + cenW / 2, M + 7, { align: "center" });
      doc.setFontSize(10.5);
      doc.text(titulo, cx + cenW / 2, M + 15.5, { align: "center" });
      const rx = cx + cenW;
      doc.rect(rx, M, derW, HEADER_H);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      doc.text(`Código: ${codigo}`, rx + derW / 2, M + 6, { align: "center" });
      doc.text(`Versión: ${version}`, rx + derW / 2, M + 11, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.text(`Página ${i} de ${total}`, rx + derW / 2, M + 16, { align: "center" });
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(80);
      doc.text(doc.splitTextToSize(pie, W - 2 * M), W / 2, H - 9, { align: "center" });
      doc.setTextColor(0);
      dibujarMarcaAguaCentrada(doc, marca);
    }
    if (soloBlob) return doc.output("blob") as Blob;
    doc.save(nombre);
    return null;
  };
  return { doc, W, terminar };
}

function seccion(doc: jsPDF, y: number, texto: string) {
  if (y > doc.internal.pageSize.getHeight() - BOTTOM - 20) { doc.addPage(); y = TOP; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(4, 44, 83);
  doc.text(texto, M, y); doc.setTextColor(0);
  return y + 2;
}
const tabla = (doc: jsPDF, startY: number, body: any[][], head?: string[], extra: any = {}) => {
  autoTable(doc, {
    startY, head: head ? [head] : undefined, body: body.map((r) => r.map(limpio)), theme: "grid",
    margin: { left: M, right: M, top: TOP, bottom: BOTTOM },
    styles: { fontSize: 8.5, cellPadding: 1.8, valign: "top", overflow: "linebreak" },
    headStyles: { fillColor: [4, 44, 83], textColor: 255, fontStyle: "bold" },
    ...extra,
  });
  return (doc as any).lastAutoTable.finalY + 6;
};

export interface MarcaInfo { expediente: string; auditor: string; fecha: string }
const textoMarca = (m: MarcaInfo) => limpio(`COPIA NO CONTROLADA - ${m.expediente} - ${m.auditor} - ${fechaHora(m.fecha)}`);
const textoPie = (m: MarcaInfo) => limpio(`Generado por TRACEA el ${fechaHora(m.fecha)} para ${m.expediente} - COPIA NO CONTROLADA`);

export async function generarFichaConocimientoPDF(d: any, m: MarcaInfo, soloBlob: boolean) {
  const { doc, terminar } = await nuevoDoc(d.org ?? {}, "Ficha de conocimiento institucional", textoPie(m), textoMarca(m));
  let y = seccion(doc, TOP, "Conocimiento");
  y = tabla(doc, y, [
    ["Enunciado", d.contenido], ["Tipo", d.tipo || "-"], ["Área", d.area || "-"], ["Proceso", d.proceso || "-"],
  ], undefined, { columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" } } });

  y = seccion(doc, y, "Fuente");
  const fuentes = (d.fuentes ?? []) as any[];
  y = fuentes.length === 0
    ? tabla(doc, y, [["Sin fuente registrada"]])
    : tabla(doc, y, fuentes.map((s) => [
        s.documento_nombre || s.nombre_fuente || s.tipo_fuente || "-",
        s.documento_codigo || "-", s.documento_revision || "-",
        [s.pagina && `pág. ${s.pagina}`, s.parrafo && `párr. ${s.parrafo}`, s.seccion].filter(Boolean).join(" · ") || "-",
        s.cita_textual ? `"${s.cita_textual}"` : "-",
      ]), ["Documento", "Código", "Revisión", "Página / párrafo", "Cita"],
      { columnStyles: { 1: { cellWidth: 24 }, 2: { cellWidth: 18 }, 3: { cellWidth: 28 }, 4: { cellWidth: 70 } } });

  y = seccion(doc, y, "Propuso / Validó");
  y = tabla(doc, y, [
    ["Propuso", d.propuso?.nombre || "No registrado", d.propuso?.cargo || "-", fechaHora(d.propuso?.fecha)],
    ["Validó", d.validado?.nombre || d.validado_por || "-", d.validado?.cargo || "-", fechaHora(d.validado?.fecha ?? d.validado_en)],
  ], ["", "Nombre", "Cargo", "Fecha y hora"], { columnStyles: { 0: { cellWidth: 22, fontStyle: "bold" } } });

  y = seccion(doc, y, `Estado vigente: ${limpio(d.estado)}`);
  const hist = (d.historial ?? []) as any[];
  tabla(doc, y + 2, hist.length ? hist.map((h) => [fechaHora(h.fecha), h.estado || "-", h.por || "Sistema"]) : [["-", "Sin historial registrado", "-"]],
    ["Fecha y hora", "Estado", "Por"]);
  return terminar(soloBlob, "ficha_conocimiento_copia_auditoria.pdf");
}

export async function generarCaratulaPDF(c: any, soloBlob: boolean) {
  const m: MarcaInfo = { expediente: c.expediente, auditor: c.auditor, fecha: c.fecha };
  const { doc, terminar } = await nuevoDoc(c.org ?? {}, "Carátula del expediente de auditoría", textoPie(m), textoMarca(m));
  let y = seccion(doc, TOP, "Empresa");
  y = tabla(doc, y, [
    ["Razón social", c.org?.razon_social || c.org?.nombre || "-"], ["RFC", c.org?.rfc || "-"],
  ], undefined, { columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } } });
  y = seccion(doc, y, "Expediente");
  y = tabla(doc, y, [
    ["Nombre", c.expediente], ["Auditor", c.auditor],
    ["Organización del auditor", c.auditor_organizacion || "-"],
    ["Vigencia", `${fecha(c.inicia_en)} al ${fecha(c.expira_en)}`],
    ["Descargas", c.permite_descarga ? "Permitidas, con marca de agua" : "No permitidas (solo vista)"],
    ["Preparó", `${persona(c.preparo)} · ${fechaHora(c.preparo?.fecha)}`],
    ["Activó", `${persona(c.activo)} · ${fechaHora(c.activo?.fecha)}`],
  ], undefined, { columnStyles: { 0: { cellWidth: 40, fontStyle: "bold" } } });
  y = seccion(doc, y, "Índice de ítems");
  const tipos: Record<string, string> = { folio: "Folio", documento: "Documento", conocimiento: "Conocimiento" };
  tabla(doc, y, (c.items ?? []).map((i: any, n: number) => [
    String(n + 1), tipos[i.tipo] ?? i.tipo, i.codigo || "-", i.titulo || "-", i.revision || "-", i.estado || "-",
    i.tipo === "documento" ? (i.sha256 || "-") : "",
  ]), ["#", "Tipo", "Código", "Título", "Rev./versión", "Estado", "SHA-256"],
    { styles: { fontSize: 7.5, cellPadding: 1.5, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: 20 }, 2: { cellWidth: 22 }, 4: { cellWidth: 16 }, 5: { cellWidth: 20 },
        6: { cellWidth: 40, fontSize: 6, font: "courier" } } });
  return terminar(soloBlob, "caratula_expediente_auditoria.pdf");
}
