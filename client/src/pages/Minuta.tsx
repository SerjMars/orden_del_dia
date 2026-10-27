import { Fragment, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Lock, LockOpen, Plus, Printer, Trash2, X } from 'lucide-react';
import {
  ESTATUS, ESTATUS_ABIERTOS, ESTATUS_LABEL,
  type Estatus, type PuntoMinuta, type ReunionDetalle, type Tarea,
} from '../../../shared/model.ts';
import { api, useRecurso } from '../api.ts';
import { useApp } from '../contexto.tsx';
import { fechaConDia, fechaCorta } from '../formato.ts';
import { FormularioAvance, FormularioCompromiso, FormularioTarea } from '../components/formularios.tsx';
import { ListaCompromisos } from '../components/PanelTarea.tsx';
import { EstatusEtiqueta, Modal, Plazo, Vacio } from '../components/ui.tsx';

export function Minuta() {
  const { id } = useParams();
  const navegar = useNavigate();
  const { catalogos, avisar } = useApp();
  const hoy = catalogos.hoy;
  const { datos: r, error, recargar, setDatos } = useRecurso<ReunionDetalle>(`/reuniones/${id}`);
  const [agregar, setAgregar] = useState(false);

  if (error) return <div className="pagina"><Vacio titulo="No se encontró la minuta"><Link to="/minutas">Volver a minutas</Link></Vacio></div>;
  if (!r) return <div className="pagina"><p className="cargando">Cargando minuta…</p></div>;

  const soloLectura = r.cerrada;
  const nombreSucursal = (sid: number) => catalogos.sucursales.find((s) => s.id === sid)?.nombre ?? '?';

  async function guardarReunion(cambios: Partial<ReunionDetalle>) {
    try {
      const n = await api<ReunionDetalle>(`/reuniones/${r!.id}`, { method: 'PATCH', body: cambios });
      setDatos(n);
      if ('cerrada' in cambios) avisar(cambios.cerrada ? 'Minuta cerrada' : 'Minuta reabierta');
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta minuta? Los avances y compromisos registrados se conservan en cada pendiente.')) return;
    await api(`/reuniones/${r!.id}`, { method: 'DELETE' });
    avisar('Minuta eliminada');
    navegar('/minutas');
  }

  const revisados = r.puntos.filter((p) => p.revisado).length;
  const acuerdos = r.puntos.flatMap((p) => [
    ...p.compromisos.filter((c) => c.reunion_id === r.id).map((c) => ({ p, c })),
  ]);

  return (
    <div className="pagina pagina-minuta">
      <div className="minuta-herramientas no-imprimir">
        <Link to="/minutas" className="enlace"><ArrowLeft size={16} /> Minutas</Link>
        <div className="grupo-botones">
          <button className="btn" onClick={() => window.print()}><Printer size={16} /> Imprimir</button>
          <button className="btn" onClick={() => guardarReunion({ cerrada: !r.cerrada })}>
            {r.cerrada ? <><LockOpen size={16} /> Reabrir</> : <><Lock size={16} /> Cerrar minuta</>}
          </button>
          <button className="btn-icono" onClick={eliminar} aria-label="Eliminar minuta"><Trash2 size={17} /></button>
        </div>
      </div>

      <header className="minuta-encabezado">
        <p className="minuta-fecha-larga">{fechaConDia(r.fecha)}{r.lugar && ` · ${r.lugar}`}</p>
        <CampoEnLinea etiqueta="Título" valor={r.titulo} soloLectura={soloLectura} clase="minuta-titulo"
          alGuardar={(titulo) => guardarReunion({ titulo })} />
        <dl className="minuta-meta">
          <div><dt>Alcance</dt><dd>{r.sucursales.length ? r.sucursales.map(nombreSucursal).join(', ') : 'Todas las sucursales'}</dd></div>
          <div className="ancho"><dt>Asistentes</dt><dd>
            <CampoEnLinea etiqueta="Asistentes" valor={r.asistentes} soloLectura={soloLectura} vacio="Agregar asistentes"
              alGuardar={(asistentes) => guardarReunion({ asistentes })} />
          </dd></div>
          <div><dt>Avance de la reunión</dt><dd>{revisados} de {r.puntos.length} puntos revisados</dd></div>
        </dl>
        {soloLectura && <p className="aviso-cerrada"><Lock size={14} /> Minuta cerrada. Reábrela para hacer cambios.</p>}
      </header>

      <div className="minuta-cuerpo">
        <nav className="minuta-indice no-imprimir" aria-label="Orden del día">
          <h2>Orden del día</h2>
          <ol>
            {r.puntos.map((p, i) => (
              <li key={p.tarea.id} className={p.revisado ? 'revisado' : ''}>
                {p.tarea.sucursal !== r.puntos[i - 1]?.tarea.sucursal && <span className="indice-grupo">{p.tarea.sucursal}</span>}
                <a href={`#punto-${p.tarea.id}`}>
                  <span className="indice-num">{p.revisado ? <Check size={13} strokeWidth={3} /> : p.orden}</span>
                  <span className="indice-texto">{p.tarea.concepto}</span>
                </a>
              </li>
            ))}
          </ol>
          {!soloLectura && <button className="enlace" onClick={() => setAgregar(true)}><Plus size={15} /> Agregar punto</button>}
        </nav>

        <div className="minuta-puntos">
          {r.puntos.length === 0 && (
            <Vacio titulo="La orden del día está vacía">
              <p>No había pendientes abiertos en el alcance de esta reunión.</p>
              {!soloLectura && <button className="btn btn-primario" onClick={() => setAgregar(true)}><Plus size={16} /> Agregar punto</button>}
            </Vacio>
          )}
          {r.puntos.map((p, i) => (
            <Fragment key={p.tarea.id}>
              {p.tarea.sucursal !== r.puntos[i - 1]?.tarea.sucursal && <h2 className="grupo-sucursal">{p.tarea.sucursal}</h2>}
              <Punto p={p} reunionId={r.id} hoy={hoy} soloLectura={soloLectura} alCambiar={recargar} />
            </Fragment>
          ))}

          <section className="minuta-cierre">
            <h2>Acuerdos generales</h2>
            <AreaEnLinea valor={r.notas} soloLectura={soloLectura} placeholder="Temas generales, acuerdos que no corresponden a un pendiente, próximos pasos…"
              alGuardar={(notas) => guardarReunion({ notas })} />
            {acuerdos.length > 0 && (
              <>
                <h2>Compromisos adquiridos en esta reunión</h2>
                <table className="tabla-acuerdos">
                  <thead><tr><th>Pendiente</th><th>Compromiso</th><th>Responsable</th><th>Fecha</th></tr></thead>
                  <tbody>
                    {acuerdos.map(({ p, c }) => (
                      <tr key={c.id} className={c.cumplido ? 'cumplido' : ''}>
                        <td><span className="mono">{p.tarea.folio}</span></td>
                        <td>{c.descripcion}</td>
                        <td>{c.responsable}</td>
                        <td>{fechaCorta(c.fecha_compromiso, hoy)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </section>
        </div>
      </div>

      {agregar && <AgregarPunto reunion={r} alCerrar={() => setAgregar(false)} alAgregar={(n) => { setDatos(n); setAgregar(false); }} />}
    </div>
  );
}

function Punto({ p, reunionId, hoy, soloLectura, alCambiar }: {
  p: PuntoMinuta; reunionId: number; hoy: string; soloLectura: boolean; alCambiar: () => void;
}) {
  const { avisar } = useApp();
  const t = p.tarea;
  const [compromiso, setCompromiso] = useState(false);

  async function actualizarPunto(cambios: { revisado?: boolean; nota?: string }) {
    try {
      await api(`/reuniones/${reunionId}/puntos/${t.id}`, { method: 'PATCH', body: cambios });
      alCambiar();
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  async function cambiarEstatus(estatus: Estatus) {
    try {
      await api(`/tareas/${t.id}`, { method: 'PATCH', body: { estatus } });
      avisar(`${t.folio}: ${ESTATUS_LABEL[estatus]}`);
      alCambiar();
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  async function quitar() {
    if (!confirm(`¿Quitar ${t.folio} de la orden del día? El pendiente no se elimina.`)) return;
    await api(`/reuniones/${reunionId}/puntos/${t.id}`, { method: 'DELETE' });
    alCambiar();
  }

  const ubicacion = [t.espacio, t.direccion, t.ciudad].filter(Boolean);
  const anterior = t.ultimo_avance && t.ultimo_avance.reunion_id !== reunionId ? t.ultimo_avance : null;

  return (
    <article id={`punto-${t.id}`} className={`punto ${p.revisado ? 'punto-revisado' : ''}`}>
      <header className="punto-cabecera">
        <span className="punto-num" aria-label={`Punto ${p.orden}`}>{p.orden}</span>
        <div className="punto-titulo">
          <h3><span className="mono folio">{t.folio}</span> {t.concepto}</h3>
          <p className="sub">
            {t.sucursal} · {t.responsable}
            {ubicacion.length > 0 && <> · <span className={t.espacio ? 'mono' : ''}>{ubicacion[0]}</span>{ubicacion.slice(1).map((u) => `, ${u}`)}</>}
          </p>
        </div>
        <div className="punto-estado">
          {soloLectura ? <EstatusEtiqueta estatus={t.estatus} /> : (
            <select aria-label="Estatus" className={`select-estatus estatus-${t.estatus}`} value={t.estatus} onChange={(e) => cambiarEstatus(e.target.value as Estatus)}>
              {ESTATUS.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s]}</option>)}
            </select>
          )}
        </div>
      </header>

      <div className="punto-contexto">
        <Plazo tarea={t} hoy={hoy} />
        <div className="punto-previo">
          <span className="etiqueta">Último avance previo</span>
          {anterior
            ? <p><time className="dato">{fechaCorta(anterior.fecha, hoy)}</time> {anterior.texto}</p>
            : <p className="tenue">{t.avances_count ? 'Solo hay avances de esta reunión.' : 'Sin avances registrados.'}</p>}
        </div>
      </div>

      {p.avances.length > 0 && (
        <ul className="punto-avances">
          {p.avances.map((a) => (
            <li key={a.id}><span className="etiqueta">Avance</span> {a.texto}{a.porcentaje != null && <span className="avance-pct">{a.porcentaje}%</span>}</li>
          ))}
        </ul>
      )}

      <ListaCompromisos compromisos={p.compromisos} hoy={hoy} alCambiar={alCambiar} soloLectura={soloLectura} />

      {!soloLectura && !p.revisado && (
        <div className="punto-captura no-imprimir">
          <FormularioAvance tarea={t} reunionId={reunionId} alGuardar={alCambiar} compacto />
          {compromiso
            ? <FormularioCompromiso tarea={t} reunionId={reunionId} alGuardar={() => { setCompromiso(false); alCambiar(); }} />
            : <button className="enlace" onClick={() => setCompromiso(true)}><Plus size={15} /> Agregar compromiso</button>}
        </div>
      )}

      <div className="punto-nota">
        <AreaEnLinea valor={p.nota} soloLectura={soloLectura} placeholder="Nota de minuta para este punto (opcional)" filas={1}
          alGuardar={(nota) => actualizarPunto({ nota })} />
      </div>

      {!soloLectura && (
        <footer className="punto-pie no-imprimir">
          <button className="enlace tenue" onClick={quitar}><X size={14} /> Quitar de la orden del día</button>
          <button className={`btn ${p.revisado ? '' : 'btn-oscuro'}`} onClick={() => actualizarPunto({ revisado: !p.revisado })}>
            {p.revisado ? 'Marcar como no revisado' : <><Check size={16} /> Punto revisado</>}
          </button>
        </footer>
      )}
    </article>
  );
}

function AgregarPunto({ reunion, alCerrar, alAgregar }: { reunion: ReunionDetalle; alCerrar: () => void; alAgregar: (r: ReunionDetalle) => void }) {
  const { datos: tareas, recargar } = useRecurso<Tarea[]>('/tareas');
  const [q, setQ] = useState('');
  const [nuevo, setNuevo] = useState(false);
  const { avisar } = useApp();
  const enAgenda = new Set(reunion.puntos.map((p) => p.tarea.id));
  const opciones = useMemo(() => {
    const txt = q.toLowerCase();
    return (tareas ?? [])
      .filter((t) => !enAgenda.has(t.id))
      .filter((t) => !txt || `${t.folio} ${t.concepto} ${t.espacio} ${t.sucursal}`.toLowerCase().includes(txt))
      .sort((a, b) => Number(ESTATUS_ABIERTOS.includes(b.estatus)) - Number(ESTATUS_ABIERTOS.includes(a.estatus)) || b.id - a.id)
      .slice(0, 30);
  }, [tareas, q, enAgenda]);

  async function agregar(tareaId: number) {
    try {
      alAgregar(await api<ReunionDetalle>(`/reuniones/${reunion.id}/puntos`, { body: { tarea_id: tareaId } }));
      avisar('Punto agregado a la orden del día');
    } catch (e) { avisar((e as Error).message, 'error'); }
  }

  return (
    <Modal abierto titulo={nuevo ? 'Nuevo pendiente' : 'Agregar punto a la orden del día'} alCerrar={alCerrar} ancho={nuevo ? 'amplio' : 'normal'}>
      {nuevo ? (
        <FormularioTarea alCancelar={() => setNuevo(false)} alGuardar={(t) => { void recargar(); void agregar(t.id); }} />
      ) : (
        <div className="agregar-punto">
          <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pendiente por folio, concepto o espacio" />
          <ul className="opciones-lista">
            {opciones.map((t) => (
              <li key={t.id}>
                <button onClick={() => agregar(t.id)}>
                  <span className="mono">{t.folio}</span>
                  <span className="crece">{t.concepto}<span className="sub"> · {t.sucursal}</span></span>
                  <EstatusEtiqueta estatus={t.estatus} />
                </button>
              </li>
            ))}
            {tareas && !opciones.length && <li className="tenue">No hay pendientes que coincidan.</li>}
          </ul>
          <button className="btn" onClick={() => setNuevo(true)}><Plus size={16} /> Crear pendiente nuevo</button>
        </div>
      )}
    </Modal>
  );
}

/** Texto editable que se guarda al salir del campo. */
function CampoEnLinea({ etiqueta, valor, alGuardar, soloLectura, clase = '', vacio = '' }: {
  etiqueta: string; valor: string; alGuardar: (v: string) => void; soloLectura: boolean; clase?: string; vacio?: string;
}) {
  if (soloLectura) return <span className={clase}>{valor || '—'}</span>;
  return (
    <input aria-label={etiqueta} className={`en-linea ${clase}`} defaultValue={valor} placeholder={vacio} key={valor}
      onBlur={(e) => { const v = e.target.value.trim(); if (v !== valor && (v || !clase)) alGuardar(v); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
  );
}

function AreaEnLinea({ valor, alGuardar, soloLectura, placeholder, filas = 3 }: {
  valor: string; alGuardar: (v: string) => void; soloLectura: boolean; placeholder: string; filas?: number;
}) {
  if (soloLectura) return valor ? <p className="texto-guardado">{valor}</p> : null;
  return (
    <textarea className="en-linea area" rows={filas} defaultValue={valor} placeholder={placeholder} key={valor}
      onInput={(e) => { const el = e.currentTarget; el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }}
      onBlur={(e) => { if (e.target.value !== valor) alGuardar(e.target.value); }} />
  );
}
