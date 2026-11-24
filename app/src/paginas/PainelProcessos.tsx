// Painel de Processos, ao clicar em "Processos" no menu (#401): o trabalho de quem está logado, em todos os tipos de processo. No alto,
// os números (ativos, prazos vencidos e desta semana, audiências e perícias, intimações a tratar, parados), cada um levando à lista
// dele; depois, os gráficos (prazos das próximas semanas, o movimento dos últimos meses e os processos em cada fase); embaixo, as
// listas de sempre. Só o administrador tem o filtro para ver a equipe toda ou uma pessoa da equipe. Este painel é o modelo dos
// painéis do Início e do Financeiro: as peças ficam em ui/painel/ e ui/Graficos.tsx.
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { SD, type AndamentoNoPainel, type GraficosDeProcessos, type PainelDeProcessos, type ProcessoNoPainel } from '../dados';
import { DIAS_PARADO } from '../dados/limites';
import { nomeDoAndamento, quandoDoAndamento, tarefaDaIntimacao } from '../regras/andamentos';
import { FRASE_DO_ALCANCE, type AlcanceDoPainel } from '../regras/filtroDoPainel';
import {
  ativosPorExtenso, ativosPorTipo, enderecoDoTipo, fasesDosProcessos, movimentoPorMes, painelDaPessoa, prazosPorSemana, SEMANAS_DE_PRAZOS, totalDeAtivos, MESES_DO_MOVIMENTO,
  type BarraDePrazos, type ColunasDosQuadros, type MesDoMovimento
} from '../regras/graficosDeProcessos';
import { DIAS_DE_MARCADOS, enderecoDaFase, enderecoDoProcesso, erroDosDiasParado, fasesDoTipo, gruposDePrazos, ITENS_POR_LISTA, linhaDoProcesso, processoParaTarefa, rotuloNoPainel, ULTIMOS_ANDAMENTOS } from '../regras/painelProcessos';
import { fmtData } from '../regras/pessoa';
import { SEM_SITUACAO_PROCESSO, TIPOS, TIPOS_PROCESSO } from '../regras/processo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Campo, Carregando, estiloBotao, Nota, propsDoCampo, Selo, Vazio } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { BarrasDeitadas, BarrasPorMes, type Serie } from '../ui/Graficos';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { FiltroDoPainel, useAlcanceDoPainel } from '../ui/painel/FiltroDoPainel';
import { CabecaDoPainel, CartaoDoPainel, NumeroDoPainel, NumerosDoPainel, Painel } from '../ui/painel/Painel';
import { useCtx } from '../ui/sessao';
import { useAjudaDaTela } from '../ui/BotaoDeAjuda';
import { hojeISO, useTitulo } from '../ui/util';
import { arquivarTarefaCriada, criarTarefaLigada, quemRecebe } from './processo/tarefaDoProcesso';
import './Processos.css';

/** A preferência que guarda a escolha do filtro do administrador. */
const PREFERENCIA_DO_FILTRO = 'processos.painel.ver';
/** Os lugares da página aonde os números do alto levam. */
const LISTA = { prazos: 'painel-prazos', marcados: 'painel-marcados', intimacoes: 'painel-intimacoes', parados: 'painel-parados' } as const;

const PRAZOS: Serie = { chave: 'n', nome: 'Prazos', cor: 'var(--grafico-principal)' };
const ANDAMENTOS: Serie = { chave: 'andamentos', nome: 'Andamentos', cor: 'var(--grafico-principal)' };
const NOVOS: Serie = { chave: 'novos', nome: 'Novos', cor: 'var(--grafico-entrada)' };
const ENCERRADOS: Serie = { chave: 'encerrados', nome: 'Encerrados', cor: 'var(--grafico-saida)' };
const contagem = (n: number) => n.toLocaleString('pt-BR');
const doMovimento = (m: MesDoMovimento, s: string) => m[s as 'andamentos' | 'novos' | 'encerrados'];

