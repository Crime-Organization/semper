// Submenu recolhível do menu lateral (ex.: "Agenda e calendário"): um botão que mostra ou esconde as opções dele.
// Aberto ou fechado é escolha de cada pessoa, guardada no perfil. Ao entrar numa tela do submenu, ele abre sozinho, para
// a pessoa ver onde está; dali, ainda pode fechá-lo.
import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Icone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';

/** Tamanho da seta de abrir e recolher, menor que o ícone do item, para não competir com ele. */
const ICONE_DA_SETA = 14;

interface Props {
  /** Nome curto e fixo, para guardar a escolha da pessoa (ex.: "agenda"). */
  id: string;
  icone: ComponentProps<typeof Icone>['nome'];
  rotulo: string;
  /** Os endereços das telas que ficam dentro do submenu (ex.: ["/calendario"]). */
  caminhos: string[];
  /** A tela do próprio item (ex.: o painel de Processos): clicar nele leva a ela, e só recolhe quando já está nela. */
  para?: string;
  /** O "+" da linha (ex.: o de cadastrar compromisso, #404): ao lado do botão, na coluna dos "+" dos outros módulos, e à vista com
   *  o submenu aberto ou fechado. */
  mais?: ReactNode;
  children: ReactNode;
}

export function SubmenuLateral({ id, icone, rotulo, caminhos, para, mais, children }: Props) {
  const chave = `menu.${id}.aberto`;
  const painel = useId();
  const { pathname } = useLocation();
  const navegar = useNavigate();
  const dentro = caminhos.some(c => pathname.startsWith(c));
  const [aberto, setAberto] = useState(() => lerPreferencia(chave, false));
  // Entrou numa tela do submenu agora: abre (sem mudar a escolha guardada).
  const [estavaDentro, setEstavaDentro] = useState(false);
  if (dentro !== estavaDentro) {
    setEstavaDentro(dentro);
    if (dentro) setAberto(true);
  }

  function alternar() {
    if (para && pathname.replace(/\/$/, '') !== para.replace(/\/$/, '')) { navegar(para); return; }
    setAberto(!aberto);
    salvarPreferencia(chave, !aberto);
  }

  // A seta de abrir (#435): sem "+" na linha, fica na coluna dos "+" dos módulos, com o meio no eixo deles (como o número de
  // Mensagens); com o "+", fica logo antes dele, porque a coluna é do "+".
  const seta = <Icone nome={aberto ? 'acima' : 'abaixo'} tam={ICONE_DA_SETA} />;
  const botao = <button type="button" aria-expanded={aberto} aria-controls={painel} onClick={alternar}>
    <Icone nome={icone} /><span>{rotulo}</span>
    <span className={'nav-seta' + (mais ? '' : ' nav-coluna-do-mais')}>{seta}</span>
  </button>;
  return <div className="nav-grupo">
    {mais ? <div className="nav-linha">{botao}{mais}</div> : botao}
    <div id={painel} className="nav-sub" hidden={!aberto}>{children}</div>
  </div>;
}
