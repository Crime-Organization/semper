// Rotas do SEMPER. Cada tela é baixada só quando alguém a abre.
// Os endereços são os mesmos do site antigo (os links dos e-mails e os favoritos continuam valendo).
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Avisos } from './ui/avisos';
import { Janelas } from './ui/janela';
import { ExigirLogin } from './ui/sessao';

const Entrada = lazy(() => import('./paginas/Entrada'));
const Inicio = lazy(() => import('./paginas/Inicio'));
const Pessoas = lazy(() => import('./paginas/Pessoas'));
const NovaPessoa = lazy(() => import('./paginas/NovaPessoa'));
const Equipe = lazy(() => import('./paginas/Equipe'));

// O formulário recomeça do zero a cada vez que é aberto (mesmo clicando no "+" de dentro dele).
function FormularioPessoa() {
  const { key } = useLocation();
  return <NovaPessoa key={key} />;
}

export function App() {
  return <BrowserRouter>
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Entrada />} />
        <Route element={<ExigirLogin />}>
          <Route path="inicio" element={<Inicio />} />
          <Route path="pessoas" element={<Pessoas />} />
          <Route path="pessoas/nova" element={<FormularioPessoa />} />
          <Route path="equipe" element={<Equipe />} />
        </Route>
        <Route path="*" element={<Navigate to="/inicio/" replace />} />
      </Routes>
    </Suspense>
    <Janelas />
    <Avisos />
  </BrowserRouter>;
}
