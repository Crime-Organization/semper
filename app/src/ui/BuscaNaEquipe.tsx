// O botão "+ Adicionar…" que abre uma busca só na equipe (#282). É a metade de baixo de EscolhaDaEquipe e também a busca de
// participantes do contrato (#348), onde cada escolhido ganha uma linha com o seu %: quem usa diz quem a busca acha
// (`buscar`) e o que fazer com quem foi escolhido (`aoEscolher`). No topo dos cartões (#356), o botão é a bolinha redonda
// com "+", ao lado das bolinhas da equipe, e a busca abre por cima, presa a ela (`bolinha`).
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Membro } from '../dados/tipos';
import { Avatar } from './Avatar';
import { estiloBotao, Nota } from './base';
import { Icone } from './Icone';
import { MenuFlutuante } from './Menu';

/** Tamanho da bolinha ao lado de cada nome da equipe: na busca, na lista de escolhidos (EscolhaDaEquipe) e nas linhas dos
 * participantes do contrato. Um número só, para as bolinhas da busca e da lista terem o mesmo tamanho. */
export const BOLINHA_DA_EQUIPE = 24;
/** Tamanho do "+" dentro da bolinha redonda do topo do cartão. */
const MAIS_NA_BOLINHA = 16;
/** Quando já estão todos da equipe ativa: no lugar do botão de adicionar, e na dica da bolinha "+" desligada. */
const NINGUEM_MAIS = 'Não há mais ninguém na equipe.';

interface Props {
  /** Quem da equipe a busca acha com o que foi digitado (sem nada digitado, todos os que ainda podem entrar). */
  buscar: (termo: string) => Membro[];
  aoEscolher: (m: Membro) => void;
  /** O texto do botão: "Adicionar participante". */
  adicionar: string;
  /** O id da dica da lista, lida junto com o campo de busca. */
  descricao?: string;
  /** O botão de adicionar, para quem usa poder levar o foco a ele (depois de tirar alguém da lista). */
  botao?: RefObject<HTMLButtonElement | null>;
  /** Para onde vai o foco ao fechar a busca se o botão sumiu (não sobrou ninguém para entrar). */
  focoReserva?: RefObject<HTMLElement | null>;
  /** Para onde vai o foco depois de escolher (o % do participante novo, no contrato); sem isto, volta ao botão. */
  focarAoEscolher?: (m: Membro) => void;
  /** O botão fica desligado (a lista chegou ao máximo). */
  desligado?: boolean;
  /**
   * O botão é a bolinha redonda com "+" do topo do cartão (#356), do tamanho das bolinhas da equipe, e a busca abre num painel
   * por cima dela. `motivoDesligado` diz, na dica do botão desligado, por que não dá para pôr mais ninguém. Sem ninguém que
   * ainda possa entrar, a bolinha fica desligada, com isso na dica. Desligada, ela continua no Tab (aria-disabled), para o foco
   * não se perder quando a pessoa acabou de tirar alguém e o cartão ainda grava.
   */
  bolinha?: { tamanho: number; motivoDesligado?: string };
}

