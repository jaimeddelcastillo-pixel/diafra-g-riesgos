/** Presentation only: never used for company, role or support authorization. */
export const sidebarPreferenceKey = (userId: string) => `tracea:sidebar:${userId}`;

export function readSidebarPreference(userId?: string): boolean {
  if (!userId) return true;
  try { return localStorage.getItem(sidebarPreferenceKey(userId)) !== "collapsed"; }
  catch { return true; }
}

export function saveSidebarPreference(userId: string, open: boolean): void {
  try { localStorage.setItem(sidebarPreferenceKey(userId), open ? "expanded" : "collapsed"); }
  catch { /* Storage may be unavailable; navigation remains usable. */ }
}