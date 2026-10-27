// Acceso a datos. Todas las lecturas devuelven objetos con la forma de shared/model.ts.
import type { DB } from './db.ts';
import {
  calcularAtraso, folio, hoyISO, ESTATUS_ABIERTOS,
  type Avance, type Catalogos, type Compromiso, type Estatus, type PuntoMinuta, type Reunion,
  type ReunionDetalle, type Sucursal, type Tarea, type TareaDetalle,
} from '../shared/model.ts';

type Row = Record<string, unknown>;

const SQL_TAREA = `
  SELECT t.*, s.nombre AS sucursal,
    (SELECT COUNT(*) FROM avances a WHERE a.tarea_id = t.id) AS avances_count,
    (SELECT a.porcentaje FROM avances a WHERE a.tarea_id = t.id AND a.porcentaje IS NOT NULL
       ORDER BY a.fecha DESC, a.id DESC LIMIT 1) AS porcentaje,
    (SELECT a.id FROM avances a WHERE a.tarea_id = t.id ORDER BY a.fecha DESC, a.id DESC LIMIT 1) AS ultimo_avance_id,
    (SELECT COUNT(*) FROM compromisos c WHERE c.tarea_id = t.id AND c.cumplido = 0) AS compromisos_abiertos,
    (SELECT MIN(c.fecha_compromiso) FROM compromisos c WHERE c.tarea_id = t.id AND c.cumplido = 0) AS proximo_compromiso
  FROM tareas t JOIN sucursales s ON s.id = t.sucursal_id`;