/** "Mostrando 100 de 130", quando a lista veio cortada. */
const MaisDoQueCabe = ({ total, de = '' }: { total: number; de?: string }) => total > ITENS_POR_LISTA ? <Nota>Mostrando {ITENS_POR_LISTA} de {total}{de}.</Nota> : null;

/** O que o painel lê: as listas (painel_de_processos) e os números dos gráficos. */
interface Leitura { painel: PainelDeProcessos; graficos: GraficosDeProcessos; incompleto: boolean }
/** As listas do alcance: o banco separa as de quem está logado; as de outra pessoa saem das da equipe. */
async function lerPainel(alcance: AlcanceDoPainel, hoje: string): Promise<Leitura> {
  const [painel, graficos] = await Promise.all([SD.processosPainel({ hoje, meus: alcance.tipo === 'eu' }), SD.processosGraficos({ hoje, pessoa: alcance.pessoa })]);
  if (alcance.tipo !== 'pessoa') return { painel, graficos, incompleto: false };
  return { ...painelDaPessoa(painel, alcance.pessoa, hoje), graficos };
}

export default function PainelProcessos() {
  useTitulo('Processos');
  const abrirAjuda = useAjudaDaTela('painelProcessos');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [alcance, escolher] = useAlcanceDoPainel(PREFERENCIA_DO_FILTRO);
  const [lido, setLido] = useState<Leitura | string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [colunas, setColunas] = useState<ColunasDosQuadros | string | null>(null);
  const hoje = hojeISO();

  // Só vale a leitura mais recente: trocar o filtro não pode trazer de volta o painel anterior. Enquanto lê de novo, o painel que já
  // está na tela fica, mais claro, sem pular.
  const ultima = useRef(0);
  const jaLeu = useRef(false);
  const carregar = useCallback(async () => {
    const esta = ++ultima.current;
    setLendo(true);
    try {
      const novo = await lerPainel(alcance, hojeISO());
      if (esta !== ultima.current) return;
      jaLeu.current = true;
      setLido(novo);
    } catch (e) {
      if (esta !== ultima.current) return;
      if (jaLeu.current) falha(e); else setLido((e as Error).message);
    }
    if (esta === ultima.current) setLendo(false);
  }, [alcance]);
  useEffect(() => { void carregar(); }, [carregar]);
  useMudancas(() => { void carregar(); });
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro).then(c => [t, c] as const)))
      .then(pares => setColunas(Object.fromEntries(pares))).catch(e => setColunas((e as Error).message));
  }, []);

  async function criarTarefa(a: AndamentoNoPainel) {
    try {
      const r = await criarTarefaLigada(tarefaDaIntimacao(processoParaTarefa(a.processo), a, quemRecebe(eu, ctx.equipe)),
        id => SD.processoAndamentoAtualizar(a.id, { tarefa_id: id, tratada_em: new Date().toISOString() }));
      feito(`Tarefa ${r.codigo} criada.`, 'criação da tarefa', async () => {
        await SD.processoAndamentoAtualizar(a.id, { tarefa_id: null, tratada_em: null });
        await arquivarTarefaCriada(r.id);
      });
    } catch (e) { falha(e); }
    await carregar();
  }

  const nomeDaPessoa = ctx.equipe.find(m => m.id === alcance.pessoa)?.nome ?? '';
  const cabecalho = <CabecaDoPainel titulo="Processos" frase={FRASE_DO_ALCANCE[alcance.tipo](nomeDaPessoa)} aoAbrirAjuda={abrirAjuda}>
    {ctx.ehAdmin && <FiltroDoPainel alcance={alcance} equipe={ctx.equipe} eu={eu} aoEscolher={escolher} />}
  </CabecaDoPainel>;
  const moldura = (conteudo: ReactNode) => <div className="miolo do-painel">{cabecalho}{conteudo}</div>;
  if (typeof lido === 'string') return moldura(<Aviso tipo="erro">{lido}</Aviso>);
  if (typeof colunas === 'string') return moldura(<Aviso tipo="erro">{colunas}</Aviso>);
  if (!lido || !colunas) return moldura(<Carregando />);

  const { painel, graficos, incompleto } = lido;
  if (!graficos.processos.length) return moldura(<Vazio>
    <p className="painel-vazio-titulo">{alcance.tipo === 'eu' ? 'Você ainda não está em nenhum processo.' : 'Nenhum processo por aqui.'}</p>
    <p>Quando houver processos {alcance.tipo === 'eu' ? 'em que você é responsável ou colaborador' : 'neste filtro'}, o painel mostra os números, os prazos das próximas semanas,
      o movimento de cada mês e as listas do dia.</p>
    <BotaoLink to="/processos/novo/" variante="principal">Cadastrar processo</BotaoLink>
  </Vazio>);

  const responsavel = (p: ProcessoNoPainel) => ctx.equipe.find(m => m.id === p.responsavel_id)?.nome || 'Usuário removido';
  const andamentoLigado = (a: AndamentoNoPainel): ItemLigado => ({
    id: a.id, para: enderecoDoProcesso(a.processo), codigo: nomeDoAndamento(a) + ' · ' + quandoDoAndamento(a), titulo: linhaDoProcesso(a.processo), detalhe: a.texto
  });
  const grupos = gruposDePrazos(painel.prazos, hoje);
  const semanas = prazosPorSemana(graficos.prazos, hoje);
  const [vencidos, estaSemana] = semanas;
  const ativos = ativosPorTipo(graficos.processos, colunas);
  const meses = movimentoPorMes(graficos, hoje, colunas);
  const fases = fasesDosProcessos(graficos.processos);
  const fasesPorTipo = TIPOS.map(t => ({ tipo: t, fases: fasesDoTipo(fases, t, colunas[t] ?? [], SEM_SITUACAO_PROCESSO) }));
  const maiorFase = Math.max(1, ...fasesPorTipo.flatMap(x => x.fases.map(f => f.n)));
  const nenhumMovimento = meses.every(m => !m.andamentos && !m.novos && !m.encerrados);

  return <div className={'miolo do-painel' + (lendo ? ' atualizando' : '')} aria-busy={lendo}>
    {cabecalho}

    <NumerosDoPainel rotulo="Números do painel">
      <NumeroDoPainel rotulo="Processos ativos" valor={totalDeAtivos(ativos)} tom="neutro"
        partes={TIPOS.map(t => ({ chave: t, texto: ativosPorExtenso(t, ativos[t]), para: enderecoDoTipo(t, alcance.pessoa) }))} />
      <NumeroDoPainel rotulo="Prazos vencidos" valor={vencidos.n} tom={vencidos.n ? 'erro' : 'neutro'} para={'#' + LISTA.prazos}
        detalhe={vencidos.n ? 'o último dia já passou' : 'nenhum prazo atrasado'} />
      <NumeroDoPainel rotulo="Prazos desta semana" valor={estaSemana.n} para={'#' + LISTA.prazos} detalhe={`de hoje a ${fmtData(estaSemana.ate!).slice(0, 5)}`} />
      <NumeroDoPainel rotulo="Audiências e perícias" valor={painel.total_marcados} para={'#' + LISTA.marcados} detalhe={`nos próximos ${DIAS_DE_MARCADOS} dias`} />
      <NumeroDoPainel rotulo="Intimações a tratar" valor={painel.total_intimacoes} tom={painel.total_intimacoes ? 'alerta' : 'neutro'} para={'#' + LISTA.intimacoes}
        detalhe="sem tarefa criada" />
      <NumeroDoPainel rotulo={`Parados há mais de ${painel.dias_parado} dias`} valor={painel.total_parados} tom={painel.total_parados ? 'alerta' : 'neutro'}
        para={'#' + LISTA.parados} detalhe="sem andamento lançado" />
    </NumerosDoPainel>

    <Painel>
      <CartaoDoPainel titulo={`Próximas ${SEMANAS_DE_PRAZOS} semanas`} largura="terco" nota="Os prazos em aberto de cada semana, a partir de hoje, e os já vencidos.">
        <BarrasPorMes<BarraDePrazos> rotulo={`Prazos em aberto: os vencidos e os de cada uma das próximas ${SEMANAS_DE_PRAZOS} semanas`} itens={semanas} series={[PRAZOS]}
          valor={b => b.n} formatar={contagem} formatarCurto={contagem} corDoItem={b => b.vencidos && b.n ? 'var(--grafico-vencido)' : undefined}
          rotulos escalaInteira tabelaVisivel />
      </CartaoDoPainel>

      <CartaoDoPainel titulo={`Últimos ${MESES_DO_MOVIMENTO} meses`} largura="dois-tercos" nota={nenhumMovimento ? 'Nenhum andamento lançado nem processo novo ou encerrado no período.' : undefined}>
        <div className="painel-dupla">
          <section aria-labelledby="grafico-andamentos">
            <h3 className="painel-subtitulo" id="grafico-andamentos">Andamentos lançados</h3>
            <BarrasPorMes<MesDoMovimento> rotulo={`Andamentos lançados em cada um dos últimos ${MESES_DO_MOVIMENTO} meses`} itens={meses} series={[ANDAMENTOS]}
              valor={doMovimento} formatar={contagem} formatarCurto={contagem} escalaInteira tabelaVisivel />
          </section>
          <section aria-labelledby="grafico-novos">
            <h3 className="painel-subtitulo" id="grafico-novos">Processos novos e encerrados</h3>
            <BarrasPorMes<MesDoMovimento> rotulo={`Processos novos e encerrados em cada um dos últimos ${MESES_DO_MOVIMENTO} meses`} itens={meses} series={[NOVOS, ENCERRADOS]}
              valor={doMovimento} formatar={contagem} formatarCurto={contagem} escalaInteira tabelaVisivel />
          </section>
        </div>
      </CartaoDoPainel>

      <CartaoDoPainel titulo="Processos por fase" nota="Quantos processos não arquivados há em cada coluna do quadro. Clique numa coluna para ver a lista dela.">
        <div className="painel-dupla">
          {fasesPorTipo.map(({ tipo, fases }) => <section key={tipo} aria-label={TIPOS_PROCESSO[tipo].titulo}>
            <h3 className="painel-subtitulo">{TIPOS_PROCESSO[tipo].nome} <span className="painel-subtitulo-numero">{contagem(fases.reduce((s, f) => s + f.n, 0))}</span></h3>
            {fases.length
              ? <BarrasDeitadas rotulo={`${TIPOS_PROCESSO[tipo].titulo} em cada fase`} cor="var(--grafico-principal)" maior={maiorFase}
                linhas={fases.map(f => ({ chave: f.chave, nome: f.nome, n: f.n, para: enderecoDaFase(tipo, f.chave, alcance.pessoa) }))} />
              : <Nota>Nenhum processo.</Nota>}
          </section>)}
        </div>
      </CartaoDoPainel>

      {incompleto && <div className="painel-cartao inteira"><Nota>Algumas listas da equipe passam de {ITENS_POR_LISTA} itens: as de {nomeDaPessoa} podem não estar completas.</Nota></div>}

      <CartaoDoPainel titulo="Prazos" id={LISTA.prazos} largura="metade" contador={contagem(painel.total_vencidos + painel.total_a_vencer)}>
        {!grupos.length && <Vazio>Nenhum prazo vencido nem para os próximos dias.</Vazio>}
        {grupos.map(g => <section key={g.titulo} aria-label={g.titulo}>
          <h3 className="painel-grupo">{g.destaque ? <Selo tipo="erro">{g.titulo}</Selo> : <Selo tipo="pend">{g.titulo}</Selo>}</h3>
          <ItensLigados itens={g.prazos.map(z => ({
            id: z.id, para: enderecoDoProcesso(z.processo), codigo: rotuloNoPainel(z, hoje) + ' · ' + fmtData(z.final), titulo: z.descricao,
            detalhe: `${linhaDoProcesso(z.processo)} · ${responsavel(z.processo)}`
          }))} />
        </section>)}
        <MaisDoQueCabe total={painel.total_vencidos} de=" vencidos" />
        <MaisDoQueCabe total={painel.total_a_vencer} de=" a vencer" />
      </CartaoDoPainel>

      <CartaoDoPainel titulo="Audiências e perícias" id={LISTA.marcados} largura="metade" contador={contagem(painel.total_marcados)}>
        <ListaDoPainel vazio="Nenhuma audiência ou perícia marcada para os próximos dias." itens={painel.marcados.map(andamentoLigado)} />
        <MaisDoQueCabe total={painel.total_marcados} />
      </CartaoDoPainel>

      <CartaoDoPainel titulo="Intimações a tratar" id={LISTA.intimacoes} largura="metade" contador={contagem(painel.total_intimacoes)}>
        <ListaDoPainel vazio="Nenhuma intimação a tratar." itens={painel.intimacoes.map(a => ({
          ...andamentoLigado(a),
          acao: ctx.escritorio?.modulos?.tarefas && <Botao forma="mini" ocupadoTexto="Criando…" aria-label={`Criar tarefa da intimação: ${a.texto.slice(0, 60)}`} onClick={() => criarTarefa(a)}>Criar tarefa</Botao>
        }))} />
        <MaisDoQueCabe total={painel.total_intimacoes} />
      </CartaoDoPainel>

      <CartaoDoPainel titulo="Últimos andamentos" largura="metade">
        <ListaDoPainel vazio="Nenhum andamento lançado." itens={painel.ultimos.slice(0, ULTIMOS_ANDAMENTOS).map(andamentoLigado)} />
      </CartaoDoPainel>

      <CartaoDoPainel titulo="Processos parados" id={LISTA.parados} contador={contagem(painel.total_parados)} nota={`Sem andamento há mais de ${painel.dias_parado} dias. É hora de consultar a movimentação.`}>
        <ListaDoPainel vazio="Nenhum processo parado." itens={painel.parados.map(x => ({
          id: x.processo.id, para: enderecoDoProcesso(x.processo), codigo: `${x.dias} dias sem andamento · desde ${fmtData(x.ultimo)}`, titulo: linhaDoProcesso(x.processo), detalhe: responsavel(x.processo)
        }))} />
        <MaisDoQueCabe total={painel.total_parados} />
        {ctx.ehAdmin && <DiasParado atual={painel.dias_parado} aoSalvar={carregar} />}
      </CartaoDoPainel>
    </Painel>
  </div>;
}

