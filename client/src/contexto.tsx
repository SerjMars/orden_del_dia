import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { Catalogos } from '../../shared/model.ts';
import { useRecurso } from './api.ts';

interface Ctx {
  catalogos: Catalogos;
  recargarCatalogos: () => Promise<void>;
  avisar: (mensaje: string, tipo?: 'ok' | 'error') => void;
}

const Contexto = createContext<Ctx | null>(null);

export function ProveedorApp({ children }: { children: ReactNode }) {
  const { datos, error, recargar } = useRecurso<Catalogos>('/catalogos');
  const [avisos, setAvisos] = useState<{ id: number; mensaje: string; tipo: 'ok' | 'error' }[]>([]);
  const sig = useRef(0);

  const avisar = useCallback((mensaje: string, tipo: 'ok' | 'error' = 'ok') => {
    const id = ++sig.current;
    setAvisos((a) => [...a, { id, mensaje, tipo }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 6000 : 3000);
  }, []);

  if (error) return <div className="pantalla-estado">No se pudo conectar con el servidor: {error}</div>;
  if (!datos) return <div className="pantalla-estado">Cargando…</div>;

  return (
    <Contexto.Provider value={{ catalogos: datos, recargarCatalogos: recargar, avisar }}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => <div key={a.id} className={`aviso aviso-${a.tipo}`}>{a.mensaje}</div>)}
      </div>
    </Contexto.Provider>
  );
}

export function useApp() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useApp fuera de ProveedorApp');
  return c;
}
