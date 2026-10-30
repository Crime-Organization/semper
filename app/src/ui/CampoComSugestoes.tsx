// Campo de texto com sugestões enquanto se digita, numa lista do próprio SEMPER: a lista padrão do navegador (<datalist>)
// não segue o visual, sai estreita e corta o texto. Setas destacam, Enter ou clique põem a sugestão no campo, Esc fecha
// a lista. Enquanto nenhuma sugestão está destacada, as teclas seguem para a tela (ex.: Enter abre a linha seguinte).
import { useId, useState, type FocusEvent, type InputHTMLAttributes, type KeyboardEvent, type Ref } from 'react';
import { ACHADAS_DA_SUGESTAO } from '../dados/limites';
import { sugestoesQueCombinam } from '../regras/texto';

export interface Sugestao {
  valor: string;
  /** Texto miúdo ao lado (ex.: "oculta"). */
  detalhe?: string;
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list' | 'role'> & {
  valor: string;
  aoMudar: (valor: string) => void;
  /** Quem chama tira o que não deve ser sugerido de novo (ex.: o que já está nas outras linhas). */
  sugestoes: Sugestao[];
  ref?: Ref<HTMLInputElement>;
};

export function CampoComSugestoes({ valor, aoMudar, sugestoes, onKeyDown, onBlur, ref, ...resto }: Props) {
  const listaId = useId();
  const [aberta, setAberta] = useState(false);
  const [destaque, setDestaque] = useState(-1);
  const achadas = sugestoesQueCombinam(valor, sugestoes, ACHADAS_DA_SUGESTAO);
  const mostrar = aberta && achadas.length > 0;

  function escolher(s: Sugestao) {
    aoMudar(s.valor);
    setAberta(false);
    setDestaque(-1);
  }
  function teclar(e: KeyboardEvent<HTMLInputElement>) {
    const passo = { ArrowDown: 1, ArrowUp: -1 }[e.key as 'ArrowDown' | 'ArrowUp'];
    if (passo && achadas.length) {
      e.preventDefault();
      setAberta(true);
      setDestaque(i => (i + passo + achadas.length) % achadas.length);
      return;
    }
    if (mostrar && e.key === 'Enter' && destaque >= 0) { e.preventDefault(); escolher(achadas[destaque]); return; }
    if (mostrar && e.key === 'Escape') {
      // Fecha só a lista: o cartão ou a janela em volta continuam abertos.
      e.preventDefault(); e.stopPropagation();
      setAberta(false); setDestaque(-1);
      return;
    }
    onKeyDown?.(e);
  }

  return <div className="campo-sugestoes">
    <input {...resto} ref={ref} role="combobox" value={valor} aria-autocomplete="list" aria-expanded={mostrar}
      aria-controls={mostrar ? listaId : undefined} aria-activedescendant={mostrar && destaque >= 0 ? `${listaId}-${destaque}` : undefined}
      onChange={e => { aoMudar(e.target.value); setAberta(e.target.value.trim() !== ''); setDestaque(-1); }}
      onKeyDown={teclar} onBlur={(e: FocusEvent<HTMLInputElement>) => { setAberta(false); onBlur?.(e); }} />
    {mostrar && <ul className="lista-sugestoes" role="listbox" id={listaId} aria-label="Sugestões">
      {achadas.map((s, i) => <li key={s.valor} id={`${listaId}-${i}`} role="option" aria-selected={i === destaque}
        // Clicar não tira o foco do campo (senão a lista fecharia antes da escolha).
        onMouseDown={e => { e.preventDefault(); escolher(s); }}>
        <span>{s.valor}</span>{s.detalhe && <small>{s.detalhe}</small>}
      </li>)}
    </ul>}
  </div>;
}
