# Orden del día

Plataforma para dar seguimiento a pendientes de trabajo, sus avances parciales y los compromisos del personal responsable, en las sucursales de ATM Espectaculares.

## Pantallas

- **Pendientes** (`/`): indicadores que funcionan como vistas rápidas (abiertos, atrasados, vencen en 7 días, concluidos en 30 días), búsqueda y filtros por sucursal, responsable y estatus (se guardan en la URL), filas desplegables con el último avance y los compromisos, y un panel lateral con la ficha completa: historial de avances, compromisos y detalle.
- **Minutas** (`/minutas`): al crear una reunión se arma la orden del día con los pendientes abiertos de las sucursales elegidas, agrupados por sucursal y con los más atrasados primero. En cada punto se cambia el estatus, se registran avances y compromisos (quedan ligados a la reunión), se agrega una nota y se marca como revisado. Incluye acuerdos generales, resumen de compromisos adquiridos, cierre de minuta (solo lectura) e impresión / PDF.
- **Ajustes** (`/ajustes`): catálogo de sucursales. Vienen las 6 iniciales (Aguascalientes, Bajío, Caribe, Norte, Occidente, Sureste); se pueden agregar, renombrar o desactivar.

## Datos de cada pendiente

Folio (`P-0001`), fecha de creación, fecha compromiso, fecha de conclusión, atraso (calculado), responsable, sucursal, ciudad, estado, espacio (clave de sitio o cara), dirección o alias, concepto, descripción, avances, compromisos, observaciones, estatus y prioridad.

**Atraso** = días naturales entre la fecha compromiso y la fecha de conclusión (o hoy, si sigue abierto); 0 si va a tiempo, vacío si no hay fecha compromiso o se canceló. "Hoy" se calcula en `America/Mexico_City`. Al concluir o cancelar se registra la fecha de conclusión automáticamente; al reabrir se borra.

## Tecnología

- React + TypeScript + Vite (interfaz), Express + SQLite con `better-sqlite3` (API), validación con Zod.
- Tipos y reglas compartidas en `shared/model.ts`.
- Esquema y migraciones en `server/db.ts`; la base se crea sola en `data/orden_del_dia.db` (configurable con `DB_PATH`).

## Uso

```bash
npm install
npm run seed:demo   # opcional: carga pendientes de ejemplo
npm run dev         # API en :3001 y la interfaz en http://localhost:5173
npm test            # pruebas de la API
```

Producción: `npm run build && npm start` (un solo proceso sirve API e interfaz en `PORT`, 3001 por defecto). Respaldo: copiar el archivo de la base de datos.

## Colores de marca

Todos los colores viven como variables al inicio de `client/src/styles/app.css`. `--marca` (rojo) y `--grafito` son aproximaciones: reemplázalos con los valores oficiales del manual de identidad de ATM.

## Pendiente por definir

- Inicio de sesión y permisos por usuario/sucursal (hoy no hay autenticación; debe desplegarse solo en red interna).
- Catálogo de espacios (claves de sitio/cara) para autocompletar ciudad, estado y dirección.
