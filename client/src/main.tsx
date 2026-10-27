import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProveedorApp } from './contexto.tsx';
import { Marco } from './components/Marco.tsx';
import { Tablero } from './pages/Tablero.tsx';
import { Minutas } from './pages/Minutas.tsx';
import { Minuta } from './pages/Minuta.tsx';
import { Ajustes } from './pages/Ajustes.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ProveedorApp>
        <Routes>
          <Route element={<Marco />}>
            <Route index element={<Tablero />} />
            <Route path="pendientes/:id" element={<Tablero />} />
            <Route path="minutas" element={<Minutas />} />
            <Route path="minutas/:id" element={<Minuta />} />
            <Route path="ajustes" element={<Ajustes />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ProveedorApp>
    </BrowserRouter>
  </StrictMode>,
);
