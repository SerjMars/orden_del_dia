import { useCallback, useEffect, useState } from 'react';

export class ApiError extends Error {}

export async function api<T = unknown>(ruta: string, opciones: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${ruta}`, {
    method: opciones.method ?? (opciones.body ? 'POST' : 'GET'),
    headers: opciones.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  if (res.status === 204) return undefined as T;
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(datos.error ?? `Error ${res.status}`);
  return datos as T;
}

/** Carga un recurso y expone `recargar` para refrescarlo tras una edición. */
export function useRecurso<T>(ruta: string | null) {
  const [datos, setDatos] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  const recargar = useCallback(async () => {
    if (!ruta) return;
    try {
      setDatos(await api<T>(ruta));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [ruta]);

  useEffect(() => { setCargando(true); void recargar(); }, [recargar]);
  return { datos, error, cargando, recargar, setDatos };
}
