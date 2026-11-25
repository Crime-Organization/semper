// As datas do cartão numa janela própria (#422, refeita compacta na #431), a mesma em todos os cartões com datas (tarefa, demanda,
// compromisso, contrato). No cartão fica só um resumo curto ("Início 20/11/2026 · Entrega 15/12/2030 às 14:00"); quem pode alterar
// o cartão clica nele e abre uma janela pequena que flutua sobre o cartão, do jeito da janela das etiquetas (MenuFlutuante), sem
// nunca cobrir o resumo que a abriu: no alto, o nome das datas ("Datas") e o X; o calendário do mês (o mesmo do campo de data,
// CalendarioDoMes, sem o "Hoje"); cada data com o nome em cima e, numa linha só, a caixa de marcar (a que pode ficar sem data,
// quando a janela tem mais de uma), o campo e a hora, escolhida numa lista de horários; no compromisso, a hora do fim ("até")
// embaixo da hora e a repetição, numa lista; o lembrete com uma frase curta; e Salvar e Remover na largura toda, um embaixo do
// outro. O calendário escreve na data ativa, marcada com a borda verde: a última em que a pessoa clicou (ao abrir, a entrega, se
// marcada); desmarcada a ativa, a outra passa a ser. Salvar confere pelas regras do cadastro, grava e fecha; com erro, a janela fica
// aberta e diz o que falta. O X, o Esc ou um clique fora fecham sem mudar nada; durante a gravação, a janela não fecha. Remover
// tira as datas que podem ficar sem data e grava. O rascunho, o que cada clique faz nele e a lista de horários ficam em
// regras/janelaDasDatas.ts.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, type SelectHTMLAttributes } from 'react';
import { hojeNaAgenda } from '../../regras/agenda';
import { isoDoTexto, textoDaDataDigitada } from '../../regras/campoData';
import { temErro, type ErrosDosCampos } from '../../regras/datasNoCartao';
import {
  dataAtivaAoAbrir, dataAtivaAoDesmarcar, dataMarcada, datasMudaram, datasQueValem, escolherDia, escreverData, horariosDaLista, marcarData, NUNCA_SE_REPETE,
  podeRemover, removerDatas, textoDaData, SEPARADOR_DO_RESUMO, type CampoDasDatas, type CamposDasDatas, type PartesDasDatas, type PedacoDoResumo, type QualData
} from '../../regras/janelaDasDatas';
import { lerLembrete, LEMBRETES, NOTA_CURTA_DO_LEMBRETE, OPCOES_DE_LEMBRETE, SEM_LEMBRETE } from '../../regras/lembrete';
import type { TipoDeAtalho } from '../../regras/atalhosDoCartao';
import { falha } from '../avisos';
import { Icone } from '../Icone';
import { MenuFlutuante } from '../Menu';
import { useAtalhoDoCartao } from '../registroDeAtalhos';
import { irAte } from '../rolagem';
import { estiloBotao } from './botao';
import { BotaoDeIcone } from './BotaoDeIcone';
import { CalendarioDoMes } from './CampoData';
import { Aviso } from '.';
import './JanelaDasDatas.css';

/** Uma data da janela: o nome em cima do campo ("Data de início"), e o nome do campo, para o leitor de tela ("Data de início", "Prazo"). */
export interface DataDaJanela {
  /** O nome em cima do campo. Sem ele (a janela de uma data só, cujo título já diz qual é), o campo fica sem nome em cima. */
  rotulo?: string;
  nome: string;
  /** A data pode ficar vazia: o Remover a tira e, na janela com mais de uma data, ela ganha a caixa de marcar. */
  opcional?: boolean;
}
/** A entrega (no compromisso, a data dele; no contrato, a assinatura), com o que pode vir junto dela. */
export interface EntregaDaJanela extends DataDaJanela {
  /** A hora da entrega: o nome dela para o leitor de tela (ex.: "Hora do prazo"). */
  hora?: { rotulo: string; obrigatoria?: boolean };
  /** O fim do horário ("até", no compromisso): fica embaixo da hora. */
  ate?: boolean;
  /** O lembrete da entrega (tarefas e demandas). */
  lembrete?: boolean;
}
/** A repetição do item (#431, no compromisso), numa lista que começa com "Nunca". */
export interface RepeticaoDaJanela {
  /** As escolhas depois do "Nunca" (ex.: "Toda semana"): o valor vai para o rascunho (repetir). */
  opcoes: readonly { valor: string; nome: string }[];
  /** O item já se repete: a lista mostra como (o nome), sem mudar ali; a nota diz por quê. */
  fixa?: { nome: string; nota: string };
}

