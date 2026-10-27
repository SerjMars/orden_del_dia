import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { ClipboardList, NotebookPen, Settings } from 'lucide-react';
import { Sugerencias } from './formularios.tsx';

export function Marco() {
  const { pathname } = useLocation();
  return (
    <div className="marco">
      <header className="barra">
        <div className="barra-interior">
          <NavLink to="/" className="marca" aria-label="Orden del día — inicio">
            <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
              <rect x="3" y="5" width="26" height="14" rx="1.5" fill="currentColor" className="marca-cara" />
              <rect x="15" y="19" width="2" height="9" fill="currentColor" />
            </svg>
            <span className="marca-texto">
              <strong>Orden del día</strong>
              <small>ATM Espectaculares</small>
            </span>
          </NavLink>
          <nav className="nav" aria-label="Principal">
            <NavLink to="/" end className={() => (pathname === '/' || pathname.startsWith('/pendientes') ? 'activo' : '')}>
              <ClipboardList size={18} aria-hidden /> <span>Pendientes</span>
            </NavLink>
            <NavLink to="/minutas"><NotebookPen size={18} aria-hidden /> <span>Minutas</span></NavLink>
            <NavLink to="/ajustes" aria-label="Ajustes"><Settings size={18} aria-hidden /> <span className="solo-ancho">Ajustes</span></NavLink>
          </nav>
        </div>
      </header>
      <main className="contenido">
        <Outlet />
      </main>
      <Sugerencias />
    </div>
  );
}
