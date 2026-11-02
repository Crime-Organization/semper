// Painel de Processos, ao clicar em "Processos" no menu: prazos vencidos, de hoje e dos próximos 7 dias; audiências e
// perícias dos próximos 15; intimações a tratar, com "Criar tarefa"; últimos andamentos; processos parados; e quantos
// processos há em cada fase. Cada pessoa vê só os processos a que tem acesso; no alto, a escolha entre Meus e Todos.
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { SD, type AndamentoNoPainel, type Coluna, type PainelDeProcessos, type ProcessoNoPainel } from '../dados';
import { DIAS_PARADO } from '../dados/limites';
import { quandoDoAndamento, tarefaDaIntimacao, TIPOS_DE_ANDAMENTO } from '../regras/andamentos';
import { enderecoDaFase, enderecoDoProcesso, erroDosDiasParado, fasesDoTipo, gruposDePrazos, ITENS_POR_LISTA, linhaDoProcesso, processoParaTarefa, rotuloNoPainel, ULTIMOS_ANDAMENTOS } from '../regras/painelProcessos';
import { fmtData } from '../regras/pessoa';
import { SEM_SITUACAO_PROCESSO, TIPOS_PROCESSO } from '../regras/processo';
import { avisar, falha, feito, useMudancas } from '../ui/avisos';
import { Aviso, Campo, Carregando, Cartao, Escolhas, estiloBotao, Nota, propsDoCampo, Selo, TituloSecao } from '../ui/base';
import { Botao } from '../ui/Botoes';
import { ItensLigados, type ItemLigado } from '../ui/ItensLigados';
import { lerPreferencia, salvarPreferencia } from '../ui/preferencias';
import { useCtx } from '../ui/sessao';
import { hojeISO, useTitulo } from '../ui/util';
import { arquivarTarefaCriada, criarTarefaLigada, quemRecebe } from './processo/tarefaDoProcesso';
import './Processos.css';

const TIPOS = Object.keys(TIPOS_PROCESSO) as (keyof typeof TIPOS_PROCESSO)[];
type Alcance = 'todos' | 'meus';
const ALCANCES: Record<Alcance, string> = { todos: 'Todos', meus: 'Meus' };
type Colunas = Partial<Record<keyof typeof TIPOS_PROCESSO, Coluna[]>>;

/** "Mostrando 100 de 130", quando a lista veio cortada. */
const MaisDoQueCabe = ({ total, de = '' }: { total: number; de?: string }) => total > ITENS_POR_LISTA ? <Nota>Mostrando {ITENS_POR_LISTA} de {total}{de}.</Nota> : null;

