// Ligar um processo que já existe a um cartão (demanda, tarefa, contrato, compromisso), no modelo da busca da equipe
// (EscolhaDaEquipe): o botão "+ Ligar processo" abre uma busca por cima do que vem abaixo, e a lista mostra só os processos
// ativos que a pessoa pode ligar e que ainda não estão no cartão. Sem nada digitado, aparecem os mais recentes (#294).
import { useEffect, useRef, useState } from 'react';
import { SD, type ProcessoParaLigar } from '../dados';
import { detalheDoProcesso, nomeDoProcesso, processosParaOferecer } from '../regras/processo';
import { falha } from './avisos';
import { estiloBotao } from './base';
import { Icone } from './Icone';
import { useAtrasado } from './util';

interface Props {
  /** Os processos que já estão no cartão: ficam fora da lista. */
  ligados: string[];
  aoEscolher: (p: ProcessoParaLigar) => unknown;
  /** O texto do botão. */
  rotulo?: string;
}

export function LigarProcesso({ ligados, aoEscolher, rotulo = 'Ligar processo' }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo);
  const [achados, setAchados] = useState<ProcessoParaLigar[] | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const oferecidos = achados && processosParaOferecer(achados, ligados);

  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    SD.processosParaLigar(buscado.trim()).then(r => { if (vivo) setAchados(r); }).catch(falha);
    return () => { vivo = false; };
  }, [buscando, buscado]);
  useEffect(() => { if (buscando) campo.current?.focus(); }, [buscando]);
  useEffect(() => {
    if (!buscando) return;
    const foraDaBusca = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) { setBuscando(false); setTermo(''); } };
    document.addEventListener('mousedown', foraDaBusca);
    return () => document.removeEventListener('mousedown', foraDaBusca);
  }, [buscando]);

  // Ao fechar, o foco volta ao botão: o teclado não se perde.
  function fechar() {
    setBuscando(false);
    setTermo('');
    setAchados(null);
    setTimeout(() => botao.current?.focus(), 0);
  }
  function escolher(p: ProcessoParaLigar) {
    fechar();
    void aoEscolher(p);
  }

  if (!buscando) return <div>
    <button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setBuscando(true)}>
      <Icone nome="mais" tam={13} /> {rotulo}
    </button>
  </div>;

  return <div className="busca-processo" ref={raiz} onBlur={e => {
    // Saindo pelo teclado (Tab), a busca fecha, para a lista não ficar aberta por cima do que vem depois.
    const destino = e.relatedTarget as Node | null;
    if (destino && !raiz.current?.contains(destino)) { setBuscando(false); setTermo(''); }
  }}>
    <input ref={campo} type="text" className="campo" aria-label="Buscar processo para ligar" placeholder="Número, nome ou cliente do processo" autoComplete="off"
      value={termo} onChange={e => setTermo(e.target.value)}
      onKeyDown={e => {
        // Esc fecha só a busca (sem fechar o cartão em volta); Enter escolhe o primeiro achado (e não envia o formulário);
        // a seta para baixo leva à lista.
        if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); return; }
        if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>('.achados button')?.focus(); return; }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        e.stopPropagation();
        if (oferecidos?.[0]) escolher(oferecidos[0]);
      }} />
    <ul className="achados" aria-label="Processos" aria-busy={!oferecidos} onKeyDown={e => {
      if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); return; }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.achados button') ?? [])];
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
    }}>
      {!oferecidos
        ? <li className="nota sem-achados">Buscando…</li>
        : oferecidos.length
          ? oferecidos.map(p => <li key={p.id}><button type="button" onClick={() => escolher(p)}>
            <b>{nomeDoProcesso(p)}</b><small>{detalheDoProcesso(p)}</small>
          </button></li>)
          : <li className="nota sem-achados">{termo.trim() ? 'Nenhum processo ativo com esse texto que você possa ligar.' : 'Nenhum processo ativo que você possa ligar.'}</li>}
    </ul>
  </div>;
}
