// Início: o painel de quem trabalha no escritório (#319), no padrão do painel de Processos (#402; peças em ui/painel e ui/Graficos.tsx).
// No alto, a saudação, a busca geral e, só para o administrador, o filtro do trabalho mostrado (o dele, o da equipe toda ou o de uma
// pessoa). Embaixo, os números do dia (cada um levando à lista), os gráficos (as tarefas por situação e o ritmo dos últimos dias) e as
// listas: prazos, agenda de hoje, tarefas em andamento, demandas por fase, processos, anotações, parcelas da semana (só para quem vê
// o Financeiro) e Pessoas. Sem nada ainda, o painel diz por onde começar. "Minha conta" tem página própria (MinhaConta.tsx).
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import type { CompromissoLista, Modulo } from '../dados';
import { hojeNaAgenda, horaNaAgenda } from '../regras/agenda';
import { FRASE_DO_ALCANCE, type AlcanceDoPainel } from '../regras/filtroDoPainel';
import { detalheDaAgenda, prazosDoDia, tarefasEmAberto, tarefasPorSituacao } from '../regras/graficosDoInicio';
import { blocosDoEscritorio, larguraDosBlocos, ligado, type ModulosLigados } from '../regras/painelInicial';
import { falha, useMudancas } from '../ui/avisos';
import { Aviso, BotaoLink, Carregando, Vazio } from '../ui/base';
import { CampoDaBuscaGeral } from '../ui/BuscaGeral';
import { FiltroDoPainel, useAlcanceDoPainel } from '../ui/painel/FiltroDoPainel';
import { CabecaDoPainel, NumeroDoPainel, NumerosDoPainel, Painel } from '../ui/painel/Painel';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { BLOCOS, LUGAR_DO_BLOCO } from './inicio/Blocos';
import { fontesDoPainel, type FontesDoPainel, type ResultadoDoBloco } from './inicio/fontes';
import { Ritmo, TarefasPorSituacao } from './inicio/GraficosDoInicio';
import './Inicio.css';

/** A preferência que guarda a escolha do filtro do administrador. */
const PREFERENCIA_DO_FILTRO = 'inicio.painel.ver';

/** O que os números do alto e os gráficos usam, lido de uma vez (as listas leem cada uma a sua, das mesmas fontes). */
interface Resumo {
  prazos: ResultadoDoBloco['prazos'];
  agenda: CompromissoLista[];
  demandas: ResultadoDoBloco['demandas'];
  graficos: Awaited<ReturnType<FontesDoPainel['graficos']>>;
  mensagens: number;
  /** Nada em nenhum módulo: o painel diz por onde começar. */
  nada: boolean;
}
/** Lê o resumo. O que é de um módulo desligado nem é lido. */
async function lerResumo(fontes: FontesDoPainel, modulos: ModulosLigados): Promise<Resumo> {
  const se = <T,>(modulo: Modulo, ler: () => Promise<T>, vazio: T) => ligado(modulo, modulos) ? ler() : Promise.resolve(vazio);
  const [prazos, agenda, demandas, graficos, mensagens, processos, anotacoes] = await Promise.all([
    fontes.prazos(), fontes.agenda(), fontes.demandas(), fontes.graficos(), fontes.mensagens(),
    se('processos', fontes.processos, { itens: [], total: 0 }), se('anotacoes', fontes.anotacoes, { itens: [], total: 0, completa: true })
  ]);
  const quantos = [prazos.itens.length, agenda.length, demandas.total, graficos.dados.tarefas.length, graficos.dados.tempos.length, processos.total, anotacoes.total];
  return { prazos, agenda, demandas, graficos, mensagens, nada: quantos.every(n => !n) };
}

