// O "+" ao lado de um módulo no menu lateral: leva ao cadastro sem abrir o módulo. O cadastro abre por cima da tela onde a pessoa
// está, e o "+" guarda o endereço dela no estado da navegação (#404): o cadastro que sabe voltar (o de compromisso) volta para lá
// depois de gravar.
import { Link, useLocation } from 'react-router';
import { estadoDaVolta } from '../regras/origemDoCadastro';
import { Icone } from './Icone';

/** Tamanho do "+" ao lado de cada módulo, que leva ao cadastro (e do ícone da casinha do Início, que é uma bolinha igual, #435). */
export const ICONE_DO_MAIS = 15;

interface Props {
  /** O endereço do cadastro. */
  para: string;
  /** O nome do botão e a dica (ex.: "Cadastrar pessoa"); com `comTexto`, o texto à vista (ex.: "Novo compromisso"). */
  rotulo: string;
  /** Mostra o rótulo ao lado do "+", como uma opção de submenu (o "Novo compromisso" da Agenda, #435), em vez da bolinha. */
  comTexto?: boolean;
}

export function MaisDoMenu({ para, rotulo, comTexto = false }: Props) {
  const { pathname, search, hash } = useLocation();
  const volta = estadoDaVolta(pathname + search + hash);
  if (comTexto) return <Link className="nav-novo" to={para} state={volta}>
    <Icone nome="mais" tam={ICONE_DO_MAIS} /><span>{rotulo}</span>
  </Link>;
  return <Link className="nav-mais" to={para} state={volta} aria-label={rotulo} title={rotulo}>
    <Icone nome="mais" tam={ICONE_DO_MAIS} />
  </Link>;
}