interface Props {
  /** O nome das datas no cartão (ex.: "Datas"): no botão que abre a janela e no alto da janela aberta. */
  nome: string;
  /** O nome da janela aberta, para o leitor de tela (ex.: "Mudar as datas"). */
  titulo: string;
  /** O resumo por extenso, para o leitor de tela (ex.: "Início 20/11/2026 · Entrega 15/12/2030, lembrete: 1 hora antes"). */
  resumo: string;
  /** O resumo curto como aparece no cartão: no botão, para quem muda; como texto, para quem só lê. Só texto em linha. */
  lido: ReactNode;
  inicio?: DataDaJanela;
  entrega?: EntregaDaJanela;
  /** A lista da repetição (só nos itens que se repetem). */
  repeticao?: RepeticaoDaJanela;
  /** O nome do botão que tira as datas que podem ficar vazias (#442: "Tirar o prazo", na folhinha da tarefa). Sem isto, "Remover". */
  rotuloDoRemover?: string;
  /** O rascunho com o que está gravado, quando a janela abre. */
  inicial: () => CamposDasDatas;
  /** Os erros do rascunho, pelas regras do cadastro (vazio: pode salvar). */
  conferir: (c: CamposDasDatas) => ErrosDosCampos<CampoDasDatas>;
  /** Grava as datas que valem (já conferidas). Sem isto, as datas só se leem. Se falhar, o erro aparece e a janela fica aberta. */
  aoSalvar?: (c: CamposDasDatas) => unknown;
  /** A linha que as datas oferecem ao menu "Acrescentar ao cartão" (#399): o "ver" leva até elas; o "+" abre a janela. */
  atalho?: TipoDeAtalho;
  /**
   * Quem abre a janela, no lugar do botão do resumo (#442: no cartão da tarefa, a folhinha do prazo e o link "Mudar prazo"). Recebe o
   * ref do abridor principal (o atalho do cartão rola até ele e abre a janela presa a ele), se a janela está aberta e o alternar, que
   * abre a janela presa a quem foi clicado (ou a fecha). Desenha o bloco todo; quem só lê vê o "lido". Sem isto, o botão do resumo.
   */
  abridores?: (a: AbridoresDasDatas) => ReactNode;
}

/** O que os abridores próprios da janela recebem (#442). */
export interface AbridoresDasDatas {
  ref: RefObject<HTMLButtonElement | null>;
  aberta: boolean;
  alternar: (e: MouseEvent<HTMLElement>) => void;
}

/**
 * O resumo curto das datas no cartão: os pedaços numa linha ("Início 20/11/2026 · Entrega 15/12/2030 às 14:00"), o nome de cada
 * data em letra comum e o valor em negrito. Só texto em linha (vai dentro do botão que abre a janela).
 */
export function ResumoDasDatas({ pedacos }: { pedacos: readonly PedacoDoResumo[] }) {
  return <span className="resumo-das-datas">{pedacos.map((p, i) => <span key={i}>
    {i > 0 && SEPARADOR_DO_RESUMO}{p.rotulo && <span className="resumo-das-datas-nome">{p.rotulo} </span>}<b className="num">{p.valor}</b>
  </span>)}</span>;
}

/** As datas que a janela tem e se cada uma pode ficar vazia. */
const partesDe = (inicio?: DataDaJanela, entrega?: DataDaJanela): PartesDasDatas => ({
  ...(inicio ? { inicio: { opcional: !!inicio.opcional } } : {}),
  ...(entrega ? { entrega: { opcional: !!entrega.opcional } } : {})
});

