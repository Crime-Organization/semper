// O botão "+ Adicionar…" que abre uma busca só na equipe (#282). É a metade de baixo de EscolhaDaEquipe e também a busca de
// participantes do contrato (#348), onde cada escolhido ganha uma linha com o seu %: quem usa diz quem a busca acha
// (`buscar`) e o que fazer com quem foi escolhido (`aoEscolher`).
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Membro } from '../dados/tipos';
import { Avatar } from './Avatar';
import { estiloBotao, Nota } from './base';
import { Icone } from './Icone';

/** Tamanho da bolinha ao lado de cada nome da equipe: na busca, na lista de escolhidos (EscolhaDaEquipe) e nas linhas dos
 * participantes do contrato. Um número só, para as bolinhas da busca e da lista terem o mesmo tamanho. */
export const BOLINHA_DA_EQUIPE = 24;

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
}

export function BuscaNaEquipe({ buscar, aoEscolher, adicionar, descricao, botao: botaoDeFora, focoReserva, focarAoEscolher, desligado }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botaoProprio = useRef<HTMLButtonElement>(null);
  const botao = botaoDeFora ?? botaoProprio;

  const podemEntrar = buscar('');
  const achados = buscar(termo);

  // Ao fechar a busca, o foco vai ao botão de adicionar ou, se não sobrou ninguém para entrar, ao lugar de reserva: o teclado não se perde.
  const focarDepois = () => setTimeout(() => (botao.current ?? focoReserva?.current)?.focus(), 0);
  function fechar() {
    setBuscando(false);
    setTermo('');
    focarDepois();
  }
  function incluir(m: Membro) {
    aoEscolher(m);
    setBuscando(false);
    setTermo('');
    if (focarAoEscolher) setTimeout(() => focarAoEscolher(m), 0); else focarDepois();
  }

  useEffect(() => { if (buscando) campo.current?.focus(); }, [buscando]);
  useEffect(() => {
    if (!buscando) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) { setBuscando(false); setTermo(''); } };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [buscando]);

  if (!buscando) return podemEntrar.length
    ? <div><button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} disabled={desligado} onClick={() => setBuscando(true)}>
      <Icone nome="mais" tam={13} /> {adicionar}
    </button></div>
    : <Nota>Não há mais ninguém na equipe.</Nota>;

  return <div className="busca-equipe" ref={raiz} onBlur={e => {
    // Saindo da busca pelo teclado (Tab), ela fecha, para a lista não ficar aberta por cima dos campos seguintes. Sem
    // destino (clique na barra de rolagem da lista, ou no Safari, que não dá foco ao botão clicado), fica aberta: o
    // clique fora já fecha pelo mousedown.
    const destino = e.relatedTarget as Node | null;
    if (destino && !raiz.current?.contains(destino)) { setBuscando(false); setTermo(''); }
  }}>
    <input ref={campo} type="text" aria-label={`Buscar na equipe: ${adicionar.toLowerCase()}`} aria-describedby={descricao}
      placeholder="Digite o nome" autoComplete="off" value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Esc fecha só a busca (sem fechar o cartão em volta); Enter escolhe o primeiro achado (e não avança o formulário);
        // a seta para baixo leva à lista.
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>('.achados button')?.focus(); return; }
        if (e.key !== 'Enter') return;
        // O Enter fica aqui: nenhum formulário em volta deve tratá-lo (o de pessoa, por exemplo, passaria ao próximo campo).
        e.preventDefault();
        e.stopPropagation();
        if (achados[0]) incluir(achados[0]);
      }} />
    <ul className="achados" aria-label="Equipe" onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.achados button') ?? [])];
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
    }}>
      {achados.length
        ? achados.map(m => <li key={m.id}><button type="button" onClick={() => incluir(m)}>
          {/* A bolinha é só para os olhos: o leitor de tela lê o nome uma vez. */}
          <span className="com-bolinha"><span aria-hidden="true"><Avatar p={m} tam={BOLINHA_DA_EQUIPE} /></span><b>{m.nome}</b></span>
        </button></li>)
        : <li className="nota sem-achados">Ninguém da equipe com esse nome.</li>}
    </ul>
  </div>;
}
