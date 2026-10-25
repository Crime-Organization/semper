import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fonte Lato servida pelo próprio site (sem chamar o Google: nada do visitante sai para terceiros).
import '@fontsource/lato/300.css';
import '@fontsource/lato/400.css';
import '@fontsource/lato/400-italic.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import './estilo.css';
import { App } from './App';
import { aplicarCoresDaMarca } from './ui/tema';

aplicarCoresDaMarca();
createRoot(document.getElementById('raiz')!).render(<StrictMode><App /></StrictMode>);
