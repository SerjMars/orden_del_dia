import { useState, type FormEvent } from 'react';
import {
  ESTADOS_MX, ESTATUS, ESTATUS_LABEL, PRIORIDADES, PRIORIDAD_LABEL,
  type Avance, type Compromiso, type Tarea,
} from '../../../shared/model.ts';
import { api } from '../api.ts';
import { useApp } from '../contexto.tsx';
import { Campo } from './ui.tsx';

/** Listas de sugerencias compartidas (responsables y ciudades ya capturados). */
export function Sugerencias() {
  const { catalogos } = useApp();
  return (
    <>
      <datalist id="lista-responsables">{catalogos.responsables.map((r) => <option key={r} value={r} />)}</datalist>
      <datalist id="lista-ciudades">{catalogos.ciudades.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="lista-estados">{ESTADOS_MX.map((e) => <option key={e} value={e} />)}</datalist>
    </>
  );
}

type FormTarea = Omit<Tarea, 'id' | 'folio' | 'sucursal' | 'actualizado' | 'atraso' | 'porcentaje' | 'avances_count'
  | 'ultimo_avance' | 'compromisos_abiertos' | 'proximo_compromiso'>;

export function FormularioTarea({ tarea, alGuardar, alCancelar }: {
  tarea?: Tarea; alGuardar: (t: Tarea) => void; alCancelar: () => void;
}) {
  const { catalogos, avisar, recargarCatalogos } = useApp();
  const activas = catalogos.sucursales.filter((s) => s.activa || s.id === tarea?.sucursal_id);
  const [f, setF] = useState<FormTarea>(() => ({
    fecha_creacion: tarea?.fecha_creacion ?? catalogos.hoy,
    fecha_compromiso: tarea?.fecha_compromiso ?? null,
    fecha_conclusion: tarea?.fecha_conclusion ?? null,
    responsable: tarea?.responsable ?? '',
    sucursal_id: tarea?.sucursal_id ?? 0,
    ciudad: tarea?.ciudad ?? '',
    estado: tarea?.estado ?? '',
    espacio: tarea?.espacio ?? '',
    direccion: tarea?.direccion ?? '',
    concepto: tarea?.concepto ?? '',
    descripcion: tarea?.descripcion ?? '',
    observaciones: tarea?.observaciones ?? '',
    estatus: tarea?.estatus ?? 'pendiente',
    prioridad: tarea?.prioridad ?? 'media',
  }));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof FormTarea>(k: K, v: FormTarea[K]) => setF((x) => ({ ...x, [k]: v }));

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!f.sucursal_id) { setError('Elige una sucursal.'); return; }
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = { ...f, fecha_compromiso: f.fecha_compromiso || null, fecha_conclusion: f.fecha_conclusion || null };
      const t = tarea
        ? await api<Tarea>(`/tareas/${tarea.id}`, { method: 'PATCH', body: cuerpo })
        : await api<Tarea>('/tareas', { body: cuerpo });
      avisar(tarea ? 'Cambios guardados' : `Pendiente ${t.folio} creado`);
      void recargarCatalogos();
      alGuardar(t);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  const cerrada = f.estatus === 'concluido' || f.estatus === 'cancelado';

  return (
    <form className="formulario" onSubmit={enviar}>
      <fieldset>
        <legend>Qué hay que hacer</legend>
        <div className="rejilla">
          <Campo etiqueta="Concepto" ancho="completo" ayuda="Una línea que identifique el pendiente.">
            <input required maxLength={140} value={f.concepto} onChange={(e) => set('concepto', e.target.value)} autoFocus placeholder="Ej. Cambio de lona cara A" />
          </Campo>
          <Campo etiqueta="Descripción" ancho="completo">
            <textarea rows={4} value={f.descripcion} onChange={(e) => set('descripcion', e.target.value)} placeholder="Detalle de lo que se necesita, alcance y condiciones." />
          </Campo>
          <Campo etiqueta="Responsable">
            <input required list="lista-responsables" value={f.responsable} onChange={(e) => set('responsable', e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Prioridad">
            <select value={f.prioridad} onChange={(e) => set('prioridad', e.target.value as FormTarea['prioridad'])}>
              {PRIORIDADES.map((p) => <option key={p} value={p}>{PRIORIDAD_LABEL[p]}</option>)}
            </select>
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend>Dónde</legend>
        <div className="rejilla">
          <Campo etiqueta="Sucursal">
            <select required value={f.sucursal_id || ''} onChange={(e) => set('sucursal_id', Number(e.target.value))}>
              <option value="" disabled>Elige…</option>
              {activas.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </Campo>
          <Campo etiqueta="Espacio" ayuda="Clave de sitio (estructura) o de cara (anuncio).">
            <input className="mono" value={f.espacio} onChange={(e) => set('espacio', e.target.value.toUpperCase())} placeholder="Ej. GTO-LEO-0142-A" />
          </Campo>
          <Campo etiqueta="Ciudad">
            <input list="lista-ciudades" value={f.ciudad} onChange={(e) => set('ciudad', e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Estado">
            <input list="lista-estados" value={f.estado} onChange={(e) => set('estado', e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Dirección o alias" ancho="completo">
            <input value={f.direccion} onChange={(e) => set('direccion', e.target.value)} placeholder="Calle y cruce, o el nombre con el que se conoce el sitio" />
          </Campo>
        </div>
      </fieldset>

      <fieldset>
        <legend>Cuándo y en qué va</legend>
        <div className="rejilla rejilla-3">
          <Campo etiqueta="Fecha de creación">
            <input type="date" required value={f.fecha_creacion} onChange={(e) => set('fecha_creacion', e.target.value)} />
          </Campo>
          <Campo etiqueta="Fecha compromiso">
            <input type="date" value={f.fecha_compromiso ?? ''} min={f.fecha_creacion} onChange={(e) => set('fecha_compromiso', e.target.value || null)} />
          </Campo>
          <Campo etiqueta="Estatus">
            <select value={f.estatus} onChange={(e) => set('estatus', e.target.value as FormTarea['estatus'])}>
              {ESTATUS.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s]}</option>)}
            </select>
          </Campo>
          {cerrada && (
            <Campo etiqueta="Fecha de conclusión" ayuda="Si la dejas vacía se usa la fecha de hoy.">
              <input type="date" value={f.fecha_conclusion ?? ''} min={f.fecha_creacion} onChange={(e) => set('fecha_conclusion', e.target.value || null)} />
            </Campo>
          )}
          <Campo etiqueta="Observaciones" ancho="completo">
            <textarea rows={2} value={f.observaciones} onChange={(e) => set('observaciones', e.target.value)} />
          </Campo>
        </div>
      </fieldset>

      {error && <p className="error-form" role="alert">{error}</p>}
      <div className="acciones-form">
        <button type="button" className="btn" onClick={alCancelar}>Cancelar</button>
        <button type="submit" className="btn btn-primario" disabled={guardando}>
          {tarea ? 'Guardar cambios' : 'Crear pendiente'}
        </button>
      </div>
    </form>
  );
}

/** Captura rápida de un avance. Se usa en el panel de detalle y en la minuta. */
export function FormularioAvance({ tarea, reunionId, alGuardar, compacto = false }: {
  tarea: Tarea; reunionId?: number; alGuardar: (a: Avance) => void; compacto?: boolean;
}) {
  const { catalogos, avisar } = useApp();
  const [texto, setTexto] = useState('');
  const [porcentaje, setPorcentaje] = useState<string>('');
  const [fecha, setFecha] = useState(catalogos.hoy);
  const [autor, setAutor] = useState(tarea.responsable);
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!texto.trim()) return;
    setGuardando(true);
    try {
      const a = await api<Avance>(`/tareas/${tarea.id}/avances`, {
        body: { texto, fecha, autor, porcentaje: porcentaje === '' ? null : Number(porcentaje), reunion_id: reunionId ?? null },
      });
      setTexto('');
      setPorcentaje('');
      avisar('Avance registrado');
      alGuardar(a);
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className={`captura ${compacto ? 'captura-compacta' : ''}`} onSubmit={enviar}>
      <label className="sr" htmlFor={`avance-${tarea.id}`}>Avance</label>
      <textarea id={`avance-${tarea.id}`} rows={compacto ? 2 : 3} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder="¿Qué se avanzó?" required />
      <div className="captura-fila">
        {!compacto && (
          <>
            <label className="mini"><span>Fecha</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} max={catalogos.hoy} /></label>
            <label className="mini"><span>Reporta</span><input list="lista-responsables" value={autor} onChange={(e) => setAutor(e.target.value)} /></label>
          </>
        )}
        <label className="mini mini-pct"><span>% total</span>
          <input type="number" min={0} max={100} step={5} inputMode="numeric" value={porcentaje} placeholder={String(tarea.porcentaje)} onChange={(e) => setPorcentaje(e.target.value)} />
        </label>
        <button className="btn btn-oscuro" disabled={guardando || !texto.trim()}>Registrar avance</button>
      </div>
    </form>
  );
}

export function FormularioCompromiso({ tarea, reunionId, alGuardar }: {
  tarea: Tarea; reunionId?: number; alGuardar: (c: Compromiso) => void;
}) {
  const { avisar } = useApp();
  const [descripcion, setDescripcion] = useState('');
  const [responsable, setResponsable] = useState(tarea.responsable);
  const [fecha, setFecha] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    try {
      const c = await api<Compromiso>(`/tareas/${tarea.id}/compromisos`, {
        body: { descripcion, responsable, fecha_compromiso: fecha, reunion_id: reunionId ?? null },
      });
      setDescripcion('');
      setFecha('');
      avisar('Compromiso agregado');
      alGuardar(c);
    } catch (err) {
      avisar((err as Error).message, 'error');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form className="captura captura-compromiso" onSubmit={enviar}>
      <label className="mini mini-crece"><span>Compromiso</span>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required placeholder="Ej. Enviar cotización de reflectores" />
      </label>
      <label className="mini"><span>Quién</span>
        <input list="lista-responsables" value={responsable} onChange={(e) => setResponsable(e.target.value)} required />
      </label>
      <label className="mini"><span>Para cuándo</span>
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <button className="btn" disabled={guardando}>Agregar compromiso</button>
    </form>
  );
}