type PropsDoNumero = ComponentProps<typeof NumeroDoPainel>;
/** Os números do alto, na ordem da tela (três por linha no computador), cada um com o módulo de que depende (null: sempre). */
type ChaveDoNumero = 'tarefas' | 'vencidos' | 'hoje' | 'compromissos' | 'mensagens' | 'demandas';
const NUMEROS: Record<ChaveDoNumero, { modulo: Modulo | null; montar: (r: Resumo, hoje: string) => PropsDoNumero }> = {
  tarefas: { modulo: 'tarefas', montar: (r, hoje) => {
    const s = tarefasPorSituacao(r.graficos.dados.tarefas, r.graficos.colunas, hoje);
    return { rotulo: 'Tarefas a fazer', valor: tarefasEmAberto(s), para: '#' + LUGAR_DO_BLOCO.tarefas, detalhe: `${s.fazendo} fazendo · ${s.aguardando} aguardando` };
  } },
  vencidos: { modulo: null, montar: (r, hoje) => {
    const n = prazosDoDia(r.prazos.itens, hoje).vencidos;
    return { rotulo: 'Prazos vencidos', valor: n, tom: n ? 'erro' : 'neutro', para: '#' + LUGAR_DO_BLOCO.prazos, detalhe: n ? 'o último dia já passou' : 'nenhum prazo atrasado' };
  } },
  hoje: { modulo: null, montar: (r, hoje) => {
    const n = prazosDoDia(r.prazos.itens, hoje).hoje;
    return { rotulo: 'Prazos de hoje', valor: n, tom: n ? 'alerta' : 'neutro', para: '#' + LUGAR_DO_BLOCO.prazos, detalhe: n ? 'o último dia é hoje' : 'nenhum vence hoje' };
  } },
  compromissos: { modulo: 'compromissos', montar: r =>
    ({ rotulo: 'Compromissos de hoje', valor: r.agenda.length, para: '#' + LUGAR_DO_BLOCO.agenda, detalhe: detalheDaAgenda(r.agenda, horaNaAgenda()) }) },
  mensagens: { modulo: null, montar: r =>
    ({ rotulo: 'Mensagens não lidas', valor: r.mensagens, tom: r.mensagens ? 'alerta' : 'neutro', para: '/mensagens/', detalhe: 'na sua caixa de mensagens' }) },
  demandas: { modulo: 'demandas', montar: r => ({
    rotulo: 'Demandas em aberto', valor: r.demandas.total, para: '#' + LUGAR_DO_BLOCO.demandas,
    detalhe: r.demandas.total ? `em ${r.demandas.situacoes.length} ${r.demandas.situacoes.length === 1 ? 'fase' : 'fases'} do quadro` : 'nenhuma em aberto'
  }) }
};
const ORDEM_DOS_NUMEROS = Object.keys(NUMEROS) as ChaveDoNumero[];

/** Por onde começar, no painel sem nada: o primeiro é o botão principal; cada um só com o módulo ligado. */
const PRIMEIROS_PASSOS: { modulo: Modulo; rotulo: string; para: string }[] = [
  { modulo: 'tarefas', rotulo: 'Criar tarefa', para: '/tarefas/nova/' },
  { modulo: 'compromissos', rotulo: 'Marcar compromisso', para: '/agenda/novo/' },
  { modulo: 'pessoas', rotulo: 'Cadastrar pessoa', para: '/pessoas/nova/' }
];

function PorOndeComecar({ alcance, modulos }: { alcance: AlcanceDoPainel; modulos: ModulosLigados }) {
  const eu = alcance.tipo === 'eu';
  const passos = PRIMEIROS_PASSOS.filter(p => ligado(p.modulo, modulos));
  return <Vazio>
    <p className="painel-vazio-titulo">{eu ? 'Seu painel começa aqui.' : 'Nada por aqui ainda.'}</p>
    <p>Quando houver tarefas, prazos, compromissos e demandas {eu ? 'com você' : 'neste filtro'}, o Início mostra os números do dia, as tarefas por
      situação, o ritmo dos últimos dias e as listas de hoje.</p>
    {eu && <div className="painel-vazio-acoes">
      {passos.map((p, i) => <BotaoLink key={p.para} to={p.para} variante={i ? 'padrao' : 'principal'}>{p.rotulo}</BotaoLink>)}
    </div>}
  </Vazio>;
}

