export function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatHora(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatFecha(isoStr: string): string {
  const d = new Date(isoStr);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** "hace 5 min", "hace 3 h", "hace 2 d" */
export function hace(isoStr: string): string {
  const ms = Date.now() - new Date(isoStr).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Fecha de hoy en formato yyyy-mm-dd (para inputs type="date") */
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Fecha de hoy en la zona de la operación (Colombia), yyyy-mm-dd. */
export function hoyLocalISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
}

/** 'YYYY-MM-DD' (fecha de bitácora) → 'DD/MM/YYYY' */
export function formatFechaDia(fechaISO: string): string {
  const [y, m, d] = fechaISO.split('-');
  if (!y || !m || !d) return fechaISO;
  return `${d}/${m}/${y}`;
}

/** Fecha de hace n días en formato yyyy-mm-dd */
export function haceNDiasISO(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function inicioDelDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function finDelDia(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
