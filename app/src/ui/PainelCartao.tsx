// Painel do cartão, sobre um véu: abre ao lado (desliza da direita) ou numa janela no centro da tela, como no Trello.
// Cada usuário escolhe no botão ao lado do "X", e a escolha fica nas preferências dele (vale para os cartões de todos os
// módulos, em qualquer aparelho). Esc ou clique fora fecham (se não houver janela aberta).
// Na janela no centro há uma coluna à direita, para os comentários: ColunaDoCartao diz onde ela está (no painel ao lado,
// não há coluna, e os comentários ficam numa seção do cartão).
import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icone, type NomeIcone } from './Icone';
import { lerPreferencia, salvarPreferencia } from './preferencias';

type FormatoCartao = 'lado' | 'centro';
/** Em cada formato, o botão oferece o outro. */
const FORMATOS: Record<FormatoCartao, { outro: FormatoCartao; rotulo: string; icone: NomeIcone }> = {
  lado: { outro: 'centro', rotulo: 'Abrir no centro da tela', icone: 'centro' },
  centro: { outro: 'lado', rotulo: 'Abrir ao lado', icone: 'lado' }
};
export const PREFERENCIA_FORMATO = 'cartao.formato';
/** A coluna da direita da janela no centro (null no painel ao lado). */
export const ColunaDoCartao = createContext<HTMLElement | null>(null);
/**
 * O lugar, na linha dos botões do painel (ao lado do formato e do "X"), para os botões do cartão (Arquivar e Editar).
 * Vale no painel ao lado e na janela estreita, onde os botões do painel ficam por cima do cartão; na janela larga
 * (null), eles ficam no próprio cartão, encostados à direita do conteúdo.
 */
export const BotoesNoPainel = createContext<HTMLElement | null>(null);
/** Janela estreita: a coluna dos comentários desce para baixo do cartão (a mesma medida de estilo.css). */
const JANELA_ESTREITA = '(max-width: 900px)';
function useEstreita() {
  const [estreita, setEstreita] = useState(() => window.matchMedia?.(JANELA_ESTREITA).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(JANELA_ESTREITA);
    if (!m) return;
    const mudou = () => setEstreita(m.matches);
    m.addEventListener('change', mudou);
    return () => m.removeEventListener('change', mudou);
  }, []);
  return estreita;
}
const formatoGuardado = (): FormatoCartao => {
  const f = lerPreferencia<string>(PREFERENCIA_FORMATO, 'lado');
  return f in FORMATOS ? f as FormatoCartao : 'lado';
};

export function PainelCartao({ aoFechar, children }: { aoFechar: () => void; children: ReactNode }) {
  const [on, setOn] = useState(false);
  const [formato, setFormato] = useState(formatoGuardado);
  const [coluna, setColuna] = useState<HTMLElement | null>(null);
  const [vaga, setVaga] = useState<HTMLElement | null>(null);
  const estreita = useEstreita();
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  useEffect(() => {
    document.body.classList.add('sem-rolagem');
    const r = requestAnimationFrame(() => { setOn(true); painel.current?.focus(); });
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.veu-janela')) fechar.current(); };
    document.addEventListener('keydown', tecla);
    return () => { cancelAnimationFrame(r); document.removeEventListener('keydown', tecla); document.body.classList.remove('sem-rolagem'); };
  }, []);
  function trocarFormato() {
    const outro = FORMATOS[formato].outro;
    setFormato(outro);
    salvarPreferencia(PREFERENCIA_FORMATO, outro);
  }
  const { rotulo, icone } = FORMATOS[formato];
  return createPortal(<>
    <div className={'veu' + (on ? ' on' : '')} onClick={() => fechar.current()} />
    <aside className={`cartao-painel ${formato}` + (on ? ' on' : '')} role="dialog" aria-modal="true" tabIndex={-1} ref={painel}>
      <div className="cartao-botoes">
        <span className="cartao-botoes-do-cartao" ref={setVaga} />
        <button type="button" className="cartao-botao cartao-formato" aria-label={rotulo} title={rotulo} onClick={trocarFormato}><Icone nome={icone} tam={18} /></button>
        <button type="button" className="cartao-botao" aria-label="Fechar" onClick={() => fechar.current()}><Icone nome="fechar" tam={18} /></button>
      </div>
      <div className="cartao-conteudo">
        <ColunaDoCartao.Provider value={formato === 'centro' ? coluna : null}>
          <BotoesNoPainel.Provider value={formato === 'lado' || estreita ? vaga : null}>
            <div className="cartao-corpo">{children}</div>
          </BotoesNoPainel.Provider>
        </ColunaDoCartao.Provider>
        {formato === 'centro' && <div className="cartao-coluna" ref={setColuna} />}
      </div>
    </aside>
  </>, document.body);
}
