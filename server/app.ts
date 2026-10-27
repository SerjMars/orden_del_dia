import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z, ZodError } from 'zod';
import { ESTATUS, PRIORIDADES } from '../shared/model.ts';
import type { DB } from './db.ts';
import { crearRepo } from './repo.ts';

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD');
const texto = z.string().trim();
const requerido = (campo: string) => z.string().trim().min(1, `${campo} es obligatorio`);

const tareaBase = z.object({
  fecha_creacion: fecha.optional(),
  fecha_compromiso: fecha.nullable().optional(),
  fecha_conclusion: fecha.nullable().optional(),
  responsable: requerido('Responsable'),
  sucursal_id: z.number().int().positive(),
  ciudad: texto.optional(),
  estado: texto.optional(),
  espacio: texto.optional(),
  direccion: texto.optional(),
  concepto: requerido('Concepto').max(140),
  descripcion: texto.optional(),
  observaciones: texto.optional(),
  estatus: z.enum(ESTATUS).optional(),
  prioridad: z.enum(PRIORIDADES).optional(),
});

const avanceSchema = z.object({
  fecha: fecha.optional(),
  texto: requerido('El avance'),
  autor: texto.optional(),
  porcentaje: z.number().int().min(0).max(100).nullable().optional(),
  reunion_id: z.number().int().nullable().optional(),
});

const compromisoSchema = z.object({
  descripcion: requerido('El compromiso'),
  responsable: requerido('Responsable'),
  fecha_compromiso: fecha,
  reunion_id: z.number().int().nullable().optional(),
});

const reunionSchema = z.object({
  fecha,
  titulo: requerido('Título'),
  lugar: texto.optional(),
  asistentes: texto.optional(),
  sucursales: z.array(z.number().int()).optional(),
  notas: z.string().optional(),
});

const id = (req: Request, k = 'id') => {
  const n = Number(req.params[k]);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, 'Identificador inválido');
  return n;
};

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function encontrado<T>(v: T | undefined | false, que = 'Registro'): T {
  if (!v) throw new HttpError(404, `${que} no encontrado`);
  return v;
}

export function crearApp(db: DB) {
  const repo = crearRepo(db);
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const api = express.Router();

  api.get('/catalogos', (_req, res) => { res.json(repo.catalogos()); });
  api.post('/sucursales', (req, res) => {
    const { nombre } = z.object({ nombre: requerido('Nombre') }).parse(req.body);
    res.status(201).json(repo.crearSucursal(nombre));
  });
  api.patch('/sucursales/:id', (req, res) => {
    repo.actualizarSucursal(id(req), z.object({ nombre: requerido('Nombre').optional(), activa: z.boolean().optional() }).parse(req.body));
    res.json(repo.catalogos().sucursales);
  });

  api.get('/tareas', (_req, res) => { res.json(repo.listarTareas()); });
  api.get('/tareas/:id', (req, res) => { res.json(encontrado(repo.detalleTarea(id(req)), 'Pendiente')); });
  api.post('/tareas', (req, res) => { res.status(201).json(repo.crearTarea(tareaBase.parse(req.body))); });
  api.patch('/tareas/:id', (req, res) => {
    res.json(encontrado(repo.actualizarTarea(id(req), tareaBase.partial().parse(req.body)), 'Pendiente'));
  });
  api.delete('/tareas/:id', (req, res) => { encontrado(repo.eliminarTarea(id(req)), 'Pendiente'); res.status(204).end(); });

  api.post('/tareas/:id/avances', (req, res) => {
    const t = encontrado(repo.obtenerTarea(id(req)), 'Pendiente');
    res.status(201).json(repo.crearAvance(t.id, avanceSchema.parse(req.body)));
  });
  api.delete('/avances/:id', (req, res) => { encontrado(repo.eliminarAvance(id(req)), 'Avance'); res.status(204).end(); });

  api.post('/tareas/:id/compromisos', (req, res) => {
    const t = encontrado(repo.obtenerTarea(id(req)), 'Pendiente');
    res.status(201).json(repo.crearCompromiso(t.id, compromisoSchema.parse(req.body)));
  });
  api.patch('/compromisos/:id', (req, res) => {
    const d = compromisoSchema.omit({ reunion_id: true }).partial().extend({ cumplido: z.boolean().optional() }).parse(req.body);
    res.json(encontrado(repo.actualizarCompromiso(id(req), d), 'Compromiso'));
  });
  api.delete('/compromisos/:id', (req, res) => { encontrado(repo.eliminarCompromiso(id(req)), 'Compromiso'); res.status(204).end(); });

  api.get('/reuniones', (_req, res) => { res.json(repo.listarReuniones()); });
  api.post('/reuniones', (req, res) => { res.status(201).json(repo.crearReunion(reunionSchema.parse(req.body))); });
  api.get('/reuniones/:id', (req, res) => { res.json(encontrado(repo.detalleReunion(id(req)), 'Reunión')); });
  api.patch('/reuniones/:id', (req, res) => {
    const d = reunionSchema.omit({ sucursales: true }).partial().extend({ cerrada: z.boolean().optional() }).parse(req.body);
    res.json(encontrado(repo.actualizarReunion(id(req), d), 'Reunión'));
  });
  api.delete('/reuniones/:id', (req, res) => { encontrado(repo.eliminarReunion(id(req)), 'Reunión'); res.status(204).end(); });
  api.post('/reuniones/:id/puntos', (req, res) => {
    const reunion = id(req);
    encontrado(repo.detalleReunion(reunion), 'Reunión');
    const { tarea_id } = z.object({ tarea_id: z.number().int() }).parse(req.body);
    encontrado(repo.obtenerTarea(tarea_id), 'Pendiente');
    repo.agregarPunto(reunion, tarea_id);
    res.status(201).json(repo.detalleReunion(reunion));
  });
  api.patch('/reuniones/:id/puntos/:tareaId', (req, res) => {
    const d = z.object({ revisado: z.boolean().optional(), nota: z.string().optional() }).parse(req.body);
    encontrado(repo.actualizarPunto(id(req), id(req, 'tareaId'), d), 'Punto');
    res.status(204).end();
  });
  api.delete('/reuniones/:id/puntos/:tareaId', (req, res) => {
    encontrado(repo.quitarPunto(id(req), id(req, 'tareaId')), 'Punto');
    res.status(204).end();
  });

  app.use('/api', api);
  app.use('/api', (_req, res) => { res.status(404).json({ error: 'Ruta no encontrada' }); });

  // En producción, el mismo servidor entrega la interfaz compilada.
  const dist = path.resolve('dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: err.issues.map((i) => i.message).join('. ') });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (err instanceof Error && /UNIQUE constraint/.test(err.message)) {
      res.status(409).json({ error: 'Ya existe un registro con ese nombre' });
    } else if (err instanceof Error && /FOREIGN KEY/.test(err.message)) {
      res.status(400).json({ error: 'La sucursal indicada no existe' });
    } else {
      console.error(err);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  return app;
}
