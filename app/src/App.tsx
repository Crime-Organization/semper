// Rotas do SEMPER. Cada tela é baixada só quando alguém a abre.
// Os endereços são os mesmos do site antigo (os links dos e-mails e os favoritos continuam valendo).
// Os cadastros novos (pessoa, contrato, demanda, tarefa), abertos de dentro do sistema, aparecem numa janela no meio da
// tela, sobre a página de onde se veio; abertos direto pelo endereço (ou numa aba nova), aparecem como página.
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router';
import { Avisos, sinalizarMudanca } from './ui/avisos';
import { Carregando } from './ui/base';
import { PainelCartao } from './ui/PainelCartao';
import { Janelas } from './ui/janela';
import { ExigirLogin } from './ui/sessao';
import { AvisoDeVersaoNova } from './ui/versaoNova';

const Home = lazy(() => import('./paginas/Home'));
const Entrada = lazy(() => import('./paginas/Entrada'));
const Inicio = lazy(() => import('./paginas/Inicio'));
const Pessoas = lazy(() => import('./paginas/Pessoas'));
const NovaPessoa = lazy(() => import('./paginas/NovaPessoa'));
const ImportarPessoas = lazy(() => import('./paginas/ImportarPessoas'));
const Contratos = lazy(() => import('./paginas/Contratos'));
const NovoContrato = lazy(() => import('./paginas/NovoContrato'));
const Demandas = lazy(() => import('./paginas/Demandas'));
const Processos = lazy(() => import('./paginas/Processos'));
const Financeiro = lazy(() => import('./paginas/Financeiro'));
const PainelProcessos = lazy(() => import('./paginas/PainelProcessos'));
const NovoProcesso = lazy(() => import('./paginas/NovoProcesso'));
const Compromissos = lazy(() => import('./paginas/Compromissos'));
const NovoCompromisso = lazy(() => import('./paginas/NovoCompromisso'));
const NovaDemanda = lazy(() => import('./paginas/NovaDemanda'));
const ModelosDeLista = lazy(() => import('./paginas/ModelosDeLista'));
const Tarefas = lazy(() => import('./paginas/Tarefas'));
const MeuTempo = lazy(() => import('./paginas/MeuTempo'));
const NovaTarefa = lazy(() => import('./paginas/NovaTarefa'));
const Equipe = lazy(() => import('./paginas/Equipe'));
const PerfilDaEquipe = lazy(() => import('./paginas/PerfilDaEquipe'));
const MinhaConta = lazy(() => import('./paginas/MinhaConta'));
const Configuracoes = lazy(() => import('./paginas/Configuracoes'));
const Calendario = lazy(() => import('./paginas/Calendario'));

// Os formulários recomeçam do zero a cada vez que são abertos (mesmo clicando no "+" de dentro deles).
function FormularioPessoa() {
  const { key } = useLocation();
  return <NovaPessoa key={key} />;
}
function FormularioImportacao() {
  const { key } = useLocation();
  return <ImportarPessoas key={key} />;
}
function FormularioContrato() {
  const { key } = useLocation();
  return <NovoContrato key={key} />;
}
function FormularioDemanda() {
  const { key } = useLocation();
  return <NovaDemanda key={key} />;
}
function FormularioProcesso() {
  const { key } = useLocation();
  return <NovoProcesso key={key} />;
}
function FormularioCompromisso() {
  const { key } = useLocation();
  return <NovoCompromisso key={key} />;
}
function FormularioTarefa() {
  const { key } = useLocation();
  return <NovaTarefa key={key} />;
}