export default function PainelProcessos() {
  useTitulo('Processos');
  const ctx = useCtx();
  const eu = ctx.perfil.id;
  const [alcance, setAlcance] = useState<Alcance>(() => lerPreferencia<Alcance>('processos.painel.alcance', 'todos') === 'meus' ? 'meus' : 'todos');
  const [painel, setPainel] = useState<PainelDeProcessos | string | null>(null);
  const [colunas, setColunas] = useState<Colunas | string | null>(null);
  const hoje = hojeISO();

  // Só vale a leitura mais recente: trocar de Meus para Todos não pode trazer de volta a lista anterior.
  const ultima = useRef(0);
  const jaLeu = useRef(false);
  const carregar = useCallback(async () => {
    const esta = ++ultima.current;
    try {
      const lido = await SD.processosPainel({ hoje: hojeISO(), meus: alcance === 'meus' });
      if (esta !== ultima.current) return;
      jaLeu.current = true;
      setPainel(lido);
    } catch (e) {
      if (esta !== ultima.current) return;
      if (jaLeu.current) falha(e); else setPainel((e as Error).message);
    }
  }, [alcance]);
  useEffect(() => { void carregar(); }, [carregar]);
  useMudancas(() => { void carregar(); });
  useEffect(() => {
    Promise.all(TIPOS.map(t => SD.colunasListar(TIPOS_PROCESSO[t].quadro).then(c => [t, c] as const)))
      .then(pares => setColunas(Object.fromEntries(pares))).catch(e => setColunas((e as Error).message));
  }, []);

  function escolher(a: Alcance) { setAlcance(a); salvarPreferencia('processos.painel.alcance', a); }

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

  const cabecalho = <header className="painel-cabeca">
    <h1 className="titulo">Processos<span className="ponto">.</span></h1>
    <Escolhas rotulo="Mostrar">
      {(Object.keys(ALCANCES) as Alcance[]).map(a => <label key={a}>
        <input type="radio" name="painel-alcance" checked={alcance === a} onChange={() => escolher(a)} />{ALCANCES[a]}
      </label>)}
    </Escolhas>
  </header>;
  if (typeof painel === 'string') return <div className="miolo">{cabecalho}<Aviso tipo="erro">{painel}</Aviso></div>;
  if (!painel) return <div className="miolo">{cabecalho}<Carregando /></div>;

  const responsavel = (p: ProcessoNoPainel) => ctx.equipe.find(m => m.id === p.responsavel_id)?.nome || 'Usuário removido';
  const andamentoLigado = (a: AndamentoNoPainel): ItemLigado => ({
    id: a.id, para: enderecoDoProcesso(a.processo), codigo: TIPOS_DE_ANDAMENTO[a.tipo].nome + ' · ' + quandoDoAndamento(a), titulo: linhaDoProcesso(a.processo), detalhe: a.texto
  });
  const grupos = gruposDePrazos(painel.prazos, hoje);
  const meus = alcance === 'meus' ? eu : null;

  return <div className="miolo painel-processos">
    {cabecalho}

    <Cartao className="painel-parte">
      <TituloSecao id="pPrazos">Prazos</TituloSecao>
      {!grupos.length && <Nota>Nenhum prazo vencido nem para os próximos dias.</Nota>}
      {grupos.map(g => <section key={g.titulo} aria-label={g.titulo}>
        <h3 className="painel-grupo">{g.destaque ? <Selo tipo="erro">{g.titulo}</Selo> : <Selo tipo="pend">{g.titulo}</Selo>}</h3>
        <ItensLigados itens={g.prazos.map(z => ({
          id: z.id, para: enderecoDoProcesso(z.processo), codigo: rotuloNoPainel(z, hoje) + ' · ' + fmtData(z.final), titulo: z.descricao,
          detalhe: `${linhaDoProcesso(z.processo)} · ${responsavel(z.processo)}`
        }))} />
      </section>)}
      <MaisDoQueCabe total={painel.total_vencidos} de=" vencidos" />
      <MaisDoQueCabe total={painel.total_a_vencer} de=" a vencer" />
    </Cartao>

    <Cartao className="painel-parte">
      <TituloSecao id="pMarcados">Audiências e perícias</TituloSecao>
      <ItensLigados vazio="Nenhuma audiência ou perícia marcada para os próximos dias." itens={painel.marcados.map(andamentoLigado)} />
      <MaisDoQueCabe total={painel.total_marcados} />
    </Cartao>

    <Cartao className="painel-parte">
      <TituloSecao id="pIntimacoes">Intimações a tratar</TituloSecao>
      <ItensLigados vazio="Nenhuma intimação a tratar." itens={painel.intimacoes.map(a => ({
        ...andamentoLigado(a),
        acao: ctx.escritorio?.modulos?.tarefas && <Botao forma="mini" ocupadoTexto="Criando…" aria-label={`Criar tarefa da intimação: ${a.texto.slice(0, 60)}`} onClick={() => criarTarefa(a)}>Criar tarefa</Botao>
      }))} />
      <MaisDoQueCabe total={painel.total_intimacoes} />
    </Cartao>

    <Cartao className="painel-parte">
      <TituloSecao id="pUltimos">Últimos andamentos</TituloSecao>
      <ItensLigados vazio="Nenhum andamento lançado." itens={painel.ultimos.slice(0, ULTIMOS_ANDAMENTOS).map(andamentoLigado)} />
    </Cartao>

    <Cartao className="painel-parte">
      <TituloSecao id="pParados">Processos parados</TituloSecao>
      <Nota>Sem andamento há mais de {painel.dias_parado} dias. É hora de consultar a movimentação.</Nota>
      <ItensLigados vazio="Nenhum processo parado." itens={painel.parados.map(x => ({
        id: x.processo.id, para: enderecoDoProcesso(x.processo), codigo: `${x.dias} dias sem andamento · desde ${fmtData(x.ultimo)}`, titulo: linhaDoProcesso(x.processo), detalhe: responsavel(x.processo)
      }))} />
      <MaisDoQueCabe total={painel.total_parados} />
      {ctx.ehAdmin && <DiasParado atual={painel.dias_parado} aoSalvar={carregar} />}
    </Cartao>

    <Cartao className="painel-parte">
      <TituloSecao id="pFases">Processos em cada fase</TituloSecao>
      {colunas === null ? <Carregando /> : typeof colunas === 'string' ? <Aviso tipo="erro">{colunas}</Aviso> : <div className="painel-fases">
        {TIPOS.map(t => {
          const fases = fasesDoTipo(painel.fases, t, colunas[t] ?? [], SEM_SITUACAO_PROCESSO);
          return <section key={t} aria-label={TIPOS_PROCESSO[t].titulo}>
            <h3 className="painel-grupo"><Link to={TIPOS_PROCESSO[t].caminho}>{TIPOS_PROCESSO[t].nome}</Link></h3>
            {fases.length ? <ul className="painel-numeros">{fases.map(f => <li key={f.chave}>
              <Link to={enderecoDaFase(t, f.chave, meus)}><b>{f.n}</b> {f.nome}</Link>
            </li>)}</ul> : <Nota>Nenhum processo.</Nota>}
          </section>;
        })}
      </div>}
    </Cartao>
  </div>;
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
