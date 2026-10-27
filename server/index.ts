import { crearApp } from './app.ts';
import { abrirDB } from './db.ts';

const puerto = Number(process.env.PORT ?? 3001);
const app = crearApp(abrirDB());
app.listen(puerto, () => console.log(`Orden del día escuchando en http://localhost:${puerto}`));
