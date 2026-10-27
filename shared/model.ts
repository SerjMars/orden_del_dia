// Tipos y reglas compartidas entre servidor y cliente.

export const ESTATUS = ['pendiente', 'en_proceso', 'en_espera', 'concluido', 'cancelado'] as const;
export type Estatus = (typeof ESTATUS)[number];

export const ESTATUS_LABEL: Record<Estatus, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En proceso',
  en_espera: 'En espera',
  concluido: 'Concluido',
  cancelado: 'Cancelado',
};

export const ESTATUS_ABIERTOS: Estatus[] = ['pendiente', 'en_proceso', 'en_espera'];

export const PRIORIDADES = ['alta', 'media', 'baja'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const PRIORIDAD_LABEL: Record<Prioridad, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };

export const SUCURSALES_INICIALES = ['Aguascalientes', 'Bajío', 'Caribe', 'Norte', 'Occidente', 'Sureste'];

export const ESTADOS_MX = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas', 'Chihuahua',
  'Ciudad de México', 'Coahuila', 'Colima', 'Durango', 'Estado de México', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'Michoacán', 'Morelos', 'Nayarit', 'Nuevo León', 'Oaxaca', 'Puebla',
  'Querétaro', 'Quintana Roo', 'San Luis Potosí', 'Sinaloa', 'Sonora', 'Tabasco', 'Tamaulipas',
  'Tlaxcala', 'Veracruz', 'Yucatán', 'Zacatecas',
];

export interface Sucursal {
  id: number;
  nombre: string;
  activa: boolean;
}

export interface Tarea {
  id: number;
  folio: string;
  fecha_creacion: string; // YYYY-MM-DD
  fecha_compromiso: string | null;
  fecha_conclusion: string | null;
  responsable: string;
  sucursal_id: number;
  sucursal: string;
  ciudad: string;
  estado: string;
  espacio: string;
  direccion: string;
  concepto: string;
  descripcion: string;
  observaciones: string;
  estatus: Estatus;
  prioridad: Prioridad;
  actualizado: string; // ISO datetime
  // Calculados
  atraso: number | null; // días de atraso; null si no aplica
  porcentaje: number; // del último avance que lo indique
  avances_count: number;
  ultimo_avance: Avance | null;
  compromisos_abiertos: number;
  proximo_compromiso: string | null;
}

export interface Avance {
  id: number;
  tarea_id: number;
  fecha: string;
  texto: string;
  autor: string;
  porcentaje: number | null;
  reunion_id: number | null;
  creado: string;
}

export interface Compromiso {
  id: number;
  tarea_id: number;
  descripcion: string;
  responsable: string;
  fecha_compromiso: string;
  cumplido: boolean;
  fecha_cumplido: string | null;
  reunion_id: number | null;
  creado: string;
}

export interface TareaDetalle extends Tarea {
  avances: Avance[];
  compromisos: Compromiso[];
}

export interface Reunion {
  id: number;
  fecha: string;
  titulo: string;
  lugar: string;
  asistentes: string;
  sucursales: number[]; // vacío = todas
  notas: string;
  cerrada: boolean;
  creado: string;
  puntos_total: number;
  puntos_revisados: number;
}

export interface PuntoMinuta {
  orden: number;
  revisado: boolean;
  nota: string;
  tarea: Tarea;
  avances: Avance[]; // registrados en esta reunión
  compromisos: Compromiso[]; // todos los abiertos + los creados en esta reunión
}

export interface ReunionDetalle extends Reunion {
  puntos: PuntoMinuta[];
}

export interface Catalogos {
  sucursales: Sucursal[];
  responsables: string[];
  ciudades: string[];
  hoy: string;
}

// ---------- Fechas ----------

export const ZONA_HORARIA = 'America/Mexico_City';

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria de la empresa. */
export function hoyISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA }).format(now);
}

/** Diferencia en días naturales b - a para fechas YYYY-MM-DD. */
export function diasEntre(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/**
 * Días de atraso: tiempo transcurrido después de la fecha compromiso hasta la
 * conclusión (o hasta hoy si sigue abierto). Null si no hay compromiso o está cancelado.
 */
export function calcularAtraso(
  t: Pick<Tarea, 'fecha_compromiso' | 'fecha_conclusion' | 'estatus'>,
  hoy: string,
): number | null {
  if (!t.fecha_compromiso || t.estatus === 'cancelado') return null;
  const fin = t.fecha_conclusion ?? hoy;
  return Math.max(0, diasEntre(t.fecha_compromiso, fin));
}

export function folio(id: number): string {
  return `P-${String(id).padStart(4, '0')}`;
}
