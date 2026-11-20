// Os andamentos no cartão do processo, dos mais novos aos mais antigos, numa linha do tempo (desde a #362, na coluna da direita).
// Cada andamento tem o tipo da lista pronta (despacho, decisão, sentença, intimação, petição, audiência; os de antes, o tipo de
// sempre), escolhido ao lançar. "Mudar" e "Excluir" ficam no menu "⋯" à direita da caixa, que aparece ao passar o mouse e no foco
// do teclado; quem só lê o processo não o vê. A intimação fica "a tratar" até virar tarefa ou até alguém marcar que ela não precisa
// de tarefa; dela também nasce um prazo, já com a data da intimação.
import { useId, useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router';
import { SD, type AndamentoDeProcesso, type DadosPrazo, type Orgao, type PrazoDeProcesso, type Processo } from '../../dados';
import { ANDAMENTOS_DO_PROCESSO, TAMANHO_ANDAMENTO } from '../../dados/limites';
import {
  andamentoNovo, aTratar, avisoDoLancamento, dadosDoAndamento, errosDoAndamento, ESCOLHAS_DO_TIPO, escolhaDoTipo, escolhasDoFormulario, formDoAndamento, mudancaDoAndamento,
  nomeDoAndamento, prazoNovo, quandoDoAndamento, tarefaDaIntimacao, TIPOS_DE_ANDAMENTO, tipoDaEscolha, type EscolhaDoTipo, type FormDoAndamento
} from '../../regras/andamentos';
import { falha, feito } from '../../ui/avisos';
import { Campo, CampoData, CampoDataHora, estiloBotao, Nota, propsDoCampo, Selo } from '../../ui/base';
import { Botao } from '../../ui/Botoes';
import { Icone } from '../../ui/Icone';
import { MenuFlutuante } from '../../ui/Menu';
import { usePedidoDeNovo } from '../../ui/Recolhivel';
import { useCtx } from '../../ui/sessao';
import { dataHora, hojeISO } from '../../ui/util';
import { FormDoPrazo } from './FormDoPrazo';
import { arquivarTarefaCriada, criarTarefaLigada, quemRecebe } from './tarefaDoProcesso';

/** O que o formulário grava: para desfazer uma mudança sem mexer no que veio depois (tarefa). tratada_em volta só se a mudança a limpou. */
const comoEstava = ({ tipo, categoria, data, hora, local, texto, tratada_em }: AndamentoDeProcesso, mudouOTipo: boolean) =>
  ({ tipo, categoria, data, hora, local, texto, ...(mudouOTipo ? { tratada_em } : {}) });

/** O botão do alto da seção e o "+" do título dela (#390), com o mesmo nome. */
export const ROTULO_DO_NOVO_ANDAMENTO = 'Novo andamento';
/** O que a lista "Tipo" mostra enquanto o andamento novo ainda não tem tipo (escolher é obrigatório). */
const SEM_TIPO = 'Escolha o tipo';

/** O que está aberto no cartão: o formulário de novo andamento, a mudança de um andamento ou o prazo que nasce de uma intimação. */
type Aberto = { o: 'novo' } | { o: 'mudar'; id: string } | { o: 'prazo'; id: string } | null;
/** O nome do andamento para o leitor de tela e para o menu "⋯": "Despacho de 10/11/2026". */
const nomeCompleto = (a: AndamentoDeProcesso) => `${nomeDoAndamento(a)} de ${quandoDoAndamento(a)}`;

function FormDoAndamentoNaTela({ inicial, mudando, aoSalvar, aoCancelar }: { inicial: FormDoAndamento; mudando?: boolean; aoSalvar: (f: FormDoAndamento) => Promise<void>; aoCancelar: () => void }) {
  const id = useId();
  const [f, setF] = useState(inicial);
  const [conferido, setConferido] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const mudar = (m: Partial<FormDoAndamento>) => setF(x => ({ ...x, ...m }));
  const erros = conferido ? errosDoAndamento(f) : {};
  const tipo = TIPOS_DE_ANDAMENTO[f.tipo];
  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    setConferido(true);
    if (ocupado || Object.keys(errosDoAndamento(f)).length) return;
    setOcupado(true);
    try { await aoSalvar(f); } catch (e) { falha(e); setOcupado(false); }
  }
  return <form className="acomp-form" noValidate aria-label={mudando ? 'Mudar andamento' : 'Novo andamento'} onSubmit={salvar}>
    <div className="acomp-form-linha">
      <Campo rotulo="Tipo" para={id + 'tipo'} obrigatorio erro={erros.tipo}>
        <select {...propsDoCampo(id + 'tipo', { erro: erros.tipo })} value={escolhaDoTipo(f) ?? ''} onChange={e => mudar(tipoDaEscolha(e.target.value as EscolhaDoTipo))}>
          {!escolhaDoTipo(f) && <option value="" disabled>{SEM_TIPO}</option>}
          {escolhasDoFormulario(inicial).map(t => <option key={t} value={t}>{ESCOLHAS_DO_TIPO[t].nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo={tipo.rotuloData} para={id + 'data'} obrigatorio erro={erros.data}>
        {/* A audiência e a perícia têm hora: a data e a hora num campo só (#299). Os outros tipos não guardam hora. */}
        {tipo.marcado
          ? <CampoDataHora formato="iso" {...propsDoCampo(id + 'data', { erro: erros.data })} valor={f.data} aoMudar={v => mudar({ data: v })}
            hora={f.hora} aoMudarHora={hora => mudar({ hora })} />
          : <CampoData formato="iso" {...propsDoCampo(id + 'data', { erro: erros.data })} valor={f.data} aoMudar={v => mudar({ data: v })} />}
      </Campo>
    </div>
    {tipo.marcado && <div className="acomp-form-linha">
      <Campo rotulo="Local" para={id + 'local'} erro={erros.local}>
        <input type="text" {...propsDoCampo(id + 'local', { erro: erros.local })} maxLength={TAMANHO_ANDAMENTO.local} value={f.local} onChange={e => mudar({ local: e.target.value })} />
      </Campo>
    </div>}
    <Campo rotulo="O que aconteceu" para={id + 'texto'} obrigatorio erro={erros.texto}>
      <textarea {...propsDoCampo(id + 'texto', { erro: erros.texto })} maxLength={TAMANHO_ANDAMENTO.texto} value={f.texto} onChange={e => mudar({ texto: e.target.value })} />
    </Campo>
    <div className="acomp-acoes">
      <button type="submit" className={estiloBotao({ variante: 'principal' })} disabled={ocupado}>{ocupado ? 'Salvando…' : mudando ? 'Salvar andamento' : 'Lançar andamento'}</button>
      <button type="button" className={estiloBotao()} onClick={aoCancelar}>Cancelar</button>
    </div>
  </form>;
}

interface Props {
  processo: Processo;
  andamentos: AndamentoDeProcesso[];
  prazos: PrazoDeProcesso[];
  orgao: Orgao | null;
  somenteLer: boolean;
  /** Relê a lista e o histórico. */
  aoMudar: () => Promise<void>;
}

export function Andamentos({ processo: p, andamentos, prazos, orgao, somenteLer, aoMudar }: Props) {
  const ctx = useCtx();
  const hoje = hojeISO();
  const [aberto, setAberto] = useState<Aberto>(null);
  /** O menu "⋯" aberto: o botão que o abriu e o andamento dele. */
  const [menu, setMenu] = useState<{ botao: HTMLElement; andamento: AndamentoDeProcesso } | null>(null);
  // O "+" do título da seção abre o mesmo formulário do botão de cima.
  usePedidoDeNovo(() => { if (!somenteLer) setAberto({ o: 'novo' }); });
  const nomeDe = (id: string | null) => ctx.equipe.find(m => m.id === id)?.nome || 'Usuário removido';

  async function lancar(f: FormDoAndamento) {
    const novo = await SD.processoAndamentoCriar(p.id, dadosDoAndamento(f));
    feito(avisoDoLancamento(f), 'lançamento do andamento', async () => { await SD.processoAndamentoExcluir(novo.id); });
    setAberto(null); await aoMudar();
  }
  async function mudar(a: AndamentoDeProcesso, f: FormDoAndamento) {
    await SD.processoAndamentoAtualizar(a.id, mudancaDoAndamento(f));
    feito('Andamento atualizado.', 'mudança do andamento', async () => { await SD.processoAndamentoAtualizar(a.id, comoEstava(a, f.tipo !== a.tipo)); });
    setAberto(null); await aoMudar();
  }
  async function excluir(a: AndamentoDeProcesso) {
    try {
      await SD.processoAndamentoExcluir(a.id);
      feito('Andamento excluído.', 'exclusão do andamento', async () => { await SD.processoAndamentoRestaurar(a.id); });
      await aoMudar();
    } catch (e) { falha(e); }
  }
  async function marcarTratada(a: AndamentoDeProcesso, tratada: boolean) {
    try {
      await SD.processoAndamentoAtualizar(a.id, { tratada_em: tratada ? new Date().toISOString() : null });
      feito(tratada ? 'Intimação marcada como tratada.' : 'Intimação voltou a ficar a tratar.', 'intimação tratada', async () => {
        await SD.processoAndamentoAtualizar(a.id, { tratada_em: a.tratada_em });
      });
      await aoMudar();
    } catch (e) { falha(e); }
  }
  async function criarTarefa(a: AndamentoDeProcesso) {
    try {
      const r = await criarTarefaLigada(tarefaDaIntimacao(p, a, quemRecebe(ctx.perfil.id, ctx.equipe)),
        id => SD.processoAndamentoAtualizar(a.id, { tarefa_id: id, tratada_em: new Date().toISOString() }));
      feito(`Tarefa ${r.codigo} criada.`, 'criação da tarefa', async () => {
        await SD.processoAndamentoAtualizar(a.id, { tarefa_id: null, tratada_em: a.tratada_em });
        await arquivarTarefaCriada(r.id);
      });
    } catch (e) { falha(e); }
    await aoMudar();
  }
  async function lancarPrazo(dados: DadosPrazo) {
    const novo = await SD.processoPrazoCriar(p.id, dados);
    feito('Prazo lançado.', 'lançamento do prazo', async () => { await SD.processoPrazoExcluir(novo.id); });
    setAberto(null); await aoMudar();
  }

  const abrirMenu = (e: MouseEvent<HTMLButtonElement>, a: AndamentoDeProcesso) => setMenu({ botao: e.currentTarget, andamento: a });
  const doMenu = (acao: (a: AndamentoDeProcesso) => unknown) => () => { const a = menu!.andamento; setMenu(null); void acao(a); };

  return <div className="acomp">
    {!andamentos.length && aberto?.o !== 'novo' && <Nota>Nenhum andamento lançado.</Nota>}
    {aberto?.o === 'novo'
      ? <FormDoAndamentoNaTela inicial={andamentoNovo(hoje)} aoSalvar={lancar} aoCancelar={() => setAberto(null)} />
      : !somenteLer && <div><button type="button" className={estiloBotao()} onClick={() => setAberto({ o: 'novo' })}><Icone nome="mais" tam={15} /> {ROTULO_DO_NOVO_ANDAMENTO}</button></div>}
    <ul className="acomp-lista linha-do-tempo" aria-label="Andamentos do processo">
      {andamentos.map(a => {
        if (aberto?.o === 'mudar' && aberto.id === a.id) return <li key={a.id}><FormDoAndamentoNaTela mudando inicial={formDoAndamento(a)} aoSalvar={f => mudar(a, f)} aoCancelar={() => setAberto(null)} /></li>;
        const nascidos = prazos.filter(z => z.andamento_id === a.id);
        return <li key={a.id} aria-label={nomeCompleto(a)}>
          <div className="acomp-topo">
            <div className="acomp-topo-info">
              <Selo tipo="arq">{nomeDoAndamento(a)}</Selo>
              <b>{quandoDoAndamento(a)}</b>
              {aTratar(a) && <Selo tipo="pend">A tratar</Selo>}
            </div>
            {!somenteLer && <button type="button" className="icone-btn andamento-mais" aria-label={`Ações do andamento: ${nomeCompleto(a)}`} aria-haspopup="menu"
              aria-expanded={menu?.andamento.id === a.id} onClick={e => abrirMenu(e, a)}><Icone nome="pontos" tam={15} /></button>}
          </div>
          <p className="acomp-texto">{a.texto}</p>
          <p className="nota">Lançado por {nomeDe(a.criado_por)} em {dataHora(a.criado_em)}.{nascidos.length ? ` Prazo: ${nascidos.map(z => z.descricao).join(', ')}.` : ''}</p>
          <div className="acomp-acoes">
            {a.tarefa ? <Link className={estiloBotao({ forma: 'mini' })} to={'/tarefas/?id=' + a.tarefa.id}>Tarefa {a.tarefa.codigo}</Link>
              : a.tarefa_id ? <span className="nota">Tarefa ligada (você não tem acesso a ela)</span> : null}
            {!somenteLer && ctx.escritorio?.modulos?.tarefas && a.tipo === 'intimacao' && !a.tarefa_id && <Botao forma="mini" ocupadoTexto="Criando…" onClick={() => criarTarefa(a)}>Criar tarefa</Botao>}
            {!somenteLer && a.tipo === 'intimacao' && <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => setAberto({ o: 'prazo', id: a.id })}>Lançar prazo</button>}
            {!somenteLer && aTratar(a) && <Botao forma="mini" onClick={() => marcarTratada(a, true)}>Não precisa de tarefa</Botao>}
            {!somenteLer && a.tipo === 'intimacao' && a.tratada_em && !a.tarefa_id && <Botao forma="mini" onClick={() => marcarTratada(a, false)}>Voltar a tratar</Botao>}
          </div>
          {aberto?.o === 'prazo' && aberto.id === a.id && <FormDoPrazo inicial={prazoNovo(hoje, orgao?.contagem_padrao, a)} orgao={orgao} siglaDoProcesso={p.orgao}
            aoSalvar={lancarPrazo} aoCancelar={() => setAberto(null)} />}
        </li>;
      })}
    </ul>
    {andamentos.length >= ANDAMENTOS_DO_PROCESSO && <Nota>Mostrando os {ANDAMENTOS_DO_PROCESSO} andamentos mais novos.</Nota>}
    {/* Excluir não pede confirmação: o aviso no pé da tela tem o Desfazer, que devolve o andamento como estava. */}
    {menu && <MenuFlutuante botao={menu.botao} aoFechar={() => setMenu(null)} rotulo={`Ações do andamento: ${nomeCompleto(menu.andamento)}`}>
      <button type="button" role="menuitem" onClick={doMenu(a => setAberto({ o: 'mudar', id: a.id }))}><Icone nome="editar" tam={15} /> Mudar</button>
      <button type="button" role="menuitem" className="perigo" onClick={doMenu(excluir)}><Icone nome="lixeira" tam={15} /> Excluir</button>
    </MenuFlutuante>}
  </div>;
}
