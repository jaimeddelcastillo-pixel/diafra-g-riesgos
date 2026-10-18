/** atdiafra's 2800px / JPEG quality algorithm, with explicit decoding/canvas errors. */
export async function compressImage(file: File, maxDim = 2800, targetBytes = 4_000_000): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Selecciona una foto JPG, PNG o WEBP');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('No se pudo abrir la foto')); image.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('No se pudo preparar la foto');
    // White is the bitmap paper backing, not a UI theme color.
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let quality = .75;
    const blobAt = (q: number) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo comprimir la foto')), 'image/jpeg', q));
    let blob = await blobAt(quality);
    for (let i = 0; i < 6 && blob.size > targetBytes; i++) { quality = Math.max(.35, quality - .1); blob = await blobAt(quality); }
    if (blob.size > targetBytes) throw new Error('La foto comprimida es demasiado grande; recorta la bitácora');
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
  } finally { URL.revokeObjectURL(url); }
}