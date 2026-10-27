import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import type { Reunion, ReunionDetalle } from '../../../shared/model.ts';
import { api, useRecurso } from '../api.ts';
import { useApp } from '../contexto.tsx';
import { fechaMesAnio } from '../formato.ts';
import { Campo, Modal, Vacio } from '../components/ui.tsx';

export function Minutas() {
  const { catalogos } = useApp();
  const { datos: reuniones, cargando } = useRecurso<Reunion[]>('/reuniones');
  const [nueva, setNueva] = useState(false);
  const nombreSucursal = (id: number) => catalogos.sucursales.find((s) => s.id === id)?.nombre ?? '?';

  return (
    <div className="pagina">
      <div className="pagina-cabecera">
        <div>
          <h1>Minutas</h1>
          <p className="subtitulo">Cada reunión arma su orden del día con los pendientes abiertos y deja registro de avances y acuerdos.</p>
        </div>
        <button className="btn btn-primario" onClick={() => setNueva(true)}><Plus size={18} /> Nueva reunión</button>
      </div>

      {cargando && !reuniones ? <p className="cargando">Cargando…</p> : !reuniones?.length ? (
        <Vacio titulo="No hay reuniones registradas">
          <p>Al crear una reunión se arma la orden del día con los pendientes abiertos de las sucursales que elijas.</p>
          <button className="btn btn-primario" onClick={() => setNueva(true)}><Plus size={18} /> Nueva reunión</button>
        </Vacio>
      ) : (
        <ul className="lista-minutas">
          {reuniones.map((r) => {
            const pct = r.puntos_total ? Math.round((r.puntos_revisados / r.puntos_total) * 100) : 0;
            return (
              <li key={r.id}>
                <Link to={`/minutas/${r.id}`} className="minuta-tarjeta">
                  <time className="minuta-fecha" dateTime={r.fecha}>
                    <span className="dia">{r.fecha.slice(8, 10)}</span>
                    <span className="mes">{fechaMesAnio(r.fecha)}</span>
                  </time>
                  <span className="minuta-info">
                    <strong>{r.titulo}</strong>
                    <span className="sub">
                      {r.sucursales.length ? r.sucursales.map(nombreSucursal).join(', ') : 'Todas las sucursales'}
                      {r.lugar && ` · ${r.lugar}`}
                    </span>
                  </span>
                  <span className="minuta-avance">
                    <span className="sub">{r.puntos_revisados} de {r.puntos_total} puntos revisados</span>
                    <span className="progreso" aria-hidden><span style={{ width: `${pct}%` }} /></span>
                  </span>
                  <span className={`estatus ${r.cerrada ? 'estatus-concluido' : 'estatus-en_proceso'}`}>{r.cerrada ? 'Cerrada' : 'Abierta'}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Modal abierto={nueva} titulo="Nueva reunión" alCerrar={() => setNueva(false)}>
        <FormularioReunion alCancelar={() => setNueva(false)} />
      </Modal>
    </div>
  );
}

function FormularioReunion({ alCancelar }: { alCancelar: () => void }) {
  const { catalogos, avisar } = useApp();
  const navegar = useNavigate();
  const [fecha, setFecha] = useState(catalogos.hoy);
  const [titulo, setTitulo] = useState('Reunión semanal de seguimiento');
  const [lugar, setLugar] = useState('');
  const [asistentes, setAsistentes] = useState('');
  const [sucursales, setSucursales] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<ReunionDetalle>('/reuniones', { body: { fecha, titulo, lugar, asistentes, sucursales } });
      avisar(`Reunión creada con ${r.puntos.length} puntos en la orden del día`);
      navegar(`/minutas/${r.id}`);
    } catch (err) { setError((err as Error).message); }
  }

  const alternar = (id: number) => setSucursales((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <form className="formulario" onSubmit={enviar}>
      <div className="rejilla">
        <Campo etiqueta="Título" ancho="completo"><input required value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        <Campo etiqueta="Fecha"><input type="date" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo etiqueta="Lugar o enlace"><input value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Sala de juntas, Teams…" /></Campo>
        <Campo etiqueta="Asistentes" ancho="completo" ayuda="Separa los nombres con comas.">
          <input value={asistentes} onChange={(e) => setAsistentes(e.target.value)} />
        </Campo>
      </div>
      <fieldset>
        <legend>Sucursales a revisar</legend>
        <p className="campo-ayuda">Si no eliges ninguna, se incluyen todas.</p>
        <div className="opciones">
          {catalogos.sucursales.filter((s) => s.activa).map((s) => (
            <label key={s.id} className={`opcion ${sucursales.includes(s.id) ? 'elegida' : ''}`}>
              <input type="checkbox" checked={sucursales.includes(s.id)} onChange={() => alternar(s.id)} /> {s.nombre}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <p className="error-form" role="alert">{error}</p>}
      <div className="acciones-form">
        <button type="button" className="btn" onClick={alCancelar}>Cancelar</button>
        <button className="btn btn-primario">Crear y armar orden del día</button>
      </div>
    </form>
  );
}
