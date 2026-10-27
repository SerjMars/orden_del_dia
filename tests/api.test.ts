import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../server/app.ts';
import { abrirDB } from '../server/db.ts';
import { calcularAtraso, hoyISO } from '../shared/model.ts';

let app: ReturnType<typeof crearApp>;
beforeEach(() => { app = crearApp(abrirDB(':memory:')); });

const nueva = { responsable: 'Laura', sucursal_id: 1, concepto: 'Cambio de lona', espacio: 'GTO-LEO-0142-A' };

describe('atraso', () => {
  it('cuenta días después del compromiso hasta hoy o la conclusión', () => {
    expect(calcularAtraso({ fecha_compromiso: '2026-10-20', fecha_conclusion: null, estatus: 'pendiente' }, '2026-10-27')).toBe(7);
    expect(calcularAtraso({ fecha_compromiso: '2026-10-20', fecha_conclusion: '2026-10-22', estatus: 'concluido' }, '2026-10-27')).toBe(2);
    expect(calcularAtraso({ fecha_compromiso: '2026-10-30', fecha_conclusion: null, estatus: 'pendiente' }, '2026-10-27')).toBe(0);
    expect(calcularAtraso({ fecha_compromiso: null, fecha_conclusion: null, estatus: 'pendiente' }, '2026-10-27')).toBeNull();
    expect(calcularAtraso({ fecha_compromiso: '2026-10-01', fecha_conclusion: null, estatus: 'cancelado' }, '2026-10-27')).toBeNull();
  });
});

describe('API', () => {
  it('trae las 6 sucursales iniciales y permite agregar más', async () => {
    const c = await request(app).get('/api/catalogos').expect(200);
    expect(c.body.sucursales.map((s: { nombre: string }) => s.nombre)).toEqual(
      ['Aguascalientes', 'Bajío', 'Caribe', 'Norte', 'Occidente', 'Sureste']);
    await request(app).post('/api/sucursales').send({ nombre: 'Centro' }).expect(201);
    await request(app).post('/api/sucursales').send({ nombre: 'centro' }).expect(409);
  });

  it('crea pendientes con folio y valida obligatorios', async () => {
    const r = await request(app).post('/api/tareas').send(nueva).expect(201);
    expect(r.body.folio).toBe('P-0001');
    expect(r.body.fecha_creacion).toBe(hoyISO());
    expect(r.body.sucursal).toBe('Aguascalientes');
    const e = await request(app).post('/api/tareas').send({ ...nueva, concepto: ' ' }).expect(400);
    expect(e.body.error).toMatch(/Concepto/);
    await request(app).post('/api/tareas').send({ ...nueva, sucursal_id: 99 }).expect(400);
  });

  it('concluir fija la fecha de conclusión y reabrir la borra', async () => {
    const { body: t } = await request(app).post('/api/tareas').send(nueva);
    const c = await request(app).patch(`/api/tareas/${t.id}`).send({ estatus: 'concluido' }).expect(200);
    expect(c.body.fecha_conclusion).toBe(hoyISO());
    const a = await request(app).patch(`/api/tareas/${t.id}`).send({ estatus: 'en_proceso' }).expect(200);
    expect(a.body.fecha_conclusion).toBeNull();
  });

  it('registra avances y compromisos y los resume en la lista', async () => {
    const { body: t } = await request(app).post('/api/tareas').send(nueva);
    await request(app).post(`/api/tareas/${t.id}/avances`).send({ texto: 'Lona pedida', porcentaje: 30 }).expect(201);
    await request(app).post(`/api/tareas/${t.id}/avances`).send({ texto: 'Sin cambio' }).expect(201);
    const { body: c } = await request(app).post(`/api/tareas/${t.id}/compromisos`)
      .send({ descripcion: 'Rentar grúa', responsable: 'Laura', fecha_compromiso: '2026-11-02' }).expect(201);
    const [fila] = (await request(app).get('/api/tareas')).body;
    expect(fila).toMatchObject({ avances_count: 2, porcentaje: 30, compromisos_abiertos: 1, proximo_compromiso: '2026-11-02' });
    expect(fila.ultimo_avance.texto).toBe('Sin cambio');
    const ok = await request(app).patch(`/api/compromisos/${c.id}`).send({ cumplido: true }).expect(200);
    expect(ok.body.fecha_cumplido).toBe(hoyISO());
  });

  it('una reunión arma la orden del día con los pendientes abiertos de su alcance', async () => {
    const a = (await request(app).post('/api/tareas').send(nueva)).body;
    await request(app).post('/api/tareas').send({ ...nueva, sucursal_id: 2 });
    const cerrada = (await request(app).post('/api/tareas').send({ ...nueva, estatus: 'concluido' })).body;
    const r = await request(app).post('/api/reuniones').send({ fecha: '2026-10-27', titulo: 'Semanal', sucursales: [1] }).expect(201);
    expect(r.body.puntos.map((p: { tarea: { id: number } }) => p.tarea.id)).toEqual([a.id]);
    await request(app).post(`/api/tareas/${a.id}/avances`).send({ texto: 'Revisado en junta', reunion_id: r.body.id });
    await request(app).patch(`/api/reuniones/${r.body.id}/puntos/${a.id}`).send({ revisado: true }).expect(204);
    await request(app).post(`/api/reuniones/${r.body.id}/puntos`).send({ tarea_id: cerrada.id }).expect(201);
    const d = (await request(app).get(`/api/reuniones/${r.body.id}`)).body;
    expect(d.puntos_revisados).toBe(1);
    expect(d.puntos).toHaveLength(2);
    expect(d.puntos[0].avances[0].texto).toBe('Revisado en junta');
  });
});