export function crearRepo(db: DB) {
  const avancePorId = db.prepare('SELECT * FROM avances WHERE id = ?');

  function mapAvance(r: Row): Avance {
    return r as unknown as Avance;
  }
  function mapCompromiso(r: Row): Compromiso {
    return { ...(r as unknown as Compromiso), cumplido: !!r.cumplido };
  }
  function mapTarea(r: Row, hoy = hoyISO()): Tarea {
    const { ultimo_avance_id, ...t } = r as Row & { ultimo_avance_id: number | null };
    const tarea = {
      ...(t as unknown as Tarea),
      folio: folio(t.id as number),
      porcentaje: (t.porcentaje as number | null) ?? (t.estatus === 'concluido' ? 100 : 0),
      ultimo_avance: ultimo_avance_id ? mapAvance(avancePorId.get(ultimo_avance_id) as Row) : null,
    };
    tarea.atraso = calcularAtraso(tarea, hoy);
    return tarea;
  }
  function mapReunion(r: Row): Reunion {
    return {
      ...(r as unknown as Reunion),
      sucursales: JSON.parse(r.sucursales as string),
      cerrada: !!r.cerrada,
    };
  }

  const repo = {
    catalogos(): Catalogos {
      const sucursales = (db.prepare('SELECT * FROM sucursales ORDER BY nombre').all() as Row[])
        .map((s) => ({ ...(s as unknown as Sucursal), activa: !!s.activa }));
      const responsables = (db.prepare(`
        SELECT responsable AS n FROM tareas UNION SELECT responsable FROM compromisos
        UNION SELECT autor FROM avances WHERE autor <> '' ORDER BY 1`).all() as { n: string }[]).map((r) => r.n);
      const ciudades = (db.prepare(`SELECT DISTINCT ciudad AS n FROM tareas WHERE ciudad <> '' ORDER BY 1`)
        .all() as { n: string }[]).map((r) => r.n);
      return { sucursales, responsables, ciudades, hoy: hoyISO() };
    },

    crearSucursal(nombre: string): Sucursal {
      const info = db.prepare('INSERT INTO sucursales (nombre) VALUES (?)').run(nombre.trim());
      return { id: Number(info.lastInsertRowid), nombre: nombre.trim(), activa: true };
    },

    actualizarSucursal(id: number, cambios: { nombre?: string; activa?: boolean }) {
      if (cambios.nombre !== undefined) db.prepare('UPDATE sucursales SET nombre = ? WHERE id = ?').run(cambios.nombre.trim(), id);
      if (cambios.activa !== undefined) db.prepare('UPDATE sucursales SET activa = ? WHERE id = ?').run(cambios.activa ? 1 : 0, id);
    },

    listarTareas(): Tarea[] {
      const hoy = hoyISO();
      return (db.prepare(`${SQL_TAREA} ORDER BY t.id DESC`).all() as Row[]).map((r) => mapTarea(r, hoy));
    },

    obtenerTarea(id: number): Tarea | undefined {
      const r = db.prepare(`${SQL_TAREA} WHERE t.id = ?`).get(id) as Row | undefined;
      return r && mapTarea(r);
    },

    detalleTarea(id: number): TareaDetalle | undefined {
      const t = repo.obtenerTarea(id);
      if (!t) return undefined;
      const avances = (db.prepare('SELECT * FROM avances WHERE tarea_id = ? ORDER BY fecha DESC, id DESC').all(id) as Row[]).map(mapAvance);
      const compromisos = (db.prepare('SELECT * FROM compromisos WHERE tarea_id = ? ORDER BY cumplido, fecha_compromiso').all(id) as Row[]).map(mapCompromiso);
      return { ...t, avances, compromisos };
    },

    crearTarea(d: TareaInput): Tarea {
      const hoy = hoyISO();
      const datos = normalizarEstatus({ ...d, fecha_creacion: d.fecha_creacion ?? hoy }, hoy);
      const info = db.prepare(`
        INSERT INTO tareas (fecha_creacion, fecha_compromiso, fecha_conclusion, responsable, sucursal_id, ciudad,
          estado, espacio, direccion, concepto, descripcion, observaciones, estatus, prioridad)
        VALUES (@fecha_creacion, @fecha_compromiso, @fecha_conclusion, @responsable, @sucursal_id, @ciudad,
          @estado, @espacio, @direccion, @concepto, @descripcion, @observaciones, @estatus, @prioridad)`).run({
        fecha_compromiso: null, fecha_conclusion: null, ciudad: '', estado: '', espacio: '', direccion: '',
        descripcion: '', observaciones: '', estatus: 'pendiente', prioridad: 'media', ...datos,
      });
      return repo.obtenerTarea(Number(info.lastInsertRowid))!;
    },

    actualizarTarea(id: number, cambios: Partial<TareaInput>): Tarea | undefined {
      const actual = db.prepare('SELECT * FROM tareas WHERE id = ?').get(id) as Row | undefined;
      if (!actual) return undefined;
      const datos = normalizarEstatus({ ...(actual as object), ...cambios } as TareaInput, hoyISO(), cambios);
      const campos = Object.keys(datos).filter((k) => CAMPOS_TAREA.has(k));
      if (campos.length) {
        db.prepare(`UPDATE tareas SET ${campos.map((c) => `${c} = @${c}`).join(', ')},
          actualizado = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = @id`)
          .run({ ...Object.fromEntries(campos.map((c) => [c, (datos as unknown as Row)[c]])), id });
      }
      return repo.obtenerTarea(id);
    },

    eliminarTarea(id: number): boolean {
      return db.prepare('DELETE FROM tareas WHERE id = ?').run(id).changes > 0;
    },

    crearAvance(tareaId: number, d: { fecha?: string; texto: string; autor?: string; porcentaje?: number | null; reunion_id?: number | null }): Avance {
      const info = db.prepare(`INSERT INTO avances (tarea_id, fecha, texto, autor, porcentaje, reunion_id)
        VALUES (?, ?, ?, ?, ?, ?)`).run(tareaId, d.fecha ?? hoyISO(), d.texto, d.autor ?? '', d.porcentaje ?? null, d.reunion_id ?? null);
      tocar(tareaId);
      return mapAvance(avancePorId.get(info.lastInsertRowid) as Row);
    },

    eliminarAvance(id: number): boolean {
      return db.prepare('DELETE FROM avances WHERE id = ?').run(id).changes > 0;
    },

    crearCompromiso(tareaId: number, d: { descripcion: string; responsable: string; fecha_compromiso: string; reunion_id?: number | null }): Compromiso {
      const info = db.prepare(`INSERT INTO compromisos (tarea_id, descripcion, responsable, fecha_compromiso, reunion_id)
        VALUES (?, ?, ?, ?, ?)`).run(tareaId, d.descripcion, d.responsable, d.fecha_compromiso, d.reunion_id ?? null);
      tocar(tareaId);
      return mapCompromiso(db.prepare('SELECT * FROM compromisos WHERE id = ?').get(info.lastInsertRowid) as Row);
    },

    actualizarCompromiso(id: number, d: { cumplido?: boolean; descripcion?: string; responsable?: string; fecha_compromiso?: string }): Compromiso | undefined {
      const actual = db.prepare('SELECT * FROM compromisos WHERE id = ?').get(id) as Row | undefined;
      if (!actual) return undefined;
      const cumplido = d.cumplido ?? !!actual.cumplido;
      db.prepare(`UPDATE compromisos SET descripcion = ?, responsable = ?, fecha_compromiso = ?, cumplido = ?,
        fecha_cumplido = ? WHERE id = ?`).run(
        d.descripcion ?? actual.descripcion, d.responsable ?? actual.responsable,
        d.fecha_compromiso ?? actual.fecha_compromiso, cumplido ? 1 : 0,
        cumplido ? (actual.fecha_cumplido ?? hoyISO()) : null, id);
      tocar(actual.tarea_id as number);
      return mapCompromiso(db.prepare('SELECT * FROM compromisos WHERE id = ?').get(id) as Row);
    },

    eliminarCompromiso(id: number): boolean {
      return db.prepare('DELETE FROM compromisos WHERE id = ?').run(id).changes > 0;
    },

    // ---------- Reuniones / minutas ----------

    listarReuniones(): Reunion[] {
      return (db.prepare(`SELECT r.*,
          (SELECT COUNT(*) FROM reunion_puntos p WHERE p.reunion_id = r.id) AS puntos_total,
          (SELECT COUNT(*) FROM reunion_puntos p WHERE p.reunion_id = r.id AND p.revisado = 1) AS puntos_revisados
        FROM reuniones r ORDER BY r.fecha DESC, r.id DESC`).all() as Row[]).map(mapReunion);
    },

    crearReunion(d: ReunionInput): ReunionDetalle {
      return db.transaction(() => {
        const info = db.prepare(`INSERT INTO reuniones (fecha, titulo, lugar, asistentes, sucursales, notas)
          VALUES (?, ?, ?, ?, ?, ?)`).run(d.fecha, d.titulo, d.lugar ?? '', d.asistentes ?? '', JSON.stringify(d.sucursales ?? []), d.notas ?? '');
        const id = Number(info.lastInsertRowid);
        // Orden del día: pendientes abiertos del alcance, por sucursal y luego los más atrasados primero.
        const abiertas = repo.listarTareas()
          .filter((t) => ESTATUS_ABIERTOS.includes(t.estatus))
          .filter((t) => !d.sucursales?.length || d.sucursales.includes(t.sucursal_id))
          .sort((a, b) => a.sucursal.localeCompare(b.sucursal, 'es')
            || (b.atraso ?? -1) - (a.atraso ?? -1)
            || (a.fecha_compromiso ?? '9999').localeCompare(b.fecha_compromiso ?? '9999'));
        const ins = db.prepare('INSERT INTO reunion_puntos (reunion_id, tarea_id, orden) VALUES (?, ?, ?)');
        abiertas.forEach((t, i) => ins.run(id, t.id, i + 1));
        return repo.detalleReunion(id)!;
      })();
    },

    detalleReunion(id: number): ReunionDetalle | undefined {
      const r = (repo.listarReuniones().find((x) => x.id === id));
      if (!r) return undefined;
      const puntos = db.prepare('SELECT * FROM reunion_puntos WHERE reunion_id = ? ORDER BY orden').all(id) as Row[];
      const hoy = hoyISO();
      const avancesQ = db.prepare('SELECT * FROM avances WHERE tarea_id = ? AND reunion_id = ? ORDER BY id');
      const compromisosQ = db.prepare(`SELECT * FROM compromisos WHERE tarea_id = ? AND (cumplido = 0 OR reunion_id = ?)
        ORDER BY cumplido, fecha_compromiso`);
      const tareaQ = db.prepare(`${SQL_TAREA} WHERE t.id = ?`);
      const lista: PuntoMinuta[] = puntos.map((p) => ({
        orden: p.orden as number,
        revisado: !!p.revisado,
        nota: p.nota as string,
        tarea: mapTarea(tareaQ.get(p.tarea_id) as Row, hoy),
        avances: (avancesQ.all(p.tarea_id, id) as Row[]).map(mapAvance),
        compromisos: (compromisosQ.all(p.tarea_id, id) as Row[]).map(mapCompromiso),
      }));
      return { ...r, puntos: lista };
    },

    actualizarReunion(id: number, d: Partial<ReunionInput> & { cerrada?: boolean }) {
      const actual = db.prepare('SELECT * FROM reuniones WHERE id = ?').get(id) as Row | undefined;
      if (!actual) return undefined;
      db.prepare(`UPDATE reuniones SET fecha = ?, titulo = ?, lugar = ?, asistentes = ?, notas = ?, cerrada = ? WHERE id = ?`).run(
        d.fecha ?? actual.fecha, d.titulo ?? actual.titulo, d.lugar ?? actual.lugar, d.asistentes ?? actual.asistentes,
        d.notas ?? actual.notas, (d.cerrada ?? !!actual.cerrada) ? 1 : 0, id);
      return repo.detalleReunion(id);
    },

    eliminarReunion(id: number): boolean {
      return db.prepare('DELETE FROM reuniones WHERE id = ?').run(id).changes > 0;
    },

    agregarPunto(reunionId: number, tareaId: number) {
      const max = db.prepare('SELECT COALESCE(MAX(orden), 0) AS m FROM reunion_puntos WHERE reunion_id = ?').get(reunionId) as { m: number };
      db.prepare('INSERT OR IGNORE INTO reunion_puntos (reunion_id, tarea_id, orden) VALUES (?, ?, ?)').run(reunionId, tareaId, max.m + 1);
    },

    actualizarPunto(reunionId: number, tareaId: number, d: { revisado?: boolean; nota?: string }) {
      const p = db.prepare('SELECT * FROM reunion_puntos WHERE reunion_id = ? AND tarea_id = ?').get(reunionId, tareaId) as Row | undefined;
      if (!p) return false;
      db.prepare('UPDATE reunion_puntos SET revisado = ?, nota = ? WHERE reunion_id = ? AND tarea_id = ?').run(
        (d.revisado ?? !!p.revisado) ? 1 : 0, d.nota ?? p.nota, reunionId, tareaId);
      return true;
    },

    quitarPunto(reunionId: number, tareaId: number) {
      return db.prepare('DELETE FROM reunion_puntos WHERE reunion_id = ? AND tarea_id = ?').run(reunionId, tareaId).changes > 0;
    },
  };

  function tocar(tareaId: number) {
    db.prepare(`UPDATE tareas SET actualizado = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(tareaId);
  }

  return repo;
}

export type Repo = ReturnType<typeof crearRepo>;

export interface TareaInput {
  fecha_creacion?: string;
  fecha_compromiso?: string | null;
  fecha_conclusion?: string | null;
  responsable: string;
  sucursal_id: number;
  ciudad?: string;
  estado?: string;
  espacio?: string;
  direccion?: string;
  concepto: string;
  descripcion?: string;
  observaciones?: string;
  estatus?: Estatus;
  prioridad?: 'alta' | 'media' | 'baja';
}

export interface ReunionInput {
  fecha: string;
  titulo: string;
  lugar?: string;
  asistentes?: string;
  sucursales?: number[];
  notas?: string;
}

const CAMPOS_TAREA = new Set([
  'fecha_creacion', 'fecha_compromiso', 'fecha_conclusion', 'responsable', 'sucursal_id', 'ciudad', 'estado',
  'espacio', 'direccion', 'concepto', 'descripcion', 'observaciones', 'estatus', 'prioridad',
]);

/**
 * Mantiene coherentes estatus y fecha de conclusión: cerrar (concluido/cancelado) fija la fecha
 * si no viene; reabrir la borra, salvo que el cambio la envíe explícitamente.
 */
function normalizarEstatus<T extends Partial<TareaInput>>(d: T, hoy: string, cambios?: Partial<TareaInput>): T {
  const r = { ...d };
  const cerrada = r.estatus === 'concluido' || r.estatus === 'cancelado';
  if (cerrada && !r.fecha_conclusion) r.fecha_conclusion = hoy;
  const cambiaEstatus = !cambios || 'estatus' in cambios;
  const traeConclusion = cambios ? 'fecha_conclusion' in cambios : !!d.fecha_conclusion;
  if (!cerrada && cambiaEstatus && !traeConclusion) r.fecha_conclusion = null;
  return r;
}
