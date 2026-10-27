import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ESTATUS_LABEL, PRIORIDAD_LABEL, diasEntre, type Estatus, type Prioridad, type Tarea } from '../../../shared/model.ts';
import { dias, fechaCorta, iniciales, relativo } from '../formato.ts';

/** Ventana modal sobre <dialog> nativo: foco atrapado, Esc para cerrar. */
export function Modal({ titulo, abierto, alCerrar, children, ancho = 'normal', lateral = false }: {
  titulo: ReactNode; abierto: boolean; alCerrar: () => void; children: ReactNode; ancho?: 'normal' | 'amplio'; lateral?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className={`modal ${lateral ? 'modal-lateral' : ''} modal-${ancho}`}
      aria-labelledby={tituloId}
      onClose={alCerrar}
      onClick={(e) => { if (e.target === ref.current) alCerrar(); }}
    >
      {abierto && (
        <div className="modal-cuerpo">
          <header className="modal-cabecera">
            <h2 id={tituloId}>{titulo}</h2>
            <button type="button" className="btn-icono" onClick={alCerrar} aria-label="Cerrar"><X size={20} /></button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function EstatusEtiqueta({ estatus }: { estatus: Estatus }) {
  return <span className={`estatus estatus-${estatus}`}>{ESTATUS_LABEL[estatus]}</span>;
}

export function PrioridadMarca({ prioridad }: { prioridad: Prioridad }) {
  return (
    <span className={`prioridad prioridad-${prioridad}`} title={`Prioridad ${PRIORIDAD_LABEL[prioridad].toLowerCase()}`}>
      <span className="sr">Prioridad {PRIORIDAD_LABEL[prioridad]}</span>
    </span>
  );
}

/**
 * Barra de plazo: recorrido desde la creación hasta la fecha compromiso, con lo
 * transcurrido después del compromiso en rojo. Es la lectura rápida del atraso.
 */
export function Plazo({ tarea, hoy, compacto = false }: { tarea: Tarea; hoy: string; compacto?: boolean }) {
  const { fecha_creacion: ini, fecha_compromiso: comp, fecha_conclusion: fin, estatus, atraso } = tarea;
  const cerrada = estatus === 'concluido' || estatus === 'cancelado';
  const corte = fin ?? hoy;

  let texto: string;
  let tono: 'neutro' | 'ok' | 'alerta' | 'atraso' = 'neutro';
  if (estatus === 'cancelado') texto = 'Cancelado';
  else if (!comp) texto = 'Sin fecha compromiso';
  else if (cerrada) {
    texto = atraso ? `Concluido con ${dias(atraso)} de atraso` : 'Concluido a tiempo';
    tono = atraso ? 'atraso' : 'ok';
  } else if (atraso) {
    texto = `${dias(atraso)} de atraso`;
    tono = 'atraso';
  } else {
    texto = relativo(comp, hoy);
    tono = diasEntre(hoy, comp) <= 3 ? 'alerta' : 'neutro';
  }

  let barra: ReactNode = null;
  if (comp) {
    const total = Math.max(1, diasEntre(ini, comp), diasEntre(ini, corte));
    const pct = (f: string) => Math.min(100, Math.max(0, (diasEntre(ini, f) / total) * 100));
    const pComp = pct(comp);
    const pCorte = pct(corte);
    barra = (
      <div className="plazo-pista" aria-hidden="true">
        <span className="plazo-tiempo" style={{ width: `${Math.min(pCorte, pComp)}%` }} />
        {pCorte > pComp && <span className="plazo-exceso" style={{ left: `${pComp}%`, width: `${pCorte - pComp}%` }} />}
        <span className="plazo-meta" style={{ left: `${pComp}%` }} />
      </div>
    );
  }

  return (
    <div className={`plazo plazo-${tono} ${compacto ? 'plazo-compacto' : ''}`}>
      <div className="plazo-linea">
        <span className="plazo-fecha">{comp ? fechaCorta(comp, hoy) : '—'}</span>
        <span className="plazo-texto">{texto}</span>
      </div>
      {barra}
    </div>
  );
}

export function Campo({ etiqueta, children, ayuda, ancho }: { etiqueta: string; children: ReactNode; ayuda?: string; ancho?: 'completo' | 'medio' }) {
  return (
    <label className={`campo ${ancho ? `campo-${ancho}` : ''}`}>
      <span className="campo-etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="campo-ayuda">{ayuda}</span>}
    </label>
  );
}

export function Vacio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="vacio">
      <p className="vacio-titulo">{titulo}</p>
      {children}
    </div>
  );
}

export function Avatar({ nombre }: { nombre: string }) {
  return <span className="avatar" aria-hidden="true">{iniciales(nombre)}</span>;
}
