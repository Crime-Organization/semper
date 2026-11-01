// Submenu recolhível do menu lateral (ex.: "Agenda e calendário"): um botão que mostra ou esconde as opções dele.
// Aberto ou fechado é escolha de cada pessoa, guardada no perfil. Ao entrar numa tela do submenu, ele abre sozinho, para
// a pessoa ver onde está; dali, ainda pode fechá-lo.
import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { Icone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';

interface Props {
  /** Nome curto e fixo, para guardar a escolha da pessoa (ex.: "agenda"). */
  id: string;
  icone: ComponentProps<typeof Icone>['nome'];
  rotulo: string;
  /** Os endereços das telas que ficam dentro do submenu (ex.: ["/calendario"]). */
  caminhos: string[];
  children: ReactNode;
}

export function SubmenuLateral({ id, icone, rotulo, caminhos, children }: Props) {
  const chave = `menu.${id}.aberto`;
  const painel = useId();
  const { pathname } = useLocation();
  const dentro = caminhos.some(c => pathname.startsWith(c));
  const [aberto, setAberto] = useState(() => lerPreferencia(chave, false));
  // Entrou numa tela do submenu agora: abre (sem mudar a escolha guardada).
  const [estavaDentro, setEstavaDentro] = useState(false);
  if (dentro !== estavaDentro) {
    setEstavaDentro(dentro);
    if (dentro) setAberto(true);
  }

  function alternar() {
    setAberto(!aberto);
    salvarPreferencia(chave, !aberto);
  }

  return <div className="nav-grupo">
    <button type="button" aria-expanded={aberto} aria-controls={painel} onClick={alternar}>
      <Icone nome={icone} /><span>{rotulo}</span><Icone nome={aberto ? 'acima' : 'abaixo'} tam={14} />
    </button>
    <div id={painel} className="nav-sub" hidden={!aberto}>{children}</div>
  </div>;
}
