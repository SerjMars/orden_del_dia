import { diasEntre } from '../../shared/model.ts';

const corta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const larga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const mesAnio = new Intl.DateTimeFormat('es-MX', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const conDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const aFecha = (iso: string) => new Date(`${iso}T00:00:00Z`);

/** "27 oct" (agrega el año si no es el actual). */
export function fechaCorta(iso: string | null | undefined, hoy?: string): string {
  if (!iso) return '—';
  const txt = corta.format(aFecha(iso)).replace('.', '');
  return hoy && iso.slice(0, 4) !== hoy.slice(0, 4) ? `${txt} ${iso.slice(2, 4)}` : txt;
}

export const fechaLarga = (iso: string | null | undefined) => (iso ? larga.format(aFecha(iso)) : '—');
export const fechaConDia = (iso: string) => {
  const s = conDia.format(aFecha(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const fechaMesAnio = (iso: string) => mesAnio.format(aFecha(iso)).replace('.', '');

export function dias(n: number): string {
  return n === 1 ? '1 día' : `${n} días`;
}

/** Texto relativo de una fecha compromiso respecto a hoy. */
export function relativo(fecha: string, hoy: string): string {
  const n = diasEntre(hoy, fecha);
  if (n === 0) return 'Vence hoy';
  if (n === 1) return 'Vence mañana';
  if (n > 1) return `Vence en ${dias(n)}`;
  return `Venció hace ${dias(-n)}`;
}

export function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('');
}
