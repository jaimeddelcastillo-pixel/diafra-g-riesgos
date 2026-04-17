// Logo TRACEA — SVG inline como data URL (para uso en componentes React)
export const TRACEA_LOGO_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="1" width="17" height="17" rx="3" fill="#042C53"/><rect x="22" y="1" width="17" height="17" rx="3" fill="#185FA5"/><rect x="1" y="22" width="17" height="17" rx="3" fill="#185FA5"/><rect x="22" y="22" width="17" height="17" rx="3" fill="#8587E8"/><path d="M18 18L22 22" stroke="#8587E8" stroke-width="2" stroke-dasharray="2.5 2" stroke-linecap="round"/><path d="M27 30.5L30.5 34L36 27" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)}`;

// Alias legacy para no romper imports existentes
export const DIAFRA_LOGO_B64 = TRACEA_LOGO_SVG;