/** O resumo das datas no cartão e, para quem pode alterar, a janela que abre ao clicar nele. */
export function DatasDoCartao({ nome, titulo, resumo, lido, atalho, aoSalvar, abridores, ...janela }: Props) {
  const [aberta, setAberta] = useState<HTMLElement | null>(null);
  const valor = useRef<HTMLButtonElement>(null), soLido = useRef<HTMLSpanElement>(null), blocoLido = useRef<HTMLDivElement>(null);
  const podeMudar = !!aoSalvar;
  // Se a edição deixa de ser permitida com a janela aberta (o lápis abriu, o item foi arquivado), a janela fecha sem gravar.
  useEffect(() => { if (!podeMudar) setAberta(null); }, [podeMudar]);
  /** Pelo atalho do cartão, o resumo pode estar fora da vista: rola até ele antes de abrir a janela presa a ele. */
  function abrir() {
    const botao = valor.current;
    if (!botao) return;
    botao.scrollIntoView?.({ block: 'nearest' });
    setAberta(botao);
  }
  useAtalhoDoCartao(atalho, {
    ver: () => irAte(valor.current ?? soLido.current ?? blocoLido.current, valor.current, 'center'),
    acrescentar: podeMudar ? { nome: titulo, abrir } : null
  });

  // Com abridores próprios (#442), quem só lê vê o bloco como ele é (o "lido"), sem nada que abra a janela.
  if (!aoSalvar) return abridores ? <div ref={blocoLido}>{lido}</div> : <span className="dado-editavel" ref={soLido}>{lido}</span>;
  const daJanela = aberta && <JanelaDasDatas {...janela} nome={nome} titulo={titulo} botao={aberta} aoSalvar={aoSalvar} aoFechar={() => setAberta(null)} />;
  if (abridores) return <>{abridores({ ref: valor, aberta: !!aberta, alternar: e => setAberta(aberta ? null : e.currentTarget) })}{daJanela}</>;
  return <>
    <button ref={valor} type="button" className="data-editavel-botao dado-editavel-botao datas-do-cartao-botao" aria-label={`${nome}: ${resumo}. Clique para mudar`}
      title="Clique para mudar" aria-haspopup="dialog" aria-expanded={!!aberta} onClick={e => setAberta(aberta ? null : e.currentTarget)}>
      {lido}
    </button>
    {daJanela}
  </>;
}

interface PropsDaJanela extends Omit<Props, 'resumo' | 'lido' | 'atalho' | 'aoSalvar'> {
  botao: HTMLElement;
  aoSalvar: (c: CamposDasDatas) => unknown;
  aoFechar: () => void;
}

/** As marcas de erro de um campo (aria-invalid e a descrição com o erro). */
type MarcasDoCampo = { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined };

/** O nome de sempre do botão que tira as datas. */
const REMOVER = 'Remover';

