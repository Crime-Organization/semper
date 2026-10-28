// Peças básicas do SEMPER (o design system em código; veja DESIGN.md). Cada uma gera o mesmo HTML e as mesmas
// classes que as telas já usam, com as cores e os tamanhos de estilo.css: trocar a marcação de uma tela por elas
// não muda a aparência. Comportamento (ocupado, dois cliques) fica em ../Botoes.tsx, que aceita o mesmo estilo.
import { useId, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router';
import { estiloBotao, type EstiloBotao } from './botao';

export { estiloBotao, type EstiloBotao, type FormaBotao, type VarianteBotao } from './botao';

/** Link com cara de botão (ex.: "Nova pessoa" no cabeçalho do módulo). */
export function BotaoLink({ forma, variante, pequeno, className, ...resto }: ComponentProps<typeof Link> & EstiloBotao) {
  return <Link className={estiloBotao({ forma, variante, pequeno }, className)} {...resto} />;
}

interface PropsCampo {
  /** Texto do rótulo. */
  rotulo: ReactNode;
  /** id do campo (input, select ou textarea) que vai dentro; liga o rótulo, a dica e o erro a ele. */
  para: string;
  obrigatorio?: boolean;
  dica?: ReactNode;
  /** Mensagem de erro; com ela, o campo fica marcado e a mensagem aparece. */
  erro?: ReactNode;
  /** O que vem depois da mensagem de erro (ex.: o resultado de uma busca de CEP). */
  depois?: ReactNode;
  className?: string;
  children: ReactNode;
}
/**
 * Pergunta de formulário: rótulo (com * se obrigatório), dica, o campo e a mensagem de erro.
 * O campo recebe o id indicado em "para"; aria-invalid e aria-describedby ficam a cargo de propsDoCampo().
 */
export function Campo({ rotulo, para, obrigatorio, dica, erro, depois, className, children }: PropsCampo) {
  return <div className={['pergunta', erro ? 'erro' : '', className].filter(Boolean).join(' ')}>
    <label htmlFor={para}>{rotulo}{obrigatorio && <span className="req">*</span>}</label>
    {dica && <p className="dica" id={para + '-dica'}>{dica}</p>}
    {children}
    {erro && <span className="msg-erro" id={para + '-erro'} role="alert">{erro}</span>}
    {depois}
  </div>;
}
/** Props de acessibilidade do campo que vai dentro de <Campo>: id, aria-invalid e aria-describedby (dica e erro). */
export function propsDoCampo(para: string, { dica, erro }: { dica?: ReactNode; erro?: ReactNode } = {}) {
  const descrito = [dica ? para + '-dica' : '', erro ? para + '-erro' : ''].filter(Boolean).join(' ');
  return { id: para, 'aria-invalid': erro ? true : undefined, 'aria-describedby': descrito || undefined };
}

interface PropsEscolhas {
  rotulo: ReactNode;
  obrigatorio?: boolean;
  dica?: ReactNode;
  erro?: ReactNode;
  /** Arranjo das opções: em coluna única (listas longas) ou várias marcáveis lado a lado. */
  arranjo?: 'coluna-unica' | 'multipla';
  children: ReactNode;
}
/** Grupo de opções (rádios ou caixas) com um rótulo comum, como "Gênero" ou "Tipo de cadastro". */
export function Escolhas({ rotulo, obrigatorio, dica, erro, arranjo, children }: PropsEscolhas) {
  const id = useId();
  return <div className={'pergunta' + (erro ? ' erro' : '')} role="group" aria-labelledby={id}>
    <span className="rot" id={id}>{rotulo}{obrigatorio && <span className="req">*</span>}</span>
    {dica && <p className="dica">{dica}</p>}
    <div className={arranjo ? 'escolhas ' + arranjo : 'escolhas'}>{children}</div>
    {erro && <span className="msg-erro" role="alert">{erro}</span>}
  </div>;
}

/** Faixa de aviso dentro da tela (não confundir com os avisos do pé da tela, em ../avisos.tsx). */
export function Aviso({ tipo, children, className }: { tipo: 'erro' | 'ok' | 'info'; children: ReactNode; className?: string }) {
  return <div className={['aviso', tipo, className].filter(Boolean).join(' ')} role={tipo === 'erro' ? 'alert' : 'status'}>{children}</div>;
}

export type TipoSelo = 'ok' | 'erro' | 'pend' | 'arq' | 'escuro';
/** Selo curto em caixa alta (ex.: ATIVO, PENDENTE, ARQUIVADA). */
export function Selo({ tipo, children }: { tipo?: TipoSelo; children: ReactNode }) {
  return <span className={tipo ? 'selo ' + tipo : 'selo'}>{children}</span>;
}

/** Caixa branca com borda fina, para agrupar um conteúdo. */
export function Cartao({ className, ...resto }: ComponentProps<'div'>) {
  return <div className={className ? 'cartao ' + className : 'cartao'} {...resto} />;
}

/** Título de uma seção da página. */
export function TituloSecao({ className, ...resto }: ComponentProps<'h2'>) {
  return <h2 className={className ? 'secao ' + className : 'secao'} {...resto} />;
}

/** Texto de apoio em cinza: nota (explicação de uma seção) ou dica (de um campo). */
export function Nota({ className, ...resto }: ComponentProps<'p'>) {
  return <p className={className ? 'nota ' + className : 'nota'} {...resto} />;
}
export function Dica({ className, ...resto }: ComponentProps<'p'>) {
  return <p className={className ? 'dica ' + className : 'dica'} {...resto} />;
}

/** Enquanto os dados não chegam. */
export function Carregando({ children = 'Carregando…' }: { children?: ReactNode }) {
  return <p className="carregando" role="status">{children}</p>;
}

/** Lista vazia: o que aparece quando não há nada para mostrar (e, de preferência, como acrescentar o primeiro). */
export function Vazio({ children }: { children: ReactNode }) {
  return <div className="vazio">{children}</div>;
}
