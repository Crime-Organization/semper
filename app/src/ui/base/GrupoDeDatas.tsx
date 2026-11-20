// A faixa das datas do cartão (#361, redesenhada na #383), a mesma em todos os cartões (pessoa, contrato, demanda, tarefa,
// processo, compromisso e anotação): cada dado com o nome em cima, pequeno, numa linha só, e o valor embaixo, sem quebrar ("Sem prazo",
// "20/12/2030 às 14:30"). Os nomes ficam todos na mesma linha e os valores na de baixo, alinhados. Na faixa estreita (o celular),
// cada dado vira uma linha, com o nome à esquerda e o valor à direita, e os valores começam todos na mesma coluna. Quem decide é a
// largura da própria faixa (container query), nunca uma conta em JavaScript.
// O tempo (o cronômetro da tarefa, o total da demanda) fica numa faixa própria, logo abaixo da das datas (#383): um dado largo,
// que ocupa a linha toda com o nome sempre em cima, e o resumo de quem registrou tempo numa LinhaDoGrupo, embaixo dele.
// DadoEditavel é o dado que quem pode alterar o cartão muda ali mesmo, no jeito do título (#346) e da data de início (#357): um
// clique abre um formulário pequeno no lugar do valor, com Salvar e Cancelar; Enter num campo salva e Esc desfaz, sem fechar o
// cartão. O rascunho mudado e não salvo é avisado ao cartão (aoMudarRascunho), que pergunta antes de fechar. Quem só lê vê o
// valor como texto.
// FaixaDasDatas é a faixa das datas de um cartão (#385): a criação e as outras datas. Quando a criação seria a única, a faixa
// some, porque o rodapé de todo cartão já diz "Criada em … por …".
import { Children, useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { dataDaCriacao } from '../../regras/dataDeInicio';
import { temErro, type ErrosDosCampos } from '../../regras/datasNoCartao';
import { falha } from '../avisos';
import { estiloBotao } from './botao';
import { Aviso } from '.';
import './GrupoDeDatas.css';

/** A faixa: os dados lado a lado (as datas; na faixa do tempo, o dado largo) e, se houver, as linhas inteiras embaixo deles. */
export function GrupoDeDatas({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <div className="grupo-datas" role="group" aria-label={rotulo}>
    <div className="grupo-datas-dados">{children}</div>
  </div>;
}

/** O nome da faixa das datas, para o leitor de tela. */
const ROTULO_DA_FAIXA = 'Datas';

interface PropsDaFaixa {
  /** A criação do item: o nome do dado ("Criada em", "Cadastrada em") e o instante gravado (o criado_em). */
  criacao: { rotulo: string; em: string };
  /** A criação depois das outras datas (no compromisso, a data e o horário dele vêm primeiro); sem isto, ela vem antes. */
  criacaoNoFim?: boolean;
  /** As outras datas do cartão (DadoDoGrupo). Sem nenhuma, a faixa some. */
  children?: ReactNode;
}

/**
 * A faixa das datas de um cartão (#385): a criação e as outras datas, lado a lado. Ela só aparece com mais de uma data: com a
 * criação sozinha (a pessoa, o processo, a anotação, o contrato de quem não vê os valores), a faixa some, porque o rodapé do
 * cartão já mostra a criação. Children.toArray descarta o que não vai à tela ({!oculto && …}): só conta o que aparece.
 */
export function FaixaDasDatas({ criacao, criacaoNoFim, children }: PropsDaFaixa) {
  const outras = Children.toArray(children);
  if (!outras.length) return null;
  const daCriacao = <DadoDoGrupo key="criacao" rotulo={criacao.rotulo}><b className="num">{dataDaCriacao(criacao.em)}</b></DadoDoGrupo>;
  return <GrupoDeDatas rotulo={ROTULO_DA_FAIXA}>{criacaoNoFim ? [...outras, daCriacao] : [daCriacao, ...outras]}</GrupoDeDatas>;
}

interface PropsDoDado {
  /** O nome do dado (ex.: "Prazo"), em cima do valor. */
  rotulo: string;
  /** O dado que precisa da linha toda (o cronômetro, com os botões ao lado dele): o nome sempre em cima, também no celular. */
  largo?: boolean;
  children: ReactNode;
}

/** Um dado da faixa: o nome em cima (ex.: "Prazo") e o valor (o texto, a data que se muda, o cronômetro). */
export function DadoDoGrupo({ rotulo, largo, children }: PropsDoDado) {
  const id = useId();
  return <div className={'grupo-datas-dado' + (largo ? ' largo' : '')} role="group" aria-labelledby={id}>
    <span className="rotulo-caps grupo-datas-rotulo" id={id}>{rotulo}</span>{' '}
    <div className="grupo-datas-valor">{children}</div>
  </div>;
}

/** O que ocupa a largura toda da faixa, embaixo dos dados (ex.: o resumo de quem registrou tempo, embaixo do cronômetro). */
export function LinhaDoGrupo({ children }: { children: ReactNode }) {
  return <div className="grupo-datas-linha">{children}</div>;
}

/** As marcas de erro de um campo do formulário pequeno: aria-invalid e, com erro, a ligação com a mensagem (aria-describedby). */
export interface MarcaDoErro { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined }

/** O que o formulário pequeno recebe para desenhar os campos dele. */
export interface CamposDoDado<V> {
  rascunho: V;
  mudar: (parte: Partial<V>) => void;
  /** Os erros, depois da primeira tentativa de salvar. */
  erros: ErrosDosCampos<keyof V & string>;
  /** As marcas de erro de um campo, para espalhar nele (como o propsDoCampo do cadastro). */
  marcar: (campo: keyof V & string) => MarcaDoErro;
}

interface PropsDadoEditavel<V extends object> {
  /** O nome do dado (ex.: "Prazo"), no botão que abre o formulário. */
  nome: string;
  /** O nome do formulário aberto (ex.: "Mudar o prazo"). */
  titulo: string;
  /** O valor por extenso, para o leitor de tela (ex.: "15/11/2030 às 14:00, lembrete: 1 hora antes"). */
  resumo: string;
  /** O valor como aparece: no botão, para quem muda; como texto, para quem só lê. Só texto em linha (vai dentro de um botão). */
  lido: ReactNode;
  /** Os campos com o valor gravado, quando o formulário abre. */
  inicial: () => V;
  /** Os erros do rascunho, pelas mesmas regras do cadastro (vazio: pode salvar). */
  conferir: (rascunho: V) => ErrosDosCampos<keyof V & string>;
  /** Grava o rascunho já conferido. Sem isto, o dado só se lê. Se falhar, o erro aparece e o formulário continua aberto. */
  aoSalvar?: (rascunho: V) => unknown;
  /**
   * Avisa o cartão do rascunho por salvar (como o do título e da descrição, #346): o rascunho, quando ficou diferente do gravado;
   * null quando volta ao gravado, fecha ou é salvo.
   */
  aoMudarRascunho?: (rascunho: string | null) => void;
  /** Os campos do formulário. */
  campos: (c: CamposDoDado<V>) => ReactNode;
}

export function DadoEditavel<V extends object>({ nome, titulo, resumo, lido, inicial, conferir, aoSalvar, aoMudarRascunho, campos }: PropsDadoEditavel<V>) {
  const [rascunho, setRascunho] = useState<V | null>(null);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const botao = useRef<HTMLButtonElement>(null);
  const idDosErros = useId();

  // O rascunho só conta para o cartão quando ficou diferente do gravado: abrir e não mudar nada não pergunta ao sair.
  const comoTexto = rascunho === null ? null : JSON.stringify(rascunho);
  const sujo = comoTexto !== null && comoTexto !== JSON.stringify(inicial()) ? comoTexto : null;
  const avisarRascunho = useRef(aoMudarRascunho);
  avisarRascunho.current = aoMudarRascunho;
  const avisado = useRef<string | null>(null);
  useEffect(() => {
    if (avisado.current === sujo) return;
    avisado.current = sujo;
    avisarRascunho.current?.(sujo);
  }, [sujo]);
  // Ao sair da tela no meio da edição, o cartão deixa de esperar este rascunho.
  useEffect(() => () => avisarRascunho.current?.(null), []);
  // Se a edição deixa de ser permitida no meio (o lápis abriu, o item foi arquivado), o rascunho fecha: não fica nada por salvar
  // que a pessoa não vê, nem o formulário volta aberto com ele (e o calendário de novo) quando a edição for permitida outra vez.
  const podeMudar = !!aoSalvar, editando = rascunho !== null;
  useEffect(() => {
    if (podeMudar || !editando) return;
    setRascunho(null);
    setConferido(false);
  }, [podeMudar, editando]);

  if (!aoSalvar) return <span className="dado-editavel">{lido}</span>;

  /** Fecha o formulário; pelo teclado e ao salvar, o foco volta ao valor, e quem usa o teclado não se perde no cartão. */
  function fechar() {
    setRascunho(null);
    setConferido(false);
    setTimeout(() => botao.current?.focus({ preventScroll: true }), 0);
  }
  async function salvar() {
    if (!rascunho || ocupado) return;
    // Sem mudança, só fecha: nada a gravar, nada no histórico.
    if (!sujo) { fechar(); return; }
    setConferido(true);
    if (temErro(conferir(rascunho))) return;
    setOcupado(true);
    try {
      await aoSalvar!(rascunho);
      fechar();
    } catch (e) {
      falha(e);
    } finally {
      setOcupado(false);
    }
  }
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    // Esc desfaz só o dado, sem fechar o cartão em volta (o calendário aberto fecha antes, sozinho). Durante a gravação, não
    // desfaz (como o Cancelar, desligado): se ela falhar, o formulário continua aberto com o que a pessoa escreveu.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!ocupado) fechar(); return; }
    // Enter num campo salva; nos botões, vale o próprio botão.
    if (e.key === 'Enter' && (e.target as HTMLElement).matches('input, select')) { e.preventDefault(); void salvar(); }
  }

  if (rascunho !== null) {
    const erros = conferido ? conferir(rascunho) : {};
    const mensagens = Object.values(erros).filter(Boolean) as string[];
    const marcar = (campo: keyof V & string): MarcaDoErro => {
      const erro = !!(erros as Partial<Record<string, string>>)[campo];
      return { 'aria-invalid': erro || undefined, 'aria-describedby': erro ? idDosErros : undefined };
    };
    return <div className="data-editavel dado-editavel editando" role="group" aria-label={titulo} onKeyDown={teclar}>
      <div className="dado-editavel-campos">
        {campos({ rascunho, mudar: parte => setRascunho(atual => atual && { ...atual, ...parte }), erros, marcar })}
      </div>
      {mensagens.length > 0 && <Aviso tipo="erro" id={idDosErros}>{mensagens.join(' ')}</Aviso>}
      <div className="dado-editavel-acoes">
        <button type="button" className={estiloBotao({ pequeno: true })} disabled={ocupado} onClick={fechar}>Cancelar</button>
        <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado} onClick={() => void salvar()}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>;
  }
  return <button ref={botao} type="button" className="data-editavel-botao dado-editavel-botao" aria-label={`${nome}: ${resumo}. Clique para mudar`}
    title="Clique para mudar" onClick={() => setRascunho(inicial())}>
    {lido}
  </button>;
}