/** A janela das datas, presa ao resumo que a abriu. */
function JanelaDasDatas({ botao, nome, titulo, inicio, entrega, repeticao, rotuloDoRemover = REMOVER, inicial, conferir, aoSalvar, aoFechar }: PropsDaJanela) {
  const partes = partesDe(inicio, entrega);
  const [gravado] = useState(inicial);
  const [rascunho, setRascunho] = useState(gravado);
  const [ativa, setAtiva] = useState<QualData>(() => dataAtivaAoAbrir(partes, gravado));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const idDosErros = useId(), idDaNota = useId(), idDoLembrete = useId(), idDaRepeticao = useId(), idDaNotaDaRepeticao = useId();
  const campos = useRef<Partial<Record<QualData, HTMLInputElement | null>>>({});
  const ativaAoAbrir = useRef(ativa);
  // Ao abrir, o foco vai à data ativa (depois do painel, que põe o foco no primeiro botão dele).
  // Sem rolar: na primeira vez o painel ainda pode estar fora da tela, e o foco rolaria o cartão (o botão das datas sumiria do lugar).
  useEffect(() => { campos.current[ativaAoAbrir.current]?.focus({ preventScroll: true }); }, []);

  // A caixa de marcar só existe na janela com mais de uma data: numa só (a assinatura), o Remover já tira a data.
  const comCaixa = (parte?: DataDaJanela) => !!(parte?.opcional && inicio && entrega);
  /** A data que não se aplica agora: tem a caixa, e ela está desmarcada. O campo fica vazio, desligado. */
  const desligada = (qual: QualData, parte?: DataDaJanela) => comCaixa(parte) && !dataMarcada(rascunho, qual);
  const semEntrega = desligada('entrega', entrega);
  const erros: ErrosDosCampos<CampoDasDatas> = conferido ? conferir(rascunho) : {};
  const mensagens = Object.values(erros).filter(Boolean) as string[];
  const marcar = (campo: CampoDasDatas): MarcasDoCampo => {
    const erro = !!erros[campo];
    return { 'aria-invalid': erro || undefined, 'aria-describedby': erro ? idDosErros : undefined };
  };

  /** O X (e o fim da gravação): fecha, e o foco volta ao resumo. */
  function fechar() {
    aoFechar();
    botao.focus();
  }
  /** Confere e grava; sem mudança, só fecha. Gravado, a janela fecha e o foco volta ao resumo. */
  async function gravar(c: CamposDasDatas) {
    if (ocupado) return;
    setConferido(true);
    if (temErro(conferir(c))) return;
    if (!datasMudaram(c, gravado, partes)) { fechar(); return; }
    setOcupado(true);
    try {
      await aoSalvar(datasQueValem(c, partes));
      fechar();
    } catch (e) {
      falha(e);
    } finally {
      setOcupado(false);
    }
  }
  function remover() {
    const sem = removerDatas(rascunho, partes);
    setRascunho(sem);
    void gravar(sem);
  }
  /** A caixa de marcar de uma data: marcada, ela passa a ser a ativa; desmarcada a ativa, a outra passa a ser. */
  function marcarAData(qual: QualData, sim: boolean) {
    setRascunho(atual => marcarData(atual, qual, sim, hojeNaAgenda()));
    setAtiva(atual => sim ? qual : dataAtivaAoDesmarcar(partes, atual, qual));
  }
  /** Enter num campo salva (no calendário, o Enter escolhe o dia e não chega aqui). */
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type="checkbox"]), select')) { e.preventDefault(); void gravar(rascunho); }
  }

  const linha = (qual: QualData, parte: DataDaJanela, junto?: ReactNode) => <LinhaDaData qual={qual} parte={parte} rascunho={rascunho} ativa={ativa === qual}
    caixa={comCaixa(parte)} desligada={desligada(qual, parte)} marcas={marcar(qual)} campo={el => { campos.current[qual] = el; }}
    aoAtivar={() => setAtiva(qual)} aoMarcar={sim => marcarAData(qual, sim)} aoMudar={setRascunho}>{junto}</LinhaDaData>;
  const hora = entrega?.hora && <ListaDeHorarios rotulo={entrega.hora.rotulo} marcas={marcar('hora')} obrigatoria={entrega.hora.obrigatoria} desligada={semEntrega}
    valor={rascunho.hora} aoMudar={h => setRascunho(atual => ({ ...atual, hora: h }))} />;
  const lembrete = marcar('lembrete');
  // O calendário marca o dia da data ativa; a desligada não tem dia marcado.
  const ativaDesligada = desligada(ativa, ativa === 'inicio' ? inicio : entrega);

  return <MenuFlutuante painel semCobrirOBotao rotulo={titulo} botao={botao} aoFechar={aoFechar} travado={ocupado}>
    <div className="janela-datas" onKeyDown={teclar}>
      <div className="janela-datas-cabeca">
        <p className="janela-datas-titulo">{nome}</p>
        <BotaoDeIcone icone="fechar" rotulo="Fechar" dica="Fechar sem salvar" className="janela-datas-fechar" disabled={ocupado} onClick={fechar} />
      </div>
      <CalendarioDoMes escolhido={ativaDesligada ? null : isoDoTexto(textoDaData(rascunho, ativa))} aoEscolher={dia => setRascunho(atual => escolherDia(atual, ativa, dia))} />
      <div className="janela-datas-campos-da-janela" data-com-caixa={comCaixa(inicio) || comCaixa(entrega) || undefined} data-uma-data={!(inicio && entrega) || undefined}>
        {inicio && linha('inicio', inicio)}
        {entrega && linha('entrega', entrega, hora)}
        {/* No compromisso, o fim do horário fica embaixo da hora: "até 10:00". */}
        {entrega?.ate && <div className="janela-datas-campos janela-datas-fim">
          <span className="janela-datas-ate" aria-hidden="true">até</span>
          <ListaDeHorarios rotulo="Até" marcas={marcar('horaFim')} valor={rascunho.horaFim} aoMudar={h => setRascunho(atual => ({ ...atual, horaFim: h }))} />
        </div>}
        {repeticao && <div className="janela-datas-linha">
          <label className="janela-datas-rotulo" htmlFor={idDaRepeticao}>Repetição</label>
          <ListaDaJanela id={idDaRepeticao} disabled={!!repeticao.fixa} aria-describedby={repeticao.fixa ? idDaNotaDaRepeticao : undefined}
            value={repeticao.fixa ? repeticao.fixa.nome : rascunho.repetir} onChange={e => { const r = e.target.value; setRascunho(atual => ({ ...atual, repetir: r })); }}>
            {repeticao.fixa
              ? <option value={repeticao.fixa.nome}>{repeticao.fixa.nome}</option>
              : <><option value="">{NUNCA_SE_REPETE}</option>{repeticao.opcoes.map(o => <option key={o.valor} value={o.valor}>{o.nome}</option>)}</>}
          </ListaDaJanela>
          {repeticao.fixa && <p className="janela-datas-nota" id={idDaNotaDaRepeticao}>{repeticao.fixa.nota}</p>}
        </div>}
        {entrega?.lembrete && <div className="janela-datas-linha">
          <label className="janela-datas-rotulo" htmlFor={idDoLembrete}>Lembrete</label>
          <ListaDaJanela id={idDoLembrete} aria-invalid={lembrete['aria-invalid']} aria-describedby={[lembrete['aria-describedby'], idDaNota].filter(Boolean).join(' ')}
            disabled={semEntrega} value={semEntrega ? '' : rascunho.lembrete ?? ''} onChange={e => { const l = lerLembrete(e.target.value); setRascunho(atual => ({ ...atual, lembrete: l })); }}>
            <option value="">{SEM_LEMBRETE}</option>
            {OPCOES_DE_LEMBRETE.map(l => <option key={l} value={l}>{LEMBRETES[l].nome}</option>)}
          </ListaDaJanela>
          <p className="janela-datas-nota" id={idDaNota}>{NOTA_CURTA_DO_LEMBRETE}</p>
        </div>}
      </div>
      {mensagens.length > 0 && <Aviso tipo="erro" id={idDosErros}>{mensagens.join(' ')}</Aviso>}
      <div className="janela-datas-acoes">
        <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado} onClick={() => void gravar(rascunho)}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
        {podeRemover(gravado, partes) && <button type="button" className={estiloBotao({ pequeno: true })} disabled={ocupado} onClick={remover}>{rotuloDoRemover}</button>}
      </div>
    </div>
  </MenuFlutuante>;
}