export function BuscaNaEquipe({ buscar, aoEscolher, adicionar, descricao, botao: botaoDeFora, focoReserva, focarAoEscolher, desligado, bolinha }: Props) {
  // Na bolinha, a busca aberta fica presa ao botão que a abriu (o painel por cima); no botão "+ Adicionar…", ela toma o lugar dele.
  const [aberta, setAberta] = useState<HTMLElement | null>(null);
  const botaoProprio = useRef<HTMLButtonElement>(null);
  const botao = botaoDeFora ?? botaoProprio;

  const podemEntrar = buscar('');

  // Ao fechar a busca, o foco vai ao botão de adicionar ou, se não sobrou ninguém para entrar, ao lugar de reserva: o teclado não se perde.
  const focarDepois = () => setTimeout(() => (botao.current ?? focoReserva?.current)?.focus(), 0);
  function fechar() {
    setAberta(null);
    focarDepois();
  }
  function incluir(m: Membro) {
    aoEscolher(m);
    setAberta(null);
    if (focarAoEscolher) setTimeout(() => focarAoEscolher(m), 0); else focarDepois();
  }

  if (bolinha) {
    const motivo = desligado ? bolinha.motivoDesligado : podemEntrar.length ? undefined : NINGUEM_MAIS;
    const desligada = !!desligado || !podemEntrar.length;
    return <>
      <button ref={botao} type="button" className="equipe-mais" style={{ width: bolinha.tamanho, height: bolinha.tamanho }} aria-label={adicionar}
        title={motivo ?? adicionar} aria-description={motivo} aria-haspopup="dialog" aria-expanded={!!aberta} aria-disabled={desligada || undefined}
        onClick={e => { if (desligada) return; const alvo = e.currentTarget; setAberta(a => a ? null : alvo); }}>
        <Icone nome="mais" tam={MAIS_NA_BOLINHA} />
      </button>
      {/* O painel fecha sozinho no clique fora e no Esc (que devolve o foco à bolinha); sair dele pelo Tab também a devolve. */}
      {aberta && <MenuFlutuante botao={aberta} painel rotulo={adicionar} aoFechar={() => setAberta(null)}>
        <div className="pergunta"><CaixaDaBusca buscar={buscar} adicionar={adicionar} descricao={descricao} aoEscolher={incluir} aoFechar={fechar} aoSair={fechar} /></div>
      </MenuFlutuante>}
    </>;
  }

  if (!aberta) return podemEntrar.length
    ? <div><button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} disabled={desligado} onClick={e => setAberta(e.currentTarget)}>
      <Icone nome="mais" tam={13} /> {adicionar}
    </button></div>
    : <Nota>{NINGUEM_MAIS}</Nota>;

  return <CaixaDaBusca buscar={buscar} adicionar={adicionar} descricao={descricao} aoEscolher={incluir} aoFechar={fechar} aoSair={() => setAberta(null)} fecharAoClicarFora />;
}

interface PropsDaCaixa {
  buscar: (termo: string) => Membro[];
  adicionar: string;
  descricao?: string;
  aoEscolher: (m: Membro) => void;
  /** Esc: fecha e devolve o foco ao botão. */
  aoFechar: () => void;
  /** A pessoa saiu da busca (Tab para fora, ou clique fora). */
  aoSair: () => void;
  /** Fecha com o clique fora dela (no painel da bolinha, quem fecha é o próprio painel). */
  fecharAoClicarFora?: boolean;
}

/** O campo de busca e a lista dos achados, com o teclado: Enter escolhe o primeiro, as setas andam na lista, Esc fecha. */
function CaixaDaBusca({ buscar, adicionar, descricao, aoEscolher, aoFechar, aoSair, fecharAoClicarFora = false }: PropsDaCaixa) {
  const [termo, setTermo] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const sair = useRef(aoSair);
  sair.current = aoSair;
  const achados = buscar(termo);

  useEffect(() => { campo.current?.focus(); }, []);
  useEffect(() => {
    if (!fecharAoClicarFora) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) sair.current(); };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [fecharAoClicarFora]);

  return <div className="busca-equipe" ref={raiz} onBlur={e => {
    // Saindo da busca pelo teclado (Tab), ela fecha, para a lista não ficar aberta por cima dos campos seguintes. Sem
    // destino (clique na barra de rolagem da lista, ou no Safari, que não dá foco ao botão clicado), fica aberta: o
    // clique fora já fecha.
    const destino = e.relatedTarget as Node | null;
    if (destino && !raiz.current?.contains(destino)) aoSair();
  }}>
    <input ref={campo} type="text" aria-label={`Buscar na equipe: ${adicionar.toLowerCase()}`} aria-describedby={descricao}
      placeholder="Digite o nome" autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Esc fecha só a busca (sem fechar o cartão em volta); Enter escolhe o primeiro achado (e não avança o formulário);
        // a seta para baixo leva à lista.
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); aoFechar(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>('.achados button')?.focus(); return; }
        if (e.key !== 'Enter') return;
        // O Enter fica aqui: nenhum formulário em volta deve tratá-lo (o de pessoa, por exemplo, passaria ao próximo campo).
        e.preventDefault();
        e.stopPropagation();
        if (achados[0]) aoEscolher(achados[0]);
      }} />
    <ul className="achados" aria-label="Equipe" onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); aoFechar(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.achados button') ?? [])];
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
    }}>
      {achados.length
        ? achados.map(m => <li key={m.id}><button type="button" onClick={() => aoEscolher(m)}>
          {/* A bolinha é só para os olhos: o leitor de tela lê o nome uma vez. */}
          <span className="com-bolinha"><span aria-hidden="true"><Avatar p={m} tam={BOLINHA_DA_EQUIPE} /></span><b>{m.nome}</b></span>
        </button></li>)
        : <li className="nota sem-achados">Ninguém da equipe com esse nome.</li>}
    </ul>
  </div>;
}
