// Rotas do SEMPER. Cada tela é baixada só quando alguém a abre.
// Os endereços são os mesmos do site antigo (os links dos e-mails e os favoritos continuam valendo).
import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { Avisos } from './ui/avisos';
import { Janelas } from './ui/janela';
import { ExigirLogin } from './ui/sessao';

const Home = lazy(() => import('./paginas/Home'));
const Entrada = lazy(() => import('./paginas/Entrada'));
const Inicio = lazy(() => import('./paginas/Inicio'));
const Pessoas = lazy(() => import('./paginas/Pessoas'));
const NovaPessoa = lazy(() => import('./paginas/NovaPessoa'));
const Contratos = lazy(() => import('./paginas/Contratos'));
const NovoContrato = lazy(() => import('./paginas/NovoContrato'));
const Demandas = lazy(() => import('./paginas/Demandas'));
const NovaDemanda = lazy(() => import('./paginas/NovaDemanda'));
const ModelosDeLista = lazy(() => import('./paginas/ModelosDeLista'));
const Tarefas = lazy(() => import('./paginas/Tarefas'));
const NovaTarefa = lazy(() => import('./paginas/NovaTarefa'));
const Equipe = lazy(() => import('./paginas/Equipe'));
const Configuracoes = lazy(() => import('./paginas/Configuracoes'));

// Os formulários recomeçam do zero a cada vez que são abertos (mesmo clicando no "+" de dentro deles).
function FormularioPessoa() {
  const { key } = useLocation();
  return <NovaPessoa key={key} />;
}
function FormularioContrato() {
  const { key } = useLocation();
  return <NovoContrato key={key} />;
}
function FormularioDemanda() {
  const { key } = useLocation();
  return <NovaDemanda key={key} />;
}
function FormularioTarefa() {
  const { key } = useLocation();
  return <NovaTarefa key={key} />;
}

export function App() {
  return <BrowserRouter>
    <Suspense fallback={null}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="entrar" element={<Entrada />} />
        <Route element={<ExigirLogin />}>
          <Route path="inicio" element={<Inicio />} />
          <Route path="pessoas" element={<Pessoas />} />
          <Route path="pessoas/nova" element={<FormularioPessoa />} />
          <Route path="contratos" element={<Contratos />} />
          <Route path="contratos/novo" element={<FormularioContrato />} />
          <Route path="demandas" element={<Demandas />} />
          <Route path="demandas/nova" element={<FormularioDemanda />} />
          <Route path="modelos-de-lista" element={<ModelosDeLista />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="tarefas/nova" element={<FormularioTarefa />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="configuracoes" element={<Configuracoes />} />
        </Route>
        <Route path="*" element={<Navigate to="/inicio/" replace />} />
      </Routes>
    </Suspense>
    <Janelas />
    <Avisos />
  </BrowserRouter>;
}
