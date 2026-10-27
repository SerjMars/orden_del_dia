import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../api.ts';
import { useApp } from '../contexto.tsx';

export function Ajustes() {
  const { catalogos, recargarCatalogos, avisar } = useApp();
  const [nombre, setNombre] = useState('');

  async function agregar(e: FormEvent) {
    e.preventDefault();
    try {
      await api('/sucursales', { body: { nombre } });
      avisar(`Sucursal ${nombre} agregada`);
      setNombre('');
      await recargarCatalogos();
    } catch (err) { avisar((err as Error).message, 'error'); }
  }

  async function cambiar(id: number, cambios: { nombre?: string; activa?: boolean }) {
    try {
      await api(`/sucursales/${id}`, { method: 'PATCH', body: cambios });
      await recargarCatalogos();
    } catch (err) { avisar((err as Error).message, 'error'); }
  }

  return (
    <div className="pagina pagina-angosta">
      <div className="pagina-cabecera">
        <div>
          <h1>Ajustes</h1>
          <p className="subtitulo">Catálogo de sucursales. Las inactivas ya no aparecen al crear pendientes, pero conservan su historial.</p>
        </div>
      </div>
      <section className="tarjeta">
        <h2>Sucursales</h2>
        <ul className="lista-sucursales">
          {catalogos.sucursales.map((s) => (
            <li key={s.id} className={s.activa ? '' : 'inactiva'}>
              <input aria-label={`Nombre de ${s.nombre}`} className="en-linea" defaultValue={s.nombre} key={s.nombre}
                onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== s.nombre) void cambiar(s.id, { nombre: v }); }} />
              <label className="interruptor">
                <input type="checkbox" checked={s.activa} onChange={(e) => cambiar(s.id, { activa: e.target.checked })} />
                <span>{s.activa ? 'Activa' : 'Inactiva'}</span>
              </label>
            </li>
          ))}
        </ul>
        <form className="captura-fila" onSubmit={agregar}>
          <label className="mini mini-crece"><span>Nueva sucursal</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required placeholder="Ej. Centro" />
          </label>
          <button className="btn btn-oscuro"><Plus size={16} /> Agregar</button>
        </form>
      </section>
    </div>
  );
}
