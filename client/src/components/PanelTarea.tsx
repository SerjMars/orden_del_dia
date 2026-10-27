import { useState } from 'react';
import { Check, MapPin, Pencil, Trash2 } from 'lucide-react';
import { diasEntre, type Compromiso, type Tarea, type TareaDetalle } from '../../../shared/model.ts';
import { api, useRecurso } from '../api.ts';
import { useApp } from '../contexto.tsx';
import { dias, fechaCorta, fechaLarga } from '../formato.ts';
import { FormularioAvance, FormularioCompromiso, FormularioTarea } from './formularios.tsx';
import { EstatusEtiqueta, Modal, Plazo, PrioridadMarca, Vacio } from './ui.tsx';

/** Lista de compromisos con casilla para marcarlos cumplidos. */
export function ListaCompromisos({ compromisos, hoy, alCambiar, soloLectura = false }: {
  compromisos: Compromiso[]; hoy: string; alCambiar: () => void; soloLectura?: boolean;
}) {
  const { avisar } = useApp();
  if (!compromisos.length) return null;

  async function alternar(c: Compromiso) {
    try {
      await api(`/compromisos/${c.id}`, { method: 'PATCH', body: { cumplido: !c.cumplido } });
      avisar(c.cumplido ? 'Compromiso reabierto' : 'Compromiso cumplido');
      alCambiar();
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  return (
    <ul className="compromisos">
      {compromisos.map((c) => {
        const vencido = !c.cumplido && diasEntre(c.fecha_compromiso, hoy) > 0;
        return (
          <li key={c.id} className={`compromiso ${c.cumplido ? 'cumplido' : ''} ${vencido ? 'vencido' : ''}`}>
            <button type="button" className="casilla" role="checkbox" aria-checked={c.cumplido} disabled={soloLectura}
              onClick={() => alternar(c)} aria-label={c.cumplido ? 'Marcar como no cumplido' : 'Marcar como cumplido'}>
              {c.cumplido && <Check size={14} strokeWidth={3} />}
            </button>
            <span className="compromiso-texto">{c.descripcion}</span>
            <span className="compromiso-meta">
              {c.responsable} · {c.cumplido
                ? `cumplido ${fechaCorta(c.fecha_cumplido, hoy)}`
                : vencido ? `vencido desde ${fechaCorta(c.fecha_compromiso, hoy)}` : `para ${fechaCorta(c.fecha_compromiso, hoy)}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Línea de tiempo de avances (más reciente arriba). */
export function ListaAvances({ avances, hoy, alBorrar }: {
  avances: TareaDetalle['avances']; hoy: string; alBorrar?: (id: number) => void;
}) {
  return (
    <ol className="avances">
      {avances.map((a) => (
        <li key={a.id} className="avance">
          <div className="avance-fecha">
            <time dateTime={a.fecha}>{fechaCorta(a.fecha, hoy)}</time>
            {a.porcentaje != null && <span className="avance-pct">{a.porcentaje}%</span>}
          </div>
          <div className="avance-cuerpo">
            <p>{a.texto}</p>
            <span className="avance-autor">
              {a.autor}{a.reunion_id && ' · registrado en minuta'}
            </span>
          </div>
          {alBorrar && (
            <button type="button" className="btn-icono btn-borrar" onClick={() => alBorrar(a.id)} aria-label="Eliminar avance">
              <Trash2 size={15} />
            </button>
          )}
        </li>
      ))}
    </ol>
  );
}

type Pestana = 'avances' | 'compromisos' | 'datos';

export function PanelTarea({ id, alCerrar, alCambiar }: { id: number; alCerrar: () => void; alCambiar: () => void }) {
  const { catalogos, avisar } = useApp();
  const { datos: t, error, recargar } = useRecurso<TareaDetalle>(`/tareas/${id}`);
  const [pestana, setPestana] = useState<Pestana>('avances');
  const [editando, setEditando] = useState(false);
  const hoy = catalogos.hoy;

  const refrescar = () => { void recargar(); alCambiar(); };

  async function borrarAvance(avanceId: number) {
    if (!confirm('¿Eliminar este avance?')) return;
    await api(`/avances/${avanceId}`, { method: 'DELETE' });
    avisar('Avance eliminado');
    refrescar();
  }

  async function borrarTarea() {
    if (!t || !confirm(`¿Eliminar el pendiente ${t.folio} con todos sus avances y compromisos? No se puede deshacer.`)) return;
    await api(`/tareas/${t.id}`, { method: 'DELETE' });
    avisar(`Pendiente ${t.folio} eliminado`);
    alCambiar();
    alCerrar();
  }

  const titulo = t ? <><span className="mono folio">{t.folio}</span> {t.concepto}</> : 'Pendiente';

  return (
    <Modal abierto titulo={titulo} alCerrar={alCerrar} lateral>
      {error && <p className="error-form">{error}</p>}
      {t && !editando && (
        <div className="panel">
          <div className="panel-resumen">
            <div className="panel-chips">
              <EstatusEtiqueta estatus={t.estatus} />
              <span className="chip"><PrioridadMarca prioridad={t.prioridad} /> Prioridad {t.prioridad}</span>
              <span className="chip">{t.sucursal}</span>
            </div>
            <Plazo tarea={t} hoy={hoy} />
            <dl className="panel-datos">
              <div><dt>Responsable</dt><dd>{t.responsable}</dd></div>
              <div><dt>Espacio</dt><dd className="mono">{t.espacio || '—'}</dd></div>
              <div className="ancho"><dt>Ubicación</dt><dd><MapPin size={14} aria-hidden /> {[t.direccion, t.ciudad, t.estado].filter(Boolean).join(', ') || '—'}</dd></div>
            </dl>
            <div className="panel-botones">
              <button className="btn" onClick={() => setEditando(true)}><Pencil size={15} /> Editar</button>
            </div>
          </div>

          <div className="pestanas" role="tablist">
            {([['avances', `Avances (${t.avances.length})`], ['compromisos', `Compromisos (${t.compromisos.filter((c) => !c.cumplido).length})`], ['datos', 'Detalle']] as const)
              .map(([k, txt]) => (
                <button key={k} role="tab" aria-selected={pestana === k} className={pestana === k ? 'activa' : ''} onClick={() => setPestana(k)}>{txt}</button>
              ))}
          </div>

          {pestana === 'avances' && (
            <section className="panel-seccion">
              <FormularioAvance tarea={t} alGuardar={refrescar} />
              {t.avances.length
                ? <ListaAvances avances={t.avances} hoy={hoy} alBorrar={borrarAvance} />
                : <Vacio titulo="Aún no hay avances">Registra el primero arriba; aparecerá aquí con su fecha.</Vacio>}
            </section>
          )}

          {pestana === 'compromisos' && (
            <section className="panel-seccion">
              <FormularioCompromiso tarea={t} alGuardar={refrescar} />
              {t.compromisos.length
                ? <ListaCompromisos compromisos={t.compromisos} hoy={hoy} alCambiar={refrescar} />
                : <Vacio titulo="Sin compromisos">Agrega quién se compromete a qué y para cuándo.</Vacio>}
            </section>
          )}

          {pestana === 'datos' && (
            <section className="panel-seccion texto-largo">
              <h3>Descripción</h3>
              <p>{t.descripcion || 'Sin descripción.'}</p>
              <h3>Observaciones</h3>
              <p>{t.observaciones || 'Sin observaciones.'}</p>
              <dl className="panel-datos panel-fechas">
                <div><dt>Creación</dt><dd>{fechaLarga(t.fecha_creacion)}</dd></div>
                <div><dt>Compromiso</dt><dd>{fechaLarga(t.fecha_compromiso)}</dd></div>
                <div><dt>Conclusión</dt><dd>{fechaLarga(t.fecha_conclusion)}</dd></div>
                <div><dt>Atraso</dt><dd>{t.atraso == null ? '—' : dias(t.atraso)}</dd></div>
              </dl>
              <button className="btn btn-peligro" onClick={borrarTarea}><Trash2 size={15} /> Eliminar pendiente</button>
            </section>
          )}
        </div>
      )}
      {t && editando && (
        <FormularioTarea tarea={t} alCancelar={() => setEditando(false)} alGuardar={(_n: Tarea) => { setEditando(false); refrescar(); }} />
      )}
    </Modal>
  );
}
