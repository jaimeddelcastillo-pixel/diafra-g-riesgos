/** C4a: diff línea por línea entre dos textos (LCS simple). */

export type LineaDiff = { tipo: "igual" | "agregada" | "eliminada"; texto: string };

export function diffLineas(a: string, b: string): LineaDiff[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length, m = B.length;
  // LCS por programación dinámica (textos de skills ~40k chars máx. es viable
  // con matriz Uint16; para tamaños grandes se limita con ventana simple).
  if (n * m > 4_000_000) {
    // Fallback sin matriz: diff por línea igual exacta en orden.
    const out: LineaDiff[] = [];
    const setB = new Set(B);
    for (const l of A) out.push({ tipo: setB.has(l) ? "igual" : "eliminada", texto: l });
    const setA = new Set(A);
    for (const l of B) if (!setA.has(l)) out.push({ tipo: "agregada", texto: l });
    return out;
  }
  const dp = new Uint16Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i * (m + 1) + j] = A[i] === B[j]
        ? dp[(i + 1) * (m + 1) + j + 1] + 1
        : Math.max(dp[(i + 1) * (m + 1) + j], dp[i * (m + 1) + j + 1]);
    }
  }
  const out: LineaDiff[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ tipo: "igual", texto: A[i] }); i++; j++; }
    else if (dp[(i + 1) * (m + 1) + j] >= dp[i * (m + 1) + j + 1]) { out.push({ tipo: "eliminada", texto: A[i] }); i++; }
    else { out.push({ tipo: "agregada", texto: B[j] }); j++; }
  }
  while (i < n) { out.push({ tipo: "eliminada", texto: A[i] }); i++; }
  while (j < m) { out.push({ tipo: "agregada", texto: B[j] }); j++; }
  return out;
}
