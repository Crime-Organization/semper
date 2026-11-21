// Ligar a um cartão um item que já existe (#341), peça comum a todas as seções de itens ligados: o botão abre uma busca por cima
// do que vem abaixo, como LigarProcesso e LigarItem, e a lista mostra o que a seção oferece. Quem usa diz como buscar (a camada de
// dados já tira o que não se pode ligar: arquivado, já ligado, sem permissão), como mostrar cada achado (o título, o detalhe e,
// se ele não pode ser escolhido, o motivo, que aparece no lugar do detalhe) e o que fazer ao escolher. Sem nada digitado,
// aparecem os mais recentes. No cartão só para ler (ou arquivado), a peça não aparece.
import { useEffect, useId, useRef, useState } from 'react';
import { falha } from './avisos';
import { estiloBotao, Nota } from './base';
import { Icone, type NomeIcone } from './Icone';
import { useAtrasado } from './util';

/** Como cada achado aparece na lista. */
export interface AchadoParaLigar {
  id: string;
  titulo: string;
  /** Embaixo do título, pequeno: o código, o tipo, a data… */
  detalhe?: string;
  /** Por que não pode ser escolhido (ex.: a anotação já tem o máximo de itens). Com ele, o achado aparece desabilitado. */
  motivo?: string;
}

interface Props<T> {
  /** O texto do botão que abre a busca (ex.: "Ligar anotação existente"). */
  rotulo: string;
  /** A busca, na camada de dados: recebe o texto digitado (sem os espaços das pontas; vazio, os mais recentes). */
  buscar: (termo: string) => Promise<T[]>;
  mostrar: (achado: T) => AchadoParaLigar;
  aoEscolher: (achado: T) => unknown;
  /** O nome do campo para o leitor de tela (ex.: "Buscar anotação para ligar") e a dica dentro dele. */
  rotuloDaBusca: string;
  dicaDaBusca: string;
  /** O nome da lista de achados para o leitor de tela (ex.: "Anotações"). */
  nomeDaLista: string;
  /** O que a lista diz quando não acha nada: com texto digitado e sem. */
  semAchados: { comTexto: string; semTexto: string };
  /** Um aviso embaixo do campo, enquanto a busca está aberta (ex.: quem passa a ver o que for ligado). */
  aviso?: string;
  /** O cartão só para ler (ou arquivado): nada de ligar. */
  somenteLer?: boolean;
  /** Por que agora não se pode ligar (ex.: a lista do cartão já tem o máximo): o botão aparece desabilitado, com o motivo ao lado. */
  indisponivel?: string;
  icone?: NomeIcone;
  /** Dentro de uma janela (como a de copiar a tarefa para outra demanda): a busca já aberta, sem o botão. Escolher só responde (a
   *  janela fecha); o Esc e o clique fora são da janela. */
  naJanela?: boolean;
}

/** Os botões dos achados que se podem escolher, na ordem da lista. */
const ESCOLHIVEIS = '.achados button:not(:disabled)';

export function LigarExistente<T>({ rotulo, buscar, mostrar, aoEscolher, rotuloDaBusca, dicaDaBusca, nomeDaLista, semAchados, aviso, somenteLer = false, indisponivel, icone = 'vinculo', naJanela = false }: Props<T>) {
  const [buscando, setBuscando] = useState(naJanela);
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo);
  const [achados, setAchados] = useState<{ termo: string; lista: T[] } | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const motivo = useId();
  // A busca de quem usa costuma ser uma função nova a cada desenho: fica guardada aqui, para não buscar de novo a cada desenho.
  const busca = useRef(buscar);
  busca.current = buscar;

  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    setAchados(null);
    busca.current(buscado.trim()).then(lista => { if (vivo) setAchados({ termo: buscado, lista }); }).catch(falha);
    return () => { vivo = false; };
  }, [buscando, buscado]);
  useEffect(() => { if (buscando) campo.current?.focus(); }, [buscando]);
  useEffect(() => {
    if (!buscando || naJanela) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) { setBuscando(false); setTermo(''); } };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [buscando, naJanela]);

  if (somenteLer) return null;

  // Ao fechar, o foco volta ao botão: o teclado não se perde.
  function fechar() {
    setBuscando(false);
    setTermo('');
    setAchados(null);
    setTimeout(() => botao.current?.focus(), 0);
  }
  function escolher(x: T) {
    if (!naJanela) fechar();
    void aoEscolher(x);
  }

  if (!buscando) return <div className={indisponivel ? 'ligar-indisponivel' : undefined}>
    <button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setBuscando(true)}
      disabled={!!indisponivel} aria-describedby={indisponivel ? motivo : undefined}>
      <Icone nome={icone} tam={13} /> {rotulo}
    </button>
    {indisponivel && <Nota id={motivo}>{indisponivel}</Nota>}
  </div>;

  const mostrados = achados?.lista.map(x => ({ x, ...mostrar(x) }));
  return <div className="busca-existente" ref={raiz} onBlur={e => {
    // Saindo pelo teclado (Tab), a busca fecha, para a lista não ficar aberta por cima do que vem depois.
    const destino = e.relatedTarget as Node | null;
    if (naJanela) return;
    if (destino && !raiz.current?.contains(destino)) { setBuscando(false); setTermo(''); }
  }} onKeyDown={e => {
    // Esc fecha só a busca, sem fechar o cartão em volta.
    if (e.key === 'Escape' && !naJanela) { e.stopPropagation(); e.preventDefault(); fechar(); }
  }}>
    <input ref={campo} type="text" className="campo" aria-label={rotuloDaBusca} placeholder={dicaDaBusca} autoComplete="off"
      value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Enter escolhe o primeiro achado que se pode escolher (e não envia o formulário); a seta para baixo leva à lista. Logo
        // depois de digitar, a lista ainda é a da busca anterior: o Enter só escolhe quando a busca do texto do campo já voltou.
        if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>(ESCOLHIVEIS)?.focus(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        const primeiro = achados?.termo === termo ? mostrados?.find(m => !m.motivo) : undefined;
        if (primeiro) escolher(primeiro.x);
      }} />
    {aviso && <Nota>{aviso}</Nota>}
    <ul className="achados" aria-label={nomeDaLista} aria-busy={!mostrados} onKeyDown={e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>(ESCOLHIVEIS) ?? [])];
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
    }}>
      {!mostrados
        ? <li className="nota sem-achados">Buscando…</li>
        : mostrados.length
          ? mostrados.map(m => <li key={m.id}><button type="button" disabled={!!m.motivo} onClick={() => escolher(m.x)}>
            <b>{m.titulo}</b>{(m.motivo || m.detalhe) && <small>{m.motivo || m.detalhe}</small>}
          </button></li>)
          : <li className="nota sem-achados">{termo.trim() ? semAchados.comTexto : semAchados.semTexto}</li>}
    </ul>
  </div>;
}
