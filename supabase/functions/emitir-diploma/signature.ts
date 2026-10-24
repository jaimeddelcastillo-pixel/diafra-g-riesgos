export interface FirmaDiploma { firma_png: string; instructor_nombre: string; instructor_cargo: string }
export function estamparFirmaDiploma(doc: { addImage: (data: string, format: string, x: number, y: number, width: number, height: number) => unknown }, firma: FirmaDiploma, cx: number, lineY: number) {
  if (!firma.firma_png.startsWith('data:image/png;base64,iVBOR')) throw new Error('La firma configurada no es un PNG válido');
  doc.addImage(firma.firma_png, 'PNG', cx - 26, lineY - 26.01 + 2, 52, 26.01);
}