/** Uma lista do painel: os itens, ou, sem nenhum, o vazio pontilhado, como as listas do Início. */
function ListaDoPainel({ itens, vazio }: { itens: ItemLigado[]; vazio: string }) {
  return itens.length ? <ItensLigados itens={itens} /> : <Vazio>{vazio}</Vazio>;
}

/** Quantos dias sem andamento fazem o processo aparecer como parado: o administrador muda para o escritório todo. */
function DiasParado({ atual, aoSalvar }: { atual: number; aoSalvar: () => Promise<void> }) {
  const [texto, setTexto] = useState(String(atual));
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    const problema = erroDosDiasParado(texto);
    setErro(problema ?? '');
    if (problema || ocupado) return;
    setOcupado(true);
    try {
      await SD.processosDiasParadoSalvar(Number(texto));
      avisar('Prazo de processo parado atualizado.');
      await aoSalvar();
    } catch (e) { falha(e); }
    setOcupado(false);
  }
  return <form className="painel-dias" noValidate aria-label="Dias para considerar parado" onSubmit={salvar}>
    <Campo rotulo="Dias sem andamento para considerar parado" para="dias-parado" erro={erro}>
      <input type="number" inputMode="numeric" {...propsDoCampo('dias-parado', { erro })} min={DIAS_PARADO.minimo} max={DIAS_PARADO.maximo} value={texto} onChange={e => setTexto(e.target.value)} />
    </Campo>
    <button type="submit" className={estiloBotao()} disabled={ocupado}>Salvar</button>
  </form>;
}
