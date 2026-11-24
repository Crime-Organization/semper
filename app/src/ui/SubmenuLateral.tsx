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
  children: ReactNode;
}

export function SubmenuLateral({ id, icone, rotulo, caminhos, para, children }: Props) {
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

  // A seta de abrir (#435) fica na coluna dos "+" dos módulos, com o meio no eixo deles (como o número de Mensagens). Por isso a
  // linha do submenu não tem "+": o cadastro, quando há (o "Novo compromisso" da Agenda), é uma opção do submenu.
  return <div className="nav-grupo">
    <button type="button" aria-expanded={aberto} aria-controls={painel} onClick={alternar}>
      <Icone nome={icone} /><span>{rotulo}</span>
      <span className="nav-coluna-do-mais nav-seta"><Icone nome={aberto ? 'acima' : 'abaixo'} tam={ICONE_DA_SETA} /></span>
    </button>
    <div id={painel} className="nav-sub" hidden={!aberto}>{children}</div>
  </div>;
}
