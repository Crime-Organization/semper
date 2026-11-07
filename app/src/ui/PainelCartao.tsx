// Painel do cartão, sobre um véu: abre ao lado (desliza da direita) ou numa janela no centro da tela, como no Trello.
// Cada usuário escolhe no botão ao lado do "X", e a escolha fica nas preferências dele (vale para os cartões de todos os
// módulos, em qualquer aparelho). Esc ou clique fora fecham (se não houver janela aberta).
// Na janela no centro há uma coluna à direita, para os comentários: ColunaDoCartao diz onde ela está (no painel ao lado,
// não há coluna, e os comentários ficam numa seção do cartão).
// Com "soNoCentro" (o cadastro novo, numa janela sobre a página), é sempre a janela no centro, sem a coluna e sem a
// troca, e o clique fora não fecha. "rotulo" dá nome à janela para o leitor de tela (padrão: "Cadastro").
// Uma tela dentro do painel pode travá-lo com useTravarPainel(motivo) (ex.: enquanto grava uma importação): aí o Esc,
// o X e o clique fora não fecham, e o motivo aparece num aviso.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { avisar } from './avisos';
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
/** Como travar o painel em que a tela está (fora de um painel, não faz nada). */
export const TravaDoPainel = createContext<(motivo: string | null) => void>(() => {});
/**
 * Enquanto houver motivo, o painel não fecha (Esc, X e clique fora mostram o motivo num aviso). Com null, ou quando
 * a tela sai, o painel volta a fechar.
 */
export function useTravarPainel(motivo: string | null) {
  const travar = useContext(TravaDoPainel);
  useEffect(() => {
    travar(motivo);
    return () => travar(null);
  }, [travar, motivo]);
}
/** Fecha, a não ser que o painel esteja travado: aí só avisa o motivo. */
function tentarFechar(trava: string | null, fechar: () => void) {
  if (trava) avisar(trava, 'erro');
  else fechar();
}
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

interface PropsPainel {
  aoFechar: () => void;
  soNoCentro?: boolean;
  /** Nome da janela no centro para o leitor de tela (ex.: "Importar pessoas"). */
  rotulo?: string;
  /** A janela no centro fica da altura do que mostra (um formulário curto), em vez de ocupar a tela toda. */
  ajustado?: boolean;
  children: ReactNode;
}
export function PainelCartao({ aoFechar, soNoCentro = false, rotulo = 'Cadastro', ajustado = false, children }: PropsPainel) {
  const [on, setOn] = useState(false);
  const [escolhido, setFormato] = useState(formatoGuardado);
  const formato: FormatoCartao = soNoCentro ? 'centro' : escolhido;
  const comColuna = formato === 'centro' && !soNoCentro;
  const [coluna, setColuna] = useState<HTMLElement | null>(null);
  const [vaga, setVaga] = useState<HTMLElement | null>(null);
  const estreita = useEstreita();
  const painel = useRef<HTMLElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;
  const trava = useRef<string | null>(null);
  const [travar] = useState(() => (motivo: string | null) => { trava.current = motivo; });
  const pedirParaFechar = () => tentarFechar(trava.current, fechar.current);
  useEffect(() => {
    document.body.classList.add('sem-rolagem');
    const r = requestAnimationFrame(() => { setOn(true); painel.current?.focus(); });
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.veu-janela')) tentarFechar(trava.current, fechar.current); };
    document.addEventListener('keydown', tecla);
    return () => { cancelAnimationFrame(r); document.removeEventListener('keydown', tecla); document.body.classList.remove('sem-rolagem'); };
  }, []);
  function trocarFormato() {
    const outro = FORMATOS[formato].outro;
    setFormato(outro);
    salvarPreferencia(PREFERENCIA_FORMATO, outro);
  }
  const { rotulo: rotuloDoFormato, icone } = FORMATOS[formato];
  return createPortal(<>
    {/* No cadastro, um clique fora não fecha (perderia o que foi digitado): só o X ou o Esc. */}
    <div className={'veu' + (on ? ' on' : '')} onClick={() => { if (!soNoCentro) pedirParaFechar(); }} />
    <aside className={`cartao-painel ${formato}` + (soNoCentro ? ' sem-coluna' : '') + (ajustado ? ' ajustado' : '') + (on ? ' on' : '')} role="dialog" aria-modal="true" aria-label={soNoCentro ? rotulo : undefined} tabIndex={-1} ref={painel}>
      <div className="cartao-botoes">
        <span className="cartao-botoes-do-cartao" ref={setVaga} />
        {!soNoCentro && <button type="button" className="cartao-botao cartao-formato" aria-label={rotuloDoFormato} title={rotuloDoFormato} onClick={trocarFormato}><Icone nome={icone} tam={18} /></button>}
        <button type="button" className="cartao-botao" aria-label="Fechar" onClick={pedirParaFechar}><Icone nome="fechar" tam={18} /></button>
      </div>
      <div className="cartao-conteudo">
        <TravaDoPainel.Provider value={travar}>
          <ColunaDoCartao.Provider value={comColuna ? coluna : null}>
            <BotoesNoPainel.Provider value={formato === 'lado' || estreita ? vaga : null}>
              <div className="cartao-corpo">{children}</div>
            </BotoesNoPainel.Provider>
          </ColunaDoCartao.Provider>
        </TravaDoPainel.Provider>
        {comColuna && <div className="cartao-coluna" ref={setColuna} />}
      </div>
    </aside>
  </>, document.body);
}
