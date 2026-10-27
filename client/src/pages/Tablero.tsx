import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, MessageSquarePlus, Plus, Search } from 'lucide-react';
import { ESTATUS, ESTATUS_ABIERTOS, ESTATUS_LABEL, diasEntre, type Tarea } from '../../../shared/model.ts';
import { useRecurso } from '../api.ts';
import { useApp } from '../contexto.tsx';
import { fechaCorta } from '../formato.ts';
import { FormularioTarea } from '../components/formularios.tsx';
import { PanelTarea } from '../components/PanelTarea.tsx';
import { Avatar, EstatusEtiqueta, Modal, Plazo, PrioridadMarca, Vacio } from '../components/ui.tsx';

type Vista = 'abiertos' | 'atrasados' | 'semana' | 'concluidos' | 'todos';

const ORDENES = {
  atraso: 'Más atrasados primero',
  compromiso: 'Fecha compromiso',
  reciente: 'Actividad reciente',
  folio: 'Folio',
} as const;
type Orden = keyof typeof ORDENES;

export function Tablero() {
  const { catalogos } = useApp();
  const hoy = catalogos.hoy;
  const { id } = useParams();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const { datos: tareas, cargando, recargar } = useRecurso<Tarea[]>('/tareas');
  const [nuevo, setNuevo] = useState(false);
  const [expandido, setExpandido] = useState<number | null>(null);

  // Los filtros viven en la URL para poder compartir o recargar una vista.
  const vista = (params.get('vista') as Vista) ?? 'abiertos';
  const q = params.get('q') ?? '';
  const sucursal = params.get('sucursal') ?? '';
  const responsable = params.get('responsable') ?? '';
  const estatus = params.get('estatus') ?? '';
  const orden = (params.get('orden') as Orden) ?? 'atraso';
  const setFiltro = (k: string, v: string) => setParams((p) => { if (v) p.set(k, v); else p.delete(k); return p; }, { replace: true });

  const conteos = useMemo(() => {
    const t = tareas ?? [];
    const abiertos = t.filter((x) => ESTATUS_ABIERTOS.includes(x.estatus));
    return {
      abiertos: abiertos.length,
      atrasados: abiertos.filter((x) => (x.atraso ?? 0) > 0).length,
      semana: abiertos.filter((x) => x.fecha_compromiso && !x.atraso && diasEntre(hoy, x.fecha_compromiso) <= 7).length,
      concluidos: t.filter((x) => x.estatus === 'concluido' && x.fecha_conclusion && diasEntre(x.fecha_conclusion, hoy) <= 30).length,
      todos: t.length,
    };
  }, [tareas, hoy]);

  const responsables = useMemo(() => [...new Set((tareas ?? []).map((t) => t.responsable))].sort((a, b) => a.localeCompare(b, 'es')), [tareas]);

  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase();
    const r = (tareas ?? []).filter((t) => {
      const abierto = ESTATUS_ABIERTOS.includes(t.estatus);
      if (vista === 'abiertos' && !abierto) return false;
      if (vista === 'atrasados' && !(abierto && (t.atraso ?? 0) > 0)) return false;
      if (vista === 'semana' && !(abierto && t.fecha_compromiso && !t.atraso && diasEntre(hoy, t.fecha_compromiso) <= 7)) return false;
      if (vista === 'concluidos' && !(t.estatus === 'concluido' && t.fecha_conclusion && diasEntre(t.fecha_conclusion, hoy) <= 30)) return false;
      if (sucursal && String(t.sucursal_id) !== sucursal) return false;
      if (responsable && t.responsable !== responsable) return false;
      if (estatus && t.estatus !== estatus) return false;
      if (texto) {
        const pajar = [t.folio, t.concepto, t.espacio, t.ciudad, t.estado, t.direccion, t.responsable, t.descripcion].join(' ').toLowerCase();
        if (!texto.split(/\s+/).every((p) => pajar.includes(p))) return false;
      }
      return true;
    });
    const porFecha = (x: string | null) => x ?? '9999-12-31';
    return r.sort((a, b) => {
      switch (orden) {
        case 'compromiso': return porFecha(a.fecha_compromiso).localeCompare(porFecha(b.fecha_compromiso));
        case 'reciente': return b.actualizado.localeCompare(a.actualizado);
        case 'folio': return b.id - a.id;
        default: return (b.atraso ?? -1) - (a.atraso ?? -1) || porFecha(a.fecha_compromiso).localeCompare(porFecha(b.fecha_compromiso));
      }
    });
  }, [tareas, vista, q, sucursal, responsable, estatus, orden, hoy]);

  const hayFiltros = q || sucursal || responsable || estatus;
  const abrir = (tid: number) => navegar({ pathname: `/pendientes/${tid}`, search: params.toString() });

  const indicadores: { k: Vista; titulo: string; nota: string }[] = [
    { k: 'abiertos', titulo: 'Abiertos', nota: 'pendientes, en proceso o en espera' },
    { k: 'atrasados', titulo: 'Atrasados', nota: 'pasaron su fecha compromiso' },
    { k: 'semana', titulo: 'Vencen en 7 días', nota: 'aún a tiempo' },
    { k: 'concluidos', titulo: 'Concluidos', nota: 'en los últimos 30 días' },
  ];

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Pendientes</h1>
          <p className="subtitulo">Lo que está en curso en las sucursales, con sus avances y compromisos.</p>
        </div>
        <button className="btn btn-primario" onClick={() => setNuevo(true)}><Plus size={18} /> Nuevo pendiente</button>
      </div>

      <div className="indicadores" role="tablist" aria-label="Vistas rápidas">
        {indicadores.map((i) => (
          <button key={i.k} role="tab" aria-selected={vista === i.k}
            className={`indicador ${vista === i.k ? 'activo' : ''} ${i.k === 'atrasados' && conteos.atrasados ? 'indicador-alerta' : ''}`}
            onClick={() => setFiltro('vista', i.k === 'abiertos' ? '' : i.k)}>
            <span className="indicador-numero">{conteos[i.k]}</span>
            <span className="indicador-titulo">{i.titulo}</span>
            <span className="indicador-nota">{i.nota}</span>
          </button>
        ))}
      </div>

      <div className="filtros">
        <label className="buscador">
          <Search size={17} aria-hidden />
          <span className="sr">Buscar</span>
          <input type="search" value={q} onChange={(e) => setFiltro('q', e.target.value)} placeholder="Buscar por folio, concepto, espacio, ciudad…" />
        </label>
        <select aria-label="Sucursal" value={sucursal} onChange={(e) => setFiltro('sucursal', e.target.value)}>
          <option value="">Todas las sucursales</option>
          {catalogos.sucursales.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select aria-label="Responsable" value={responsable} onChange={(e) => setFiltro('responsable', e.target.value)}>
          <option value="">Todos los responsables</option>
          {responsables.map((r) => <option key={r}>{r}</option>)}
        </select>
        <select aria-label="Estatus" value={estatus} onChange={(e) => setFiltro('estatus', e.target.value)}>
          <option value="">Cualquier estatus</option>
          {ESTATUS.map((s) => <option key={s} value={s}>{ESTATUS_LABEL[s]}</option>)}
        </select>
        <select aria-label="Ordenar" value={orden} onChange={(e) => setFiltro('orden', e.target.value === 'atraso' ? '' : e.target.value)}>
          {Object.entries(ORDENES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="filtros-resumen">
          {vista !== 'todos' && (
            <button className="enlace" onClick={() => setFiltro('vista', 'todos')}>Ver todos ({conteos.todos})</button>
          )}
          {hayFiltros && (
            <button className="enlace" onClick={() => setParams(vista === 'abiertos' ? {} : { vista }, { replace: true })}>Limpiar filtros</button>
          )}
        </div>
      </div>

      {cargando && !tareas ? <p className="cargando">Cargando pendientes…</p> : lista.length === 0 ? (
        conteos.todos === 0 ? (
          <Vacio titulo="Todavía no hay pendientes">
            <p>Crea el primero para empezar a darle seguimiento.</p>
            <button className="btn btn-primario" onClick={() => setNuevo(true)}><Plus size={18} /> Nuevo pendiente</button>
          </Vacio>
        ) : <Vacio titulo="Nada coincide con estos filtros"><p>Prueba con otra vista o limpia los filtros.</p></Vacio>
      ) : (
        <div className="tabla" role="table" aria-label="Pendientes">
          <div className="tabla-encabezado" role="row">
            <span role="columnheader">Folio</span>
            <span role="columnheader">Concepto y espacio</span>
            <span role="columnheader">Responsable</span>
            <span role="columnheader">Compromiso</span>
            <span role="columnheader">Estatus</span>
            <span role="columnheader"><span className="sr">Acciones</span></span>
          </div>
          {lista.map((t) => (
            <Fila key={t.id} t={t} hoy={hoy} abierta={expandido === t.id}
              alAlternar={() => setExpandido(expandido === t.id ? null : t.id)} alAbrir={() => abrir(t.id)} />
          ))}
          <p className="tabla-pie">{lista.length} de {conteos.todos} pendientes</p>
        </div>
      )}

      <Modal abierto={nuevo} titulo="Nuevo pendiente" alCerrar={() => setNuevo(false)} ancho="amplio">
        <FormularioTarea alCancelar={() => setNuevo(false)} alGuardar={(t) => { setNuevo(false); void recargar(); abrir(t.id); }} />
      </Modal>

      {id && <PanelTarea key={id} id={Number(id)} alCerrar={() => navegar({ pathname: '/', search: params.toString() })} alCambiar={recargar} />}
    </div>
  );
}

function Fila({ t, hoy, abierta, alAlternar, alAbrir }: { t: Tarea; hoy: string; abierta: boolean; alAlternar: () => void; alAbrir: () => void }) {
  const ubicacion = [t.ciudad, t.estado].filter(Boolean).join(', ');
  return (
    <div className={`fila ${abierta ? 'fila-abierta' : ''} ${(t.atraso ?? 0) > 0 && ESTATUS_ABIERTOS.includes(t.estatus) ? 'fila-atraso' : ''}`} role="rowgroup">
      <div className="fila-principal" role="row">
        <span className="celda-folio" role="cell">
          <PrioridadMarca prioridad={t.prioridad} />
          <span className="mono">{t.folio}</span>
        </span>
        <span className="celda-concepto" role="cell">
          <button className="concepto" onClick={alAbrir}>{t.concepto}</button>
          <span className="sub">
            {t.espacio && <span className="mono espacio">{t.espacio}</span>}
            <span>{t.sucursal}{ubicacion && ` · ${ubicacion}`}</span>
          </span>
        </span>
        <span className="celda-responsable" role="cell"><Avatar nombre={t.responsable} /> {t.responsable}</span>
        <span className="celda-plazo" role="cell"><Plazo tarea={t} hoy={hoy} compacto /></span>
        <span className="celda-estatus" role="cell">
          <EstatusEtiqueta estatus={t.estatus} />
          {t.porcentaje > 0 && t.estatus !== 'concluido' && <span className="porcentaje">{t.porcentaje}%</span>}
        </span>
        <span className="celda-acciones" role="cell">
          <button className="btn-icono" onClick={alAlternar} aria-expanded={abierta} aria-label={abierta ? 'Ocultar resumen' : 'Ver resumen'}>
            <ChevronDown size={18} className="girar" />
          </button>
        </span>
      </div>
      {abierta && (
        <div className="fila-detalle">
          <div className="fila-detalle-col">
            <h4>Último avance</h4>
            {t.ultimo_avance ? (
              <p><time className="dato">{fechaCorta(t.ultimo_avance.fecha, hoy)}</time> {t.ultimo_avance.texto}</p>
            ) : <p className="tenue">Sin avances registrados.</p>}
            {t.avances_count > 1 && <button className="enlace" onClick={alAbrir}>Ver los {t.avances_count} avances</button>}
          </div>
          <div className="fila-detalle-col">
            <h4>Compromisos</h4>
            {t.compromisos_abiertos
              ? <p>{t.compromisos_abiertos} abierto{t.compromisos_abiertos > 1 && 's'}; el próximo vence el {fechaCorta(t.proximo_compromiso, hoy)}.</p>
              : <p className="tenue">Sin compromisos abiertos.</p>}
            {t.observaciones && <><h4>Observaciones</h4><p>{t.observaciones}</p></>}
          </div>
          <div className="fila-detalle-acciones">
            <button className="btn btn-oscuro" onClick={alAbrir}><MessageSquarePlus size={16} /> Registrar avance</button>
            <button className="btn" onClick={alAbrir}>Abrir ficha</button>
          </div>
        </div>
      )}
    </div>
  );
}
