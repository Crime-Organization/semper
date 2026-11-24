// As datas do cartão numa janela própria (#422), a mesma em todos os cartões com datas (tarefa, demanda, compromisso, contrato).
// No cartão fica só um resumo curto ("Início 20/11/2026 · Entrega 15/12/2030 às 14:00"); quem pode alterar o cartão clica nele e
// abre uma janela pequena que flutua sobre o cartão, do jeito da janela das etiquetas (MenuFlutuante): o calendário do mês (o mesmo
// do campo de data, CalendarioDoMes, com o "Hoje"), cada data com a caixa de marcar (a que pode ficar sem data), a hora, o fim
// ("Até", no compromisso), a repetição (só para ler), o lembrete, Salvar e Remover. O calendário escreve na data ativa: a última em
// que a pessoa clicou (ao abrir, a entrega). Salvar confere pelas regras do cadastro, grava e fecha; com erro, a janela fica aberta
// e diz o que falta. Esc ou um clique fora fecham sem mudar nada; durante a gravação, a janela não fecha. Remover tira as datas que
// podem ficar sem data e grava. O rascunho e o que cada clique faz nele ficam em regras/janelaDasDatas.ts.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { hojeNaAgenda } from '../../regras/agenda';
import { isoDoTexto, textoDaDataDigitada } from '../../regras/campoData';
import { temErro, type ErrosDosCampos } from '../../regras/datasNoCartao';
import {
  dataAtivaAoAbrir, dataMarcada, datasMudaram, datasQueValem, escolherDia, escreverData, marcarData, podeRemover, removerDatas, textoDaData,
  SEPARADOR_DO_RESUMO, type CampoDasDatas, type CamposDasDatas, type PartesDasDatas, type PedacoDoResumo, type QualData
} from '../../regras/janelaDasDatas';
import { lerLembrete, LEMBRETES, NOTA_DO_LEMBRETE, OPCOES_DE_LEMBRETE, SEM_LEMBRETE } from '../../regras/lembrete';
import type { TipoDeAtalho } from '../../regras/atalhosDoCartao';
import { falha } from '../avisos';
import { MenuFlutuante } from '../Menu';
import { useAtalhoDoCartao } from '../registroDeAtalhos';
import { irAte } from '../rolagem';
import { estiloBotao } from './botao';
import { CalendarioDoMes } from './CampoData';
import { Aviso } from '.';
import './JanelaDasDatas.css';

/** Uma data da janela: o nome curto, em cima do campo ("Início"), e o nome inteiro do campo, para o leitor de tela ("Data de início"). */
export interface DataDaJanela {
  rotulo: string;
  nome: string;
  /** A data pode ficar vazia: ganha a caixa de marcar, e o Remover a tira. */
  opcional?: boolean;
}
/** A entrega (no compromisso, a data dele; no contrato, a assinatura), com o que pode vir junto dela. */
export interface EntregaDaJanela extends DataDaJanela {
  /** A hora da entrega: o nome dela para o leitor de tela (ex.: "Hora do prazo"). */
  hora?: { rotulo: string; obrigatoria?: boolean };
  /** O fim do horário ("Até", no compromisso). */
  ate?: boolean;
  /** O lembrete da entrega (tarefas e demandas). */
  lembrete?: boolean;
}

interface Props {
  /** O nome das datas no cartão (ex.: "Datas"): no botão que abre a janela. */
  nome: string;
  /** O nome da janela aberta (ex.: "Mudar as datas"). */
  titulo: string;
  /** O resumo por extenso, para o leitor de tela (ex.: "Início 20/11/2026 · Entrega 15/12/2030, lembrete: 1 hora antes"). */
  resumo: string;
  /** O resumo curto como aparece no cartão: no botão, para quem muda; como texto, para quem só lê. Só texto em linha. */
  lido: ReactNode;
  inicio?: DataDaJanela;
  entrega?: EntregaDaJanela;
  /** Como o item se repete, por extenso (só para ler: a repetição se muda no lápis ou no cadastro). */
  repeticao?: string;
  /** O rascunho com o que está gravado, quando a janela abre. */
  inicial: () => CamposDasDatas;
  /** Os erros do rascunho, pelas regras do cadastro (vazio: pode salvar). */
  conferir: (c: CamposDasDatas) => ErrosDosCampos<CampoDasDatas>;
  /** Grava as datas que valem (já conferidas). Sem isto, as datas só se leem. Se falhar, o erro aparece e a janela fica aberta. */
  aoSalvar?: (c: CamposDasDatas) => unknown;
  /** A linha que as datas oferecem ao menu "Acrescentar ao cartão" (#399): o "ver" leva até elas; o "+" abre a janela. */
  atalho?: TipoDeAtalho;
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
export function DatasDoCartao({ nome, titulo, resumo, lido, atalho, aoSalvar, ...janela }: Props) {
  const [aberta, setAberta] = useState<HTMLElement | null>(null);
  const valor = useRef<HTMLButtonElement>(null), soLido = useRef<HTMLSpanElement>(null);
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
    ver: () => irAte(valor.current ?? soLido.current, valor.current, 'center'),
    acrescentar: podeMudar ? { nome: titulo, abrir } : null
  });

  if (!aoSalvar) return <span className="dado-editavel" ref={soLido}>{lido}</span>;
  return <>
    <button ref={valor} type="button" className="data-editavel-botao dado-editavel-botao datas-do-cartao-botao" aria-label={`${nome}: ${resumo}. Clique para mudar`}
      title="Clique para mudar" aria-haspopup="dialog" aria-expanded={!!aberta} onClick={e => setAberta(aberta ? null : e.currentTarget)}>
      {lido}
    </button>
    {aberta && <JanelaDasDatas {...janela} titulo={titulo} botao={aberta} aoSalvar={aoSalvar} aoFechar={() => setAberta(null)} />}
  </>;
}

