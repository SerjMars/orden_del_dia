import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { SUCURSALES_INICIALES } from '../shared/model.ts';

export type DB = Database.Database;

const MIGRACIONES: string[] = [
  // 1: esquema inicial
  `
  CREATE TABLE sucursales (
    id      INTEGER PRIMARY KEY,
    nombre  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    activa  INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE tareas (
    id                INTEGER PRIMARY KEY,
    fecha_creacion    TEXT NOT NULL,
    fecha_compromiso  TEXT,
    fecha_conclusion  TEXT,
    responsable       TEXT NOT NULL,
    sucursal_id       INTEGER NOT NULL REFERENCES sucursales(id),
    ciudad            TEXT NOT NULL DEFAULT '',
    estado            TEXT NOT NULL DEFAULT '',
    espacio           TEXT NOT NULL DEFAULT '',
    direccion         TEXT NOT NULL DEFAULT '',
    concepto          TEXT NOT NULL,
    descripcion       TEXT NOT NULL DEFAULT '',
    observaciones     TEXT NOT NULL DEFAULT '',
    estatus           TEXT NOT NULL DEFAULT 'pendiente',
    prioridad         TEXT NOT NULL DEFAULT 'media',
    actualizado       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_tareas_sucursal ON tareas(sucursal_id);
  CREATE INDEX idx_tareas_estatus ON tareas(estatus);

  CREATE TABLE reuniones (
    id          INTEGER PRIMARY KEY,
    fecha       TEXT NOT NULL,
    titulo      TEXT NOT NULL,
    lugar       TEXT NOT NULL DEFAULT '',
    asistentes  TEXT NOT NULL DEFAULT '',
    sucursales  TEXT NOT NULL DEFAULT '[]',
    notas       TEXT NOT NULL DEFAULT '',
    cerrada     INTEGER NOT NULL DEFAULT 0,
    creado      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );

  CREATE TABLE avances (
    id          INTEGER PRIMARY KEY,
    tarea_id    INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    fecha       TEXT NOT NULL,
    texto       TEXT NOT NULL,
    autor       TEXT NOT NULL DEFAULT '',
    porcentaje  INTEGER,
    reunion_id  INTEGER REFERENCES reuniones(id) ON DELETE SET NULL,
    creado      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_avances_tarea ON avances(tarea_id);

  CREATE TABLE compromisos (
    id                INTEGER PRIMARY KEY,
    tarea_id          INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    descripcion       TEXT NOT NULL,
    responsable       TEXT NOT NULL,
    fecha_compromiso  TEXT NOT NULL,
    cumplido          INTEGER NOT NULL DEFAULT 0,
    fecha_cumplido    TEXT,
    reunion_id        INTEGER REFERENCES reuniones(id) ON DELETE SET NULL,
    creado            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
  );
  CREATE INDEX idx_compromisos_tarea ON compromisos(tarea_id);

  CREATE TABLE reunion_puntos (
    reunion_id  INTEGER NOT NULL REFERENCES reuniones(id) ON DELETE CASCADE,
    tarea_id    INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    orden       INTEGER NOT NULL,
    revisado    INTEGER NOT NULL DEFAULT 0,
    nota        TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (reunion_id, tarea_id)
  );
  `,
];

export function abrirDB(archivo = process.env.DB_PATH ?? path.resolve('data/orden_del_dia.db')): DB {
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const db = new Database(archivo);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrar(db);
  return db;
}

function migrar(db: DB) {
  const version = db.pragma('user_version', { simple: true }) as number;
  for (let i = version; i < MIGRACIONES.length; i++) {
    db.transaction(() => {
      db.exec(MIGRACIONES[i]);
      if (i === 0) {
        const ins = db.prepare('INSERT INTO sucursales (nombre) VALUES (?)');
        for (const s of SUCURSALES_INICIALES) ins.run(s);
      }
      db.pragma(`user_version = ${i + 1}`);
    })();
  }
}