/** O tamanho da seta das listas da janela: a mesma da lista "Situação" do cartão. */
const TAMANHO_DA_SETA = 13;

/**
 * Uma lista da janela (a hora, a repetição, o lembrete), com a seta fina do sistema (Icone "abaixo"), como a lista "Situação" do
 * cartão, e não a seta do navegador. Desligada, fica sem a seta.
 */
function ListaDaJanela({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className={`janela-datas-lista ${className}`.trim()}>
    <select className="data-editavel-campo" {...props}>{children}</select>
    <span className="janela-datas-seta" aria-hidden="true"><Icone nome="abaixo" tam={TAMANHO_DA_SETA} /></span>
  </span>;
}

/** A escolha de quando não há hora, no começo da lista de horários. */
const SEM_HORA = 'Sem hora';

interface PropsDaLista {
  /** O nome da lista, para o leitor de tela (ex.: "Hora do prazo", "Até"). */
  rotulo: string;
  valor: string;
  marcas: MarcasDoCampo;
  obrigatoria?: boolean;
  /** A data dela não se aplica agora: a lista fica desligada, em "Sem hora". */
  desligada?: boolean;
  aoMudar: (hora: string) => void;
}

/** A hora numa lista de horários (#431): "Sem hora" e o dia de 15 em 15 minutos (horariosDaLista, em regras/janelaDasDatas.ts). */
function ListaDeHorarios({ rotulo, valor, marcas, obrigatoria, desligada, aoMudar }: PropsDaLista) {
  return <ListaDaJanela className="janela-datas-hora" aria-label={rotulo} {...marcas} aria-required={obrigatoria || undefined}
    disabled={desligada} value={desligada ? '' : valor} onChange={e => aoMudar(e.target.value)}>
    <option value="">{SEM_HORA}</option>
    {horariosDaLista(valor).map(h => <option key={h} value={h}>{h}</option>)}
  </ListaDaJanela>;
}

interface PropsDaLinha {
  qual: QualData;
  parte: DataDaJanela;
  rascunho: CamposDasDatas;
  /** É a data que o calendário preenche agora (a borda verde). */
  ativa: boolean;
  /** A data tem a caixa de marcar. */
  caixa: boolean;
  /** A caixa está desmarcada: o campo fica vazio e desligado. */
  desligada: boolean;
  marcas: MarcasDoCampo;
  campo: (el: HTMLInputElement | null) => void;
  aoAtivar: () => void;
  aoMarcar: (sim: boolean) => void;
  aoMudar: (mudar: (atual: CamposDasDatas) => CamposDasDatas) => void;
  /** O que vem ao lado da data (a hora). */
  children?: ReactNode;
}

/**
 * Uma data da janela (#431): o nome em cima ("Data de entrega") e, numa linha só, a caixa de marcar (se ela tem), o campo dd/mm/aaaa
 * e a hora. O nome é o rótulo da caixa de marcar (clicar nele marca ou desmarca); sem a caixa, o do campo. A data sem caixa começa
 * na mesma coluna do nome, sem lugar vazio na frente.
 */
function LinhaDaData({ qual, parte, rascunho, ativa, caixa, desligada, marcas, campo, aoAtivar, aoMarcar, aoMudar, children }: PropsDaLinha) {
  const idDaCaixa = useId(), idDoCampo = useId();
  return <div className="janela-datas-linha" data-ativa={ativa || undefined} data-sem-caixa={!caixa || undefined}>
    {parte.rotulo && <label className="janela-datas-rotulo" htmlFor={caixa ? idDaCaixa : idDoCampo}>{parte.rotulo}</label>}
    <span className="janela-datas-campos">
      {caixa && <input type="checkbox" id={idDaCaixa} className="janela-datas-caixa" checked={!desligada} onChange={e => aoMarcar(e.target.checked)} />}
      <input ref={campo} id={idDoCampo} type="text" inputMode="numeric" placeholder="DD/MM/AAAA" autoComplete="off" className="data-editavel-campo janela-datas-data"
        aria-label={parte.nome} {...marcas} disabled={desligada} value={desligada ? '' : textoDaData(rascunho, qual)} onFocus={aoAtivar} onClick={aoAtivar}
        onChange={e => { const texto = textoDaDataDigitada(e.target.value); aoMudar(atual => escreverData(atual, qual, texto)); }} />
      {children}
    </span>
  </div>;
}
