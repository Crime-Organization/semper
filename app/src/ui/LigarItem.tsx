// Ligar uma anotação a mais um item do sistema (#303), no modelo de LigarProcesso: o botão "+ Ligar a outro item" abre a
// escolha do tipo de item (pessoa, processo, contrato…) e a busca por cima do que vem abaixo. A lista mostra só os itens
// ativos que a pessoa pode ver e que ainda não estão ligados. Sem nada digitado, aparecem os mais recentes.
import { useEffect, useRef, useState } from 'react';
import { SD, type ItemDaAnotacao, type ModuloDaAnotacao } from '../dados';
import { ITEM_DA_ANOTACAO } from '../regras/anotacao';
import { falha } from './avisos';
import { estiloBotao } from './base';
import { Icone } from './Icone';
import { useAtrasado } from './util';

interface Props {
  /** Os tipos de item que se podem ligar (os módulos ligados no escritório), na ordem da escolha. */
  modulos: ModuloDaAnotacao[];
  /** Os itens que já estão ligados: ficam fora da lista. */
  ligados: Pick<ItemDaAnotacao, 'modulo' | 'id'>[];
  aoEscolher: (item: ItemDaAnotacao) => unknown;
}

export function LigarItem({ modulos, ligados, aoEscolher }: Props) {
  const [buscando, setBuscando] = useState(false);
  const [modulo, setModulo] = useState<ModuloDaAnotacao>(modulos[0]);
  const [termo, setTermo] = useState('');
  const buscado = useAtrasado(termo);
  const [achados, setAchados] = useState<ItemDaAnotacao[] | null>(null);
  const raiz = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const botao = useRef<HTMLButtonElement>(null);

  const oferecidos = achados?.filter(i => !ligados.some(l => l.modulo === i.modulo && l.id === i.id));
  const tipo = ITEM_DA_ANOTACAO[modulo];

  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    setAchados(null);
    SD.itensParaLigar(modulo, buscado.trim()).then(r => { if (vivo) setAchados(r); }).catch(falha);
    return () => { vivo = false; };
  }, [buscando, modulo, buscado]);
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
  function escolher(i: ItemDaAnotacao) {
    fechar();
    void aoEscolher(i);
  }

  if (!modulos.length) return null;
  if (!buscando) return <div>
    <button ref={botao} type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setBuscando(true)}>
      <Icone nome="vinculo" tam={13} /> Ligar a outro item
    </button>
  </div>;

  return <div className="busca-processo ligar-item" ref={raiz} onBlur={e => {
    // Saindo pelo teclado (Tab), a busca fecha, para a lista não ficar aberta por cima do que vem depois.
    const destino = e.relatedTarget as Node | null;
    if (destino && !raiz.current?.contains(destino)) { setBuscando(false); setTermo(''); }
  }} onKeyDown={e => {
    // Esc fecha só a busca, sem fechar o cartão em volta.
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); fechar(); }
  }}>
    <div className="ligar-item-campos">
      <select className="campo" aria-label="Tipo de item" value={modulo} onChange={e => { setModulo(e.target.value as ModuloDaAnotacao); campo.current?.focus(); }}>
        {modulos.map(m => <option key={m} value={m}>{ITEM_DA_ANOTACAO[m].rotulo}</option>)}
      </select>
      <input ref={campo} type="text" className="campo" aria-label="Buscar item para ligar" placeholder={`Buscar ${tipo.rotulo.toLowerCase()}…`} autoComplete="off"
        value={termo} onChange={e => setTermo(e.target.value)}
        onKeyDown={e => {
          // Enter escolhe o primeiro achado (e não envia o formulário); a seta para baixo leva à lista. Logo depois de digitar, a
          // lista ainda é a da busca anterior: o Enter só escolhe quando a busca do texto que está no campo já voltou.
          if (e.key === 'ArrowDown') { e.preventDefault(); raiz.current?.querySelector<HTMLButtonElement>('.achados button')?.focus(); return; }
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          if (buscado === termo && oferecidos?.[0]) escolher(oferecidos[0]);
        }} />
    </div>
    <ul className="achados" aria-label={tipo.plural} aria-busy={!oferecidos} onKeyDown={e => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const lista = [...(raiz.current?.querySelectorAll<HTMLButtonElement>('.achados button') ?? [])];
      const i = lista.indexOf(document.activeElement as HTMLButtonElement);
      (e.key === 'ArrowDown' ? lista[i + 1] : lista[i - 1] ?? campo.current)?.focus();
    }}>
      {!oferecidos
        ? <li className="nota sem-achados">Buscando…</li>
        : oferecidos.length
          ? oferecidos.map(i => <li key={i.id}><button type="button" onClick={() => escolher(i)}>
            <b>{i.nome}</b><small>{tipo.rotulo} · {i.codigo}</small>
          </button></li>)
          : <li className="nota sem-achados">{termo.trim() ? 'Nenhum item ativo com esse texto que você possa ligar.' : 'Nenhum item ativo deste tipo que você possa ligar.'}</li>}
    </ul>
  </div>;
}
