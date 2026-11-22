// O "+" ao lado de um módulo no menu lateral: leva ao cadastro sem abrir o módulo. O cadastro abre por cima da tela onde a pessoa
// está, e o "+" guarda o endereço dela no estado da navegação (#404): o cadastro que sabe voltar (o de compromisso) volta para lá
// depois de gravar.
import { Link, useLocation } from 'react-router';
import { estadoDaVolta } from '../regras/origemDoCadastro';
import { Icone } from './Icone';

/** Tamanho do "+" ao lado de cada módulo, que leva ao cadastro. */
const ICONE_DO_MAIS = 15;

/** O "+" de um módulo: `para` é o endereço do cadastro e `rotulo`, o nome do botão e a dica (ex.: "Cadastrar pessoa"). */
export function MaisDoMenu({ para, rotulo }: { para: string; rotulo: string }) {
  const { pathname, search, hash } = useLocation();
  return <Link className="nav-mais" to={para} state={estadoDaVolta(pathname + search + hash)} aria-label={rotulo} title={rotulo}>
    <Icone nome="mais" tam={ICONE_DO_MAIS} />
  </Link>;
}