/** Os cadastros novos (e a importação de pessoas): cada endereço, o formulário dele e o nome da janela (padrão: "Cadastro"). */
const CADASTROS: [caminho: string, Formulario: () => React.JSX.Element, rotulo?: string][] = [
  ['pessoas/nova', FormularioPessoa], ['pessoas/importar', FormularioImportacao, 'Importar pessoas'], ['contratos/novo', FormularioContrato],
  ['demandas/nova', FormularioDemanda], ['tarefas/nova', FormularioTarefa], ['processos/novo', FormularioProcesso], ['agenda/novo', FormularioCompromisso]
];
/** O caminho sem as barras das pontas ("/pessoas/nova/" → "pessoas/nova"). */
const semBarras = (caminho: string) => caminho.replace(/^\/+|\/+$/g, '');
const cadastroDe = (caminho: string) => CADASTROS.find(([c]) => semBarras(caminho) === c);
const ehCadastro = (caminho: string) => !!cadastroDe(caminho);
/** Páginas de fora do sistema (sem login): delas, o cadastro não abre em janela. */
const FORA_DO_SISTEMA = ['', 'entrar'];
const dentroDoSistema = (l: Location) => !FORA_DO_SISTEMA.includes(semBarras(l.pathname));

function Rotas() {
  const local = useLocation();
  const navegar = useNavigate();
  // A última página de fora dos cadastros por onde se passou: é o que fica ao fundo da janela do cadastro.
  const [fundo, setFundo] = useState<Location | null>(null);
  const cadastro = ehCadastro(local.pathname);
  if (!cadastro && fundo !== local) setFundo(local);
  const naJanela = cadastro && !!fundo && dentroDoSistema(fundo);
  // Ao fechar a janela (salvou ou desistiu), a página de fundo recarrega o que mostra e volta ao título dela.
  const titulo = useRef<string | null>(null);
  useEffect(() => {
    if (naJanela) { titulo.current = document.title; return; }
    if (titulo.current === null) return;
    document.title = titulo.current;
    titulo.current = null;
    sinalizarMudanca();
  }, [naJanela]);

  // A janela fica dentro de <ExigirLogin> (precisa de quem está logado). As rotas dela usam o endereço de verdade: as
  // de fora usam o da página de fundo.
  const janela = naJanela && <PainelCartao soNoCentro rotulo={cadastroDe(local.pathname)?.[2]} aoFechar={() => navegar(-1)}>
    <Suspense fallback={<Carregando />}>
      <Routes location={local}>{CADASTROS.map(([caminho, Formulario]) => <Route key={caminho} path={caminho} element={<Formulario />} />)}</Routes>
    </Suspense>
  </PainelCartao>;

  return <>
    <Suspense fallback={null}>
      <Routes location={naJanela ? fundo! : local}>
        <Route path="/" element={<Home />} />
        <Route path="entrar" element={<Entrada />} />
        <Route element={<ExigirLogin janela={janela} />}>
          <Route path="inicio" element={<Inicio />} />
          <Route path="pessoas" element={<Pessoas />} />
          <Route path="contratos" element={<Contratos />} />
          <Route path="demandas" element={<Demandas />} />
          <Route path="modelos-de-lista" element={<ModelosDeLista />} />
          <Route path="tarefas" element={<Tarefas />} />
          <Route path="tarefas/meu-tempo" element={<MeuTempo />} />
          {/* Cada tipo tem o seu quadro: a chave faz a página começar de novo ao trocar. "Processos" abre o painel. */}
          <Route path="processos" element={<PainelProcessos />} />
          <Route path="processos/judicial" element={<Processos key="judicial" tipo="judicial" />} />
          <Route path="processos/administrativo" element={<Processos key="administrativo" tipo="administrativo" />} />
          <Route path="agenda" element={<Compromissos />} />
          <Route path="financeiro" element={<Financeiro />} />
          <Route path="calendario" element={<Calendario />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="equipe/perfil" element={<PerfilDaEquipe />} />
          <Route path="minha-conta" element={<MinhaConta />} />
          <Route path="configuracoes" element={<Configuracoes />} />
          {CADASTROS.map(([caminho, Formulario]) => <Route key={caminho} path={caminho} element={<Formulario />} />)}
        </Route>
        <Route path="*" element={<Navigate to="/inicio/" replace />} />
      </Routes>
    </Suspense>
  </>;
}

export function App() {
  return <BrowserRouter>
    <Rotas />
    <Janelas />
    <Avisos><AvisoDeVersaoNova /></Avisos>
  </BrowserRouter>;
}