interface PropsDaJanela extends Omit<Props, 'nome' | 'resumo' | 'lido' | 'atalho' | 'aoSalvar'> {
  botao: HTMLElement;
  aoSalvar: (c: CamposDasDatas) => unknown;
  aoFechar: () => void;
}

/** A janela das datas, presa ao resumo que a abriu. */
function JanelaDasDatas({ botao, titulo, inicio, entrega, repeticao, inicial, conferir, aoSalvar, aoFechar }: PropsDaJanela) {
  const partes = partesDe(inicio, entrega);
  const [gravado] = useState(inicial);
  const [rascunho, setRascunho] = useState(gravado);
  const [ativa, setAtiva] = useState<QualData>(() => dataAtivaAoAbrir(partes));
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const idDosErros = useId(), idDaNota = useId();
  const campos = useRef<Partial<Record<QualData, HTMLInputElement | null>>>({});
  const ativaAoAbrir = useRef(ativa);
  // Ao abrir, o foco vai à data ativa (depois do painel, que põe o foco no primeiro botão dele); desmarcada, à caixa de marcar dela.
  useEffect(() => {
    const campo = campos.current[ativaAoAbrir.current];
    // Sem rolar: na primeira vez o painel ainda pode estar fora da tela, e o foco rolaria o cartão (o botão das datas sumiria do lugar).
    (campo && !campo.disabled ? campo : campo?.closest('.janela-datas-linha')?.querySelector<HTMLInputElement>('input[type="checkbox"]'))?.focus({ preventScroll: true });
  }, []);

  const erros: ErrosDosCampos<CampoDasDatas> = conferido ? conferir(rascunho) : {};
  const mensagens = Object.values(erros).filter(Boolean) as string[];
  const marcar = (campo: CampoDasDatas) => {
    const erro = !!erros[campo];
    return { 'aria-invalid': erro || undefined, 'aria-describedby': erro ? idDosErros : undefined };
  };

  /** Confere e grava; sem mudança, só fecha. Gravado, a janela fecha e o foco volta ao resumo. */
  async function gravar(c: CamposDasDatas) {
    if (ocupado) return;
    setConferido(true);
    if (temErro(conferir(c))) return;
    if (!datasMudaram(c, gravado, partes)) { aoFechar(); botao.focus(); return; }
    setOcupado(true);
    try {
      await aoSalvar(datasQueValem(c, partes));
      aoFechar();
      botao.focus();
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
  /** Enter num campo salva (no calendário, o Enter escolhe o dia e não chega aqui). */
  function teclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' && (e.target as HTMLElement).matches('input:not([type="checkbox"]), select')) { e.preventDefault(); void gravar(rascunho); }
  }

  const semEntrega = !!entrega?.opcional && !dataMarcada(rascunho, 'entrega');
  const linha = (qual: QualData, parte: DataDaJanela, junto?: ReactNode) => <LinhaDaData qual={qual} parte={parte} rascunho={rascunho} ativa={ativa === qual}
    marcas={marcar(qual)} campo={el => { campos.current[qual] = el; }} aoAtivar={() => setAtiva(qual)} aoMudar={setRascunho}>{junto}</LinhaDaData>;

  return <MenuFlutuante painel rotulo={titulo} botao={botao} aoFechar={aoFechar} travado={ocupado}>
    <div className="janela-datas" onKeyDown={teclar}>
      <p className="rotulo-caps janela-datas-titulo">{titulo}</p>
      <CalendarioDoMes escolhido={isoDoTexto(textoDaData(rascunho, ativa))} aoEscolher={dia => setRascunho(atual => escolherDia(atual, ativa, dia))} />
      {inicio && linha('inicio', inicio)}
      {entrega && linha('entrega', entrega, <>
        {entrega.hora && <input type="time" className="data-editavel-campo janela-datas-hora" aria-label={entrega.hora.rotulo} {...marcar('hora')}
          aria-required={entrega.hora.obrigatoria || undefined} disabled={semEntrega} value={rascunho.hora}
          onChange={e => setRascunho(atual => ({ ...atual, hora: e.target.value }))} />}
        {entrega.ate && <label className="janela-datas-ate">Até
          <input type="time" className="data-editavel-campo janela-datas-hora" {...marcar('horaFim')} value={rascunho.horaFim}
            onChange={e => setRascunho(atual => ({ ...atual, horaFim: e.target.value }))} />
        </label>}
      </>)}
      {repeticao && <p className="janela-datas-linha"><span className="rotulo-caps">Repetição</span><span className="janela-datas-texto">{repeticao}</span></p>}
      {entrega?.lembrete && <div className="janela-datas-linha">
        <label className="rotulo-caps" htmlFor={idDaNota + '-lembrete'}>Lembrete</label>
        <select id={idDaNota + '-lembrete'} className="data-editavel-campo" aria-invalid={marcar('lembrete')['aria-invalid']}
          aria-describedby={[marcar('lembrete')['aria-describedby'], idDaNota].filter(Boolean).join(' ')}
          disabled={semEntrega} value={rascunho.lembrete ?? ''} onChange={e => { const lembrete = lerLembrete(e.target.value); setRascunho(atual => ({ ...atual, lembrete })); }}>
          <option value="">{SEM_LEMBRETE}</option>
          {OPCOES_DE_LEMBRETE.map(l => <option key={l} value={l}>{LEMBRETES[l].nome}</option>)}
        </select>
        <p className="janela-datas-nota" id={idDaNota}>{NOTA_DO_LEMBRETE}</p>
      </div>}
      {mensagens.length > 0 && <Aviso tipo="erro" id={idDosErros}>{mensagens.join(' ')}</Aviso>}
      <div className="janela-datas-acoes">
        {podeRemover(gravado, partes) && <button type="button" className={estiloBotao({ pequeno: true })} disabled={ocupado} onClick={remover}>Remover</button>}
        <button type="button" className={estiloBotao({ variante: 'principal', pequeno: true })} disabled={ocupado} onClick={() => void gravar(rascunho)}>
          {ocupado ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  </MenuFlutuante>;
}

interface PropsDaLinha {
  qual: QualData;
  parte: DataDaJanela;
  rascunho: CamposDasDatas;
  /** É a data que o calendário preenche agora. */
  ativa: boolean;
  marcas: { 'aria-invalid': true | undefined; 'aria-describedby': string | undefined };
  campo: (el: HTMLInputElement | null) => void;
  aoAtivar: () => void;
  aoMudar: (mudar: (atual: CamposDasDatas) => CamposDasDatas) => void;
  /** O que vem ao lado da data (a hora, o "Até"). */
  children?: ReactNode;
}

/** Uma data da janela: a caixa de marcar (se ela pode ficar vazia) com o nome, e o campo dd/mm/aaaa, com a hora ao lado. */
function LinhaDaData({ qual, parte, rascunho, ativa, marcas, campo, aoAtivar, aoMudar, children }: PropsDaLinha) {
  const marcada = !parte.opcional || dataMarcada(rascunho, qual);
  return <div className="janela-datas-linha" data-ativa={ativa || undefined}>
    {parte.opcional
      ? <label className="rotulo-caps janela-datas-marcar">
        <input type="checkbox" checked={marcada} onChange={e => { const sim = e.target.checked; aoMudar(atual => marcarData(atual, qual, sim, hojeNaAgenda())); if (sim) aoAtivar(); }} />
        {parte.rotulo}
      </label>
      : <span className="rotulo-caps">{parte.rotulo}</span>}
    <span className="janela-datas-campos">
      <input ref={campo} type="text" inputMode="numeric" placeholder="DD/MM/AAAA" autoComplete="off" className="data-editavel-campo janela-datas-data"
        aria-label={parte.nome} {...marcas} disabled={!marcada} value={textoDaData(rascunho, qual)} onFocus={aoAtivar} onClick={aoAtivar}
        onChange={e => { const texto = textoDaDataDigitada(e.target.value); aoMudar(atual => escreverData(atual, qual, texto)); }} />
      {children}
    </span>
  </div>;
}
