// Carga datos de ejemplo para conocer la plataforma. Uso: npm run seed:demo
import { abrirDB } from './db.ts';
import { crearRepo } from './repo.ts';
import { hoyISO } from '../shared/model.ts';

const db = abrirDB();
const repo = crearRepo(db);
if (repo.listarTareas().length) {
  console.log('La base ya tiene pendientes; no se cargaron datos de ejemplo.');
  process.exit(0);
}

const hoy = hoyISO();
const d = (dias: number) => {
  const f = new Date(`${hoy}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
};
const suc = Object.fromEntries(repo.catalogos().sucursales.map((s) => [s.nombre, s.id]));

const demo = [
  { s: 'Bajío', ciudad: 'León', estado: 'Guanajuato', espacio: 'GTO-LEO-0142-A', direccion: 'Blvd. López Mateos y Juan Alonso de Torres', concepto: 'Cambio de lona cara A', descripcion: 'Retirar lona dañada por viento y colocar lona nueva de campaña vigente. Revisar tensores y bastidor.', responsable: 'Laura Méndez', creado: -18, compromiso: -4, estatus: 'en_proceso', prioridad: 'alta', avances: [[-15, 'Se solicitó impresión de lona a proveedor.', 40], [-6, 'Lona recibida en bodega; pendiente grúa.', 70]] },
  { s: 'Bajío', ciudad: 'Querétaro', estado: 'Querétaro', espacio: 'QRO-QRO-0031', direccion: 'Puente Bernardo Quintana', concepto: 'Renovación de permiso municipal', descripcion: 'Integrar expediente para renovación anual del permiso de anuncio ante Desarrollo Urbano.', responsable: 'Jorge Salinas', creado: -30, compromiso: 6, estatus: 'en_espera', prioridad: 'media', avances: [[-20, 'Expediente entregado en ventanilla.', 60]], obs: 'Depende de respuesta del municipio.' },
  { s: 'Caribe', ciudad: 'Cancún', estado: 'Quintana Roo', espacio: 'QR-CUN-0207-B', direccion: 'Av. Tulum frente a Plaza Las Américas', concepto: 'Reparación de iluminación', descripcion: 'Dos reflectores LED fundidos en cara B. Cotizar reemplazo y programar visita nocturna para validar.', responsable: 'Ana Pech', creado: -9, compromiso: -1, estatus: 'pendiente', prioridad: 'alta', avances: [] },
  { s: 'Norte', ciudad: 'Monterrey', estado: 'Nuevo León', espacio: 'NL-MTY-0088', direccion: 'Av. Constitución km 3', concepto: 'Inspección estructural', descripcion: 'Inspección semestral de estructura unipolar: soldaduras, anclajes y pintura anticorrosiva.', responsable: 'Ricardo Treviño', creado: -12, compromiso: 3, estatus: 'en_proceso', prioridad: 'media', avances: [[-3, 'Visita realizada; reporte fotográfico en elaboración.', 50]] },
  { s: 'Occidente', ciudad: 'Zapopan', estado: 'Jalisco', espacio: 'JAL-ZAP-0115-A', direccion: 'Periférico y Av. Vallarta', concepto: 'Atender queja vecinal', descripcion: 'Vecino reporta reflejo de luz hacia su domicilio. Evaluar ajuste de ángulo de luminarias.', responsable: 'Mariana Ochoa', creado: -25, compromiso: -10, conclusion: -7, estatus: 'concluido', prioridad: 'baja', avances: [[-8, 'Se ajustó ángulo de luminarias y se habló con el vecino.', 100]] },
  { s: 'Sureste', ciudad: 'Mérida', estado: 'Yucatán', espacio: 'YUC-MID-0019', direccion: 'Periférico Norte, salida a Progreso', concepto: 'Instalación de nueva estructura', descripcion: 'Seguimiento a cimentación, montaje y conexión eléctrica de estructura nueva.', responsable: 'Luis Canché', creado: -40, compromiso: 14, estatus: 'en_proceso', prioridad: 'alta', avances: [[-30, 'Cimentación terminada.', 30], [-14, 'Columna montada.', 55], [-2, 'Contrato con CFE en trámite.', 65]] },
  { s: 'Aguascalientes', ciudad: 'Aguascalientes', estado: 'Aguascalientes', espacio: 'AGS-AGS-0007', direccion: 'Av. Aguascalientes Sur y Av. Convención', concepto: 'Actualizar póliza de seguro', descripcion: 'Incluir dos estructuras nuevas en la póliza de responsabilidad civil.', responsable: 'Patricia Romo', creado: -5, compromiso: 10, estatus: 'pendiente', prioridad: 'baja', avances: [] },
] as const;

for (const x of demo) {
  const t = repo.crearTarea({
    fecha_creacion: d(x.creado), fecha_compromiso: d(x.compromiso),
    fecha_conclusion: 'conclusion' in x ? d(x.conclusion) : null,
    responsable: x.responsable, sucursal_id: suc[x.s], ciudad: x.ciudad, estado: x.estado, espacio: x.espacio,
    direccion: x.direccion, concepto: x.concepto, descripcion: x.descripcion,
    observaciones: 'obs' in x ? x.obs : '', estatus: x.estatus, prioridad: x.prioridad,
  });
  for (const [dias, texto, pct] of x.avances) repo.crearAvance(t.id, { fecha: d(dias), texto, autor: x.responsable, porcentaje: pct });
}
const [primera] = repo.listarTareas().filter((t) => t.concepto.startsWith('Cambio de lona'));
repo.crearCompromiso(primera.id, { descripcion: 'Confirmar renta de grúa', responsable: 'Laura Méndez', fecha_compromiso: d(1) });
console.log(`Se cargaron ${demo.length} pendientes de ejemplo.`);