export default function Inicio() {
  useTitulo('Início');
  const ctx = useCtx();
  const eu = ctx.perfil.id, modulos = ctx.escritorio?.modulos;
  const [alcance, escolher] = useAlcanceDoPainel(PREFERENCIA_DO_FILTRO);
  const hoje = hojeNaAgenda();
  // Depois de uma mudança em qualquer lugar (um cartão salvo, um aviso desfeito), ou com outro filtro, o painel lê tudo de novo.
  const [versao, setVersao] = useState(0);
  useMudancas(() => setVersao(v => v + 1));
  // Fontes novas (lidas de novo) a cada mudança, a cada troca do filtro e no dia seguinte; a versão vai junto, para dizer de qual vez são.
  const { fontes } = useMemo(() => ({ versao, fontes: fontesDoPainel(alcance, hoje, modulos ?? {}) }), [alcance, hoje, modulos, versao]);
  const [resumo, setResumo] = useState<Resumo | string | null>(null);
  const [lendo, setLendo] = useState(false);

  // Só vale a leitura mais recente: trocar o filtro não pode trazer de volta o painel anterior. Enquanto lê de novo, o painel que já
  // está na tela fica, mais claro, sem pular.
  const ultima = useRef(0);
  const jaLeu = useRef(false);
  const carregar = useCallback(async (f: FontesDoPainel) => {
    const esta = ++ultima.current;
    setLendo(true);
    try {
      const novo = await lerResumo(f, modulos);
      if (esta !== ultima.current) return;
      jaLeu.current = true;
      setResumo(novo);
    } catch (e) {
      if (esta !== ultima.current) return;
      if (jaLeu.current) falha(e); else setResumo((e as Error).message || 'Não foi possível carregar o painel.');
    }
    if (esta === ultima.current) setLendo(false);
  }, [modulos]);
  useEffect(() => { void carregar(fontes); }, [carregar, fontes]);

  const primeiro = (ctx.perfil.nome || '').trim().split(/\s+/)[0];
  const nomeDaPessoa = ctx.equipe.find(m => m.id === alcance.pessoa)?.nome ?? '';
  const cabecalho = <CabecaDoPainel titulo={'Olá' + (primeiro ? ', ' + primeiro : '')} frase={FRASE_DO_ALCANCE[alcance.tipo](nomeDaPessoa)}>
    <CampoDaBuscaGeral />
    {ctx.ehAdmin && <FiltroDoPainel alcance={alcance} equipe={ctx.equipe} eu={eu} aoEscolher={escolher} />}
  </CabecaDoPainel>;
  const moldura = (conteudo: ReactNode) => <div className="miolo do-painel painel-inicio">{cabecalho}{conteudo}</div>;
  if (typeof resumo === 'string') return moldura(<Aviso tipo="erro">{resumo}</Aviso>);
  if (!resumo) return moldura(<Carregando />);
  if (resumo.nada) return moldura(<PorOndeComecar alcance={alcance} modulos={modulos} />);

  const blocos = blocosDoEscritorio(modulos);
  const larguras = larguraDosBlocos(blocos);
  const comTarefas = ligado('tarefas', modulos);
  return <div className={'miolo do-painel painel-inicio' + (lendo ? ' atualizando' : '')} aria-busy={lendo}>
    {cabecalho}
    <NumerosDoPainel rotulo="Números do dia">
      {ORDEM_DOS_NUMEROS.filter(n => ligado(NUMEROS[n].modulo, modulos)).map(n => <NumeroDoPainel key={n} {...NUMEROS[n].montar(resumo, hoje)} />)}
    </NumerosDoPainel>
    <Painel>
      {comTarefas && <TarefasPorSituacao dados={resumo.graficos.dados} colunas={resumo.graficos.colunas} hoje={hoje} alcance={alcance} />}
      {comTarefas && <Ritmo dados={resumo.graficos.dados} hoje={hoje} />}
      {blocos.map(b => { const Bloco = BLOCOS[b]; return <Bloco key={b} fontes={fontes} hoje={hoje} modulos={modulos} alcance={alcance} largura={larguras[b]} />; })}
    </Painel>
  </div>;
}
