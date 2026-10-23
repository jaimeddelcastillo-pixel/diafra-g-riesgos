/** Stored server semaphore is authoritative; state never changes its color. */
export function claseSemaforo(semaforo: string) {
  switch (semaforo) {
    case 'verde': return 'bg-success/15 text-success border-success/40';
    case 'amarillo': return 'bg-warning/15 text-warning border-warning/40';
    case 'rojo': return 'bg-destructive/15 text-destructive border-destructive/40';
    case 'sin base': return 'bg-muted text-muted-foreground border-border';
    default: return 'border-border';
  }
}