// Quem da equipe está num item (participantes da tarefa e do compromisso, colaboradores da demanda e do processo,
// responsáveis da pessoa), no modelo de "Pessoas ligadas": aparecem só os escolhidos, cada um com o "X" para tirar, e o
// botão de adicionar abre uma busca que mostra só quem da equipe ativa ainda pode entrar. Assim a tela não lista o nome
// de todo o escritório o tempo todo (#282).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { Membro } from '../dados/tipos';
import { candidatosDaEquipe } from '../regras/equipe';
import { Avatar } from './Avatar';
import { estiloBotao, Nota } from './base';
import { Icone } from './Icone';

/** Tamanho da bolinha ao lado de cada nome escolhido. */
const BOLINHA = 24;

interface Props {
  /** O nome da lista: "Participantes", "Colaboradores"… */
  rotulo: string;
  dica?: ReactNode;
  erro?: string;
  equipe: Membro[];
  /** Os ids de quem já está na lista, na ordem em que entraram. */
  escolhidos: string[];
  /** Quem não pode entrar além dos escolhidos (o responsável, que já está no item por outro caminho). */
  fora?: string[];
  aoMudar: (ids: string[]) => void;
  /** O texto do botão: "Adicionar participante". */
  adicionar: string;
}

export function EscolhaDaEquipe({ rotulo, dica, erro, equipe, escolhidos, fora = [], aoMudar, adicionar }: Props) {
  const id = useId();
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState('');
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const grupo = useRef<HTMLDivElement>(null);

  const jaNaLista = [...escolhidos, ...fora];
  const podemEntrar = candidatosDaEquipe(equipe, '', jaNaLista);
  const achados = candidatosDaEquipe(equipe, termo, jaNaLista);

  // Depois de mudar a lista, o foco vai ao botão de adicionar ou, se não sobrou ninguém para entrar, ao grupo: o teclado não se perde.
  const focarDepois = () => setTimeout(() => (botao.current ?? grupo.current)?.focus(), 0);
  function fechar() {
    setBuscando(false);
    setTermo('');
    focarDepois();
  }
  const incluir = (m: Membro) => { aoMudar([...escolhidos, m.id]); fechar(); };
  const tirar = (x: string) => { aoMudar(escolhidos.filter(e => e !== x)); focarDepois(); };

  useEffect(() => { if (buscando) campo.current?.focus(); }, [buscando]);
  useEffect(() => {
    if (!buscando) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) { setBuscando(false); setTermo(''); } };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [buscando]);

  const membro = (x: string) => equipe.find(m => m.id === x);
  return <div ref={grupo} tabIndex={-1} className={'pergunta' + (erro ? ' erro' : '')} role="group" aria-labelledby={id + 'r'}>
    <span className="rot" id={id + 'r'}>{rotulo}</span>
    {dica && <p className="dica" id={id + 'd'}>{dica}</p>}
    {escolhidos.length > 0 && <ul className="equipe-escolhida" aria-labelledby={id + 'r'}>
      {escolhidos.map(x => {
        const m = membro(x), nome = m?.nome || 'Usuário removido';
        return <li key={x} className="escolhida">
          <span><span aria-hidden="true"><Avatar p={m ?? { id: x, nome }} tam={BOLINHA} /></span><span className="nome">{nome}{m?.ativo === false ? ' (desativado)' : ''}</span></span>
          <button type="button" className="icone-btn" aria-label={`Tirar ${nome}`} title={`Tirar ${nome}`} onClick={() => tirar(x)}>
            <Icone nome="fechar" tam={15} />
          </button>
        </li>;
      })}
    </ul>}
    {buscando
      ? <div className="busca-equipe" ref={raiz} onBlur={e => {
        // Saindo da busca pelo teclado (Tab), ela fecha, para a lista não ficar aberta por cima dos campos seguintes. Sem
        // destino (clique na barra de rolagem da lista, ou no Safari, que não dá foco ao botão clicado), fica aberta: o
        // clique fora já fecha pelo mousedown.
        const destino = e.relatedTarget as Node | null;
        if (destino && !raiz.current?.contains(destino)) { setBuscando(false); setTermo(''); }
      }}>
        <input ref={campo} type="text" aria-label={`Buscar na equipe: ${adicionar.toLowerCase()}`} aria-describedby={dica ? id + 'd' : undefined}
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
              <span className="com-bolinha"><span aria-hidden="true"><Avatar p={m} tam={BOLINHA} /></span><b>{m.nome}</b></span>
            </button></li>)
            : <li className="nota sem-achados">Ninguém da equipe com esse nome.</li>}
        </ul>
      </div>
      : podemEntrar.length
        ? <div><button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setBuscando(true)}>
          <Icone nome="mais" tam={13} /> {adicionar}
        </button></div>
        : <Nota>Não há mais ninguém na equipe.</Nota>}
    {erro && <span className="msg-erro" role="alert">{erro}</span>}
  </div>;
}
