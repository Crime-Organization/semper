// Cadastro de tarefa (novo ou atualizar), por etapas como o de demanda: a tarefa (título, descrição e prazo), as pessoas
// (responsável, participantes da equipe e pessoas do cadastro) e as ligações (demanda e contrato), que são opcionais.
// Vindo do cartão de uma pessoa (?pessoa=), de uma demanda (?demanda=) ou de um contrato (?contrato=), ele já vem
// escolhido. Ao escolher a demanda, as pessoas e o contrato dela entram na tarefa, se ainda estiverem vazios.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type ContratoLista, type DemandaLista, type PessoaLista, type PessoaResumida, type Tarefa } from '../dados';
import { CLIENTES_MAXIMOS, CONTRATOS_PARA_LIGAR, DEMANDAS_PARA_LIGAR, TAMANHO_TAREFA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { MASCARAS } from '../regras/pessoa';
import {
  camposDaTarefa, continuaPelaDemanda, dadosDaTarefa, ETAPAS_TAREFA, errosDaEtapaTarefa, primeiraEtapaComErroTarefa, semSairDaTarefa, TAREFA_VAZIA, validarTarefa,
  type CamposTarefa, type EtapaTarefa
} from '../regras/tarefa';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { falha, feito } from '../ui/avisos';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { Aviso, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { Icone } from '../ui/Icone';
import { ordemNoFim } from '../ui/quadro/posicao';
import { useCtx } from '../ui/sessao';
import { subirAoCadastro, useTitulo } from '../ui/util';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import './Contratos.css';
import './Demandas.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** Os campos da etapa que está na tela (o Enter passa de um para o outro). */
const CAMPOS_DA_ETAPA = '.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select';
/** Como o contrato aparece na busca e no campo: número, clientes e objetos. */
const rotuloDoContrato = (k: Pick<ContratoLista, 'codigo' | 'cliente_nome' | 'servico'>) => `${k.codigo} · ${clientesPorExtenso(k.cliente_nome)} · ${k.servico}`;
/** Como a demanda aparece na busca e no campo: código, título e clientes. */
const rotuloDaDemanda = (d: Pick<DemandaLista, 'codigo' | 'titulo' | 'cliente_nome'>) =>
  [d.codigo, d.titulo, d.cliente_nome && clientesPorExtenso(d.cliente_nome)].filter(Boolean).join(' · ');

export default function NovaTarefa({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa');
  const pessoaInicial = params.get('pessoa'), demandaInicial = params.get('demanda'), contratoInicial = params.get('contrato');

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposTarefa>(() => ({ ...TAREFA_VAZIA, responsavelId: ctx.perfil.id }));
  const [alvo, setAlvo] = useState<Tarefa | null>(null);   // tarefa sendo atualizada
  const [pronto, setPronto] = useState(!idAtualizar);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaTarefa>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // A pessoa escolhida em cada linha (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [pessoas, setPessoas] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const [focarPessoa, setFocarPessoa] = useState<number | null>(null);
  // As demandas e os contratos que se pode ligar (os ativos mais recentes) e o texto digitado em cada busca.
  const [demandas, setDemandas] = useState<DemandaLista[]>([]);
  const [contratos, setContratos] = useState<ContratoLista[]>([]);
  const [buscaDemanda, setBuscaDemanda] = useState('');
  const [buscaContrato, setBuscaContrato] = useState('');
  useTitulo(edicao ? null : alvo ? 'Atualizar tarefa' : 'Nova tarefa');

  // As pessoas de uma vez (ao abrir uma tarefa salva, ou ao escolher uma demanda com clientes).
  function porPessoas(lista: PessoaResumida[]) {
    setPessoas(lista.length ? lista : [null]);
    setChaves(lista.length ? lista.map((_, i) => i) : [0]);
    proximaChave.current = lista.length + 1;
  }
  const semPessoas = (x: CamposTarefa) => !x.pessoas.some(Boolean);
  // Ao ligar uma demanda: as pessoas e o contrato dela entram na tarefa, se a tarefa ainda não tem.
  async function ligarDemanda(id: string) {
    mudar({ demandaId: id });
    const d = await SD.demandaObter(id).catch(() => null);
    if (!d) return;
    if (semPessoas(c) && d.clientes.length) { porPessoas(d.clientes); mudar({ pessoas: d.clientes.map(p => p.id) }); }
    if (!c.contratoId && d.contrato_id) mudar({ contratoId: d.contrato_id });
  }

  useEffect(() => {
    SD.demandasListar({ situacao: 'ativas', ordem: 'novos', porPagina: DEMANDAS_PARA_LIGAR }).then(r => setDemandas(r.linhas)).catch(() => {});
    SD.contratosListar({ situacao: 'ativos', ordem: 'novos', porPagina: CONTRATOS_PARA_LIGAR }).then(r => setContratos(r.linhas)).catch(() => {});
    if (idAtualizar) {
      SD.tarefaObter(idAtualizar)
        .then(t => {
          if (!t) throw new Error('Tarefa não encontrada.');
          setAlvo(t);
          setC(camposDaTarefa(t));
          porPessoas(t.pessoas);
        })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    if (pessoaInicial) SD.pessoaObter(pessoaInicial).then(p => { if (p) { setPessoas([p]); setC(x => ({ ...x, pessoas: [p.id] })); } }).catch(falha);
    if (demandaInicial) void ligarDemanda(demandaInicial);
    if (contratoInicial) SD.contratoObter(contratoInicial).then(k => {
      if (!k) return;
      porPessoas(k.clientes);
      setC(x => ({ ...x, contratoId: k.id, pessoas: k.clientes.length ? k.clientes.map(p => p.id) : [''] }));
    }).catch(falha);
  // oxlint-disable-next-line react/exhaustive-deps -- carrega uma vez só, ao abrir o formulário
  }, []);
  // A cada etapa, o foco vai para o primeiro campo dela.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>(CAMPOS_DA_ETAPA)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  const etapa = ETAPAS_TAREFA[passo];
  const ultimo = passo === ETAPAS_TAREFA.length - 1;
  const todos = validarTarefa(c);
  const conferidos = new Set(ETAPAS_TAREFA.filter(e => conferidas.has(e.id)).flatMap(e => e.campos));
  const erros: Partial<Record<keyof CamposTarefa, string>> = Object.fromEntries(Object.entries(todos).filter(([campo]) => conferidos.has(campo as keyof CamposTarefa)));
  function mudar(campos: Partial<CamposTarefa>) { setC(atual => ({ ...atual, ...campos })); }

  // ---------- etapas ----------
  function irPara(i: number) {
    setPasso(i);
    subirAoCadastro();
  }
  const focarErro = () => requestAnimationFrame(() =>
    document.querySelector('.etapa.ativa .pergunta.erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  function avancar() {
    if (edicao) { void salvar(); return; }
    setConferidas(x => new Set(x).add(etapa.id));
    if (Object.keys(errosDaEtapaTarefa(etapa.id, c)).length) { focarErro(); return; }
    if (ultimo) void salvar(); else irPara(passo + 1);
  }
  // Enter: vai para o próximo campo da etapa ou para a próxima etapa. As buscas tratam o Enter delas.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...document.querySelectorAll<HTMLElement>(CAMPOS_DA_ETAPA)].filter(x => x.offsetParent !== null && !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else avancar();
  }

  // ---------- pessoas do cadastro ----------
  const escolherPessoa = (i: number) => (p: PessoaLista | null) => {
    setPessoas(atual => atual.map((x, j) => j === i ? p : x));
    setC(atual => ({ ...atual, pessoas: atual.pessoas.map((x, j) => j === i ? p?.id ?? '' : x) }));
  };
  function acrescentarPessoa() {
    const chave = proximaChave.current++;
    setPessoas(atual => [...atual, null]);
    setChaves(atual => [...atual, chave]);
    setC(atual => ({ ...atual, pessoas: [...atual.pessoas, ''] }));
    setFocarPessoa(chave);
  }
  function tirarPessoa(i: number) {
    setPessoas(atual => atual.toSpliced(i, 1));
    setChaves(atual => atual.toSpliced(i, 1));
    setC(atual => ({ ...atual, pessoas: atual.pessoas.toSpliced(i, 1) }));
  }
  // Na busca de cada linha, quem já está em outra linha aparece desligado.
  const outraPessoa = (i: number) => (p: PessoaLista) => c.pessoas.some((x, j) => j !== i && x === p.id) ? 'já está na tarefa' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);
  const opcoesPart = ctx.equipe.filter(m => m.id !== c.responsavelId && (m.ativo !== false || c.participantes.includes(m.id)));
  const marcarParticipante = (id: string, marcar: boolean) =>
    mudar({ participantes: marcar ? [...c.participantes, id] : c.participantes.filter(x => x !== id) });

  // ---------- demanda e contrato ----------
  const demandaEscolhida = demandas.find(d => d.id === c.demandaId);
  const rotuloDemanda = demandaEscolhida ? rotuloDaDemanda(demandaEscolhida) : alvo?.demanda_id === c.demandaId ? alvo?.demanda_codigo ?? '' : '';
  function digitarDemanda(texto: string) {
    const d = demandas.find(x => rotuloDaDemanda(x) === texto);
    if (d) { void ligarDemanda(d.id); setBuscaDemanda(''); } else setBuscaDemanda(texto);
  }
  const contratoEscolhido = contratos.find(k => k.id === c.contratoId);
  const rotuloContrato = contratoEscolhido ? rotuloDoContrato(contratoEscolhido) : alvo?.contrato_id === c.contratoId ? alvo?.contrato_codigo ?? '' : '';
  function digitarContrato(texto: string) {
    const k = contratos.find(x => rotuloDoContrato(x) === texto);
    if (k) { mudar({ contratoId: k.id }); setBuscaContrato(''); } else setBuscaContrato(texto);
  }

  // ---------- envio ----------
  async function salvar() {
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErroTarefa(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_TAREFA.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados = dadosDaTarefa(c);
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: a tarefa como estava, no mesmo formato que o cadastro grava.
        const antes = dadosDaTarefa(camposDaTarefa(alvo));
        const eu = ctx.perfil.id, podeSair = ctx.ehAdmin || alvo.criado_por === eu || continuaPelaDemanda(alvo, dados.demanda_id);
        const { dados: gravar, ficou } = semSairDaTarefa(dados, eu, podeSair);
        await SD.tarefaAtualizar(alvo.id, gravar);
        feito(ficou ? 'Tarefa atualizada. Você continua entre os participantes; para sair, peça a outra pessoa da tarefa ou a um administrador.' : 'Tarefa atualizada.', 'atualização da tarefa', async () => {
          await SD.tarefaAtualizar(alvo.id, antes);
          return { tipo: 'tarefaAtualizada', id: alvo.id };
        });
        saidaLiberada.current = true;
        if (edicao) edicao.aoTerminar(true); else navegar('/tarefas/?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, a tarefa nova entra na coluna-marco de início ("Para fazer").
        const coluna = etapaInicial || await colunaInicial('tarefas');
        const r = await SD.tarefaCriar({ ...dados, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        feito(`Tarefa ${r.codigo} cadastrada.`, 'cadastro da tarefa', async () => {
          await SD.tarefasArquivar([r.id], true);
          const x = await SD.tarefasExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'tarefaCriada', id: r.id };
        });
        saidaLiberada.current = true;
        navegar('/tarefas/?id=' + r.id);
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  const CONTEUDO: Record<EtapaTarefa, () => ReactNode> = {
    tarefa: () => <>
      <Campo rotulo="Título" para="titulo" obrigatorio erro={erros.titulo} dica="O que precisa ser feito. Ex.: Emitir a GRU.">
        <input type="text" {...propsDoCampo('titulo', { dica: true, erro: erros.titulo })} maxLength={TAMANHO_TAREFA.titulo} value={c.titulo}
          onChange={e => mudar({ titulo: e.target.value })} />
      </Campo>
      <Campo rotulo="Descrição" para="descricao" erro={erros.descricao}>
        <textarea {...propsDoCampo('descricao', { erro: erros.descricao })} maxLength={TAMANHO_TAREFA.descricao} value={c.descricao}
          onChange={e => mudar({ descricao: e.target.value })} />
      </Campo>
      <Campo rotulo="Prazo" para="prazo" erro={erros.prazo} dica="Opcional. O prazo aparece na agenda.">
        <input type="text" {...propsDoCampo('prazo', { dica: true, erro: erros.prazo })} inputMode="numeric" placeholder="DD/MM/AAAA" value={c.prazo}
          onChange={e => mudar({ prazo: MASCARAS.data(e.target.value) })} />
      </Campo>
    </>,
    pessoas: () => <>
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem faz a tarefa: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, participantes: c.participantes.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <Escolhas rotulo="Participantes" erro={erros.participantes} dica="Quem da equipe também trabalha na tarefa (e passa a vê-la).">
        {opcoesPart.length ? opcoesPart.map(m => <label key={m.id}>
          <input type="checkbox" checked={c.participantes.includes(m.id)} onChange={e => marcarParticipante(m.id, e.target.checked)} />{m.nome}
        </label>) : <Nota>Não há mais ninguém na equipe.</Nota>}
      </Escolhas>
      <div className={'pergunta' + (erros.pessoas ? ' erro' : '')} role="group" aria-label="Pessoas ligadas">
        {c.pessoas.map((_, i) => <div className="linha-cliente" key={chaves[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={c.pessoas.length === 1 ? 'Pessoa ligada' : `Pessoa ligada ${i + 1}`} escolhida={pessoas[i]}
              aoEscolher={escolherPessoa(i)} desativar={outraPessoa(i)} focar={chaves[i] === focarPessoa} />
          </div>
          {c.pessoas.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar a pessoa ${i + 1}`} onClick={() => tirarPessoa(i)}>
            <Icone nome="fechar" tam={15} />
          </button>}
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.pessoas.length >= CLIENTES_MAXIMOS} onClick={acrescentarPessoa}>
          <Icone nome="mais" tam={13} /> Adicionar pessoa
        </button></div>
        {erros.pessoas && <span className="msg-erro" role="alert">{erros.pessoas}</span>}
      </div>
    </>,
    ligacoes: () => <>
      {c.demandaId
        ? <Escolhido rotulo="Demanda" texto={rotuloDemanda || 'Demanda ligada'} tirar="Tirar a demanda" aoTirar={() => mudar({ demandaId: '' })} />
        : <Campo rotulo="Demanda" para="demanda" dica="Busque pelo código, pelo título ou pelo cliente. Deixe vazio se a tarefa é avulsa.">
          <CampoComSugestoes id="demanda" aria-describedby="demanda-dica" placeholder="Buscar demanda…" valor={buscaDemanda} aoMudar={digitarDemanda}
            sugestoes={demandas.map(d => ({ valor: rotuloDaDemanda(d) }))} />
        </Campo>}
      {c.contratoId
        ? <Escolhido rotulo="Contrato" texto={rotuloContrato || 'Contrato ligado'} tirar="Tirar o contrato" aoTirar={() => mudar({ contratoId: '' })} />
        : <Campo rotulo="Contrato" para="contrato" dica="Busque pelo número, pelo cliente ou pelo objeto. Deixe vazio se a tarefa não vem de um contrato.">
          <CampoComSugestoes id="contrato" aria-describedby="contrato-dica" placeholder="Buscar contrato…" valor={buscaContrato} aoMudar={digitarContrato}
            sugestoes={contratos.map(k => ({ valor: rotuloDoContrato(k) }))} />
        </Campo>}
    </>
  };

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar tarefa" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {ETAPAS_TAREFA.map(e => <section className="etapa ativa" key={e.id} aria-labelledby={'etapa-' + e.id}>
        <header><h2 id={'etapa-' + e.id}>{e.titulo}</h2></header>
        {CONTEUDO[e.id]()}
      </section>)}
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = idAtualizar ? '/tarefas/?id=' + idAtualizar : '/tarefas/';
  const total = ETAPAS_TAREFA.length;
  return <div className="passos">
    <AvisoAoSair estado={{ c, pessoas }} liberada={saidaLiberada} ocupado={ocupado} />
    <header>
      <p className="olho"><Link to={voltar}>Tarefas</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar tarefa' : 'Nova tarefa'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando a tarefa <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
    {!pronto ? <Carregando /> : <>
      <div className="passos-topo">
        <span>Etapa {passo + 1} de {total}</span>
        <div className="progresso"><i style={{ width: Math.round(100 * passo / (total - 1)) + '%' }} /></div>
      </div>

      <form className="form-grade" noValidate autoComplete="off" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
        <section className="etapa ativa" key={etapa.id} aria-labelledby="etapa-titulo">
          <header><h2 id="etapa-titulo">{etapa.titulo}</h2><p>{etapa.texto}</p></header>
          {CONTEUDO[etapa.id]()}
        </section>

        <div className="navegar">
          <button type="button" className={estiloBotao()} style={{ visibility: passo === 0 ? 'hidden' : 'visible' }} onClick={() => irPara(passo - 1)}>Voltar</button>
          <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado} onClick={avancar}>
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar tarefa') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}

/** A demanda ou o contrato já escolhido, com o botão de tirar. */
function Escolhido({ rotulo, texto, tirar, aoTirar }: { rotulo: string; texto: string; tirar: string; aoTirar: () => void }) {
  return <div className="pergunta">
    <span className="rot">{rotulo}</span>
    <div className="demanda-contrato-escolhido">
      <span>{texto}</span>
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={aoTirar}>{tirar}</button>
    </div>
  </div>;
}
