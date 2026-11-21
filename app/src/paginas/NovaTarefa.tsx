// Cadastro de tarefa (novo ou atualizar), o mais curto do sistema (#299), em duas etapas: a tarefa (título, descrição, o prazo com a hora e
// o lembrete num campo só, e as ligações opcionais: demanda, contrato e processo) e as pessoas (responsável, participantes da equipe e pessoas do cadastro).
// Vindo do cartão de uma pessoa (?pessoa=), de uma demanda (?demanda=) ou de um contrato (?contrato=), ele já vem
// escolhido. Ao escolher a demanda, as pessoas e o contrato dela entram na tarefa, se ainda estiverem vazios; ao tirá-la, saem
// de novo, se a pessoa não os mudou (regras/tarefa.ts: oQueADemandaTraz e semADemanda).
// Vindo do "+ Nova tarefa" de um processo (?processo=, #376), ela já vem ligada a ele (o aviso do topo diz de onde nasce), com os clientes
// dele como pessoas (se o endereço não traz outras), e, ao salvar, a tela volta ao cartão do processo (se a pessoa não tirou o processo no
// cadastro). O processo arquivado depois que o cartão abriu não é ligado: o aviso diz isso antes de gravar.
// Vindo do "+ Novo…" de uma anotação (?anotacao=, #376), a tarefa nasce ligada a ela (com a pessoa única da anotação, que vem por
// ?pessoa=) e, ao salvar, a tela volta à anotação (nascerNaAnotacao.tsx).
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type ContratoLista, type DadosTarefa, type DemandaLista, type PessoaLista, type PessoaResumida, type Tarefa } from '../dados';
import { semOsCamposDoLugar } from '../regras/edicaoNoLugar';
import { camposForaDoLapis, DATAS_NO_LUGAR, etapasDoLapis, semOsCampos } from '../regras/datasNoCartao';
import { CLIENTES_MAXIMOS, CONTRATOS_PARA_LIGAR, DEMANDAS_PARA_LIGAR, TAMANHO_TAREFA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import { enderecoDoItem } from '../regras/anotacao';
import { depoisDeCriar, tarefaDoProcesso } from '../regras/origemDoCadastro';
import { CampoDoInicio, CampoDoPrazo } from './CamposDoLembrete';
import { anotacaoNoEndereco, AvisoDaAnotacaoDeOrigem, depoisDeCriarNaAnotacao, useAnotacaoDeOrigem } from './nascerNaAnotacao';
import {
  camposDaTarefa, continuaPelaDemanda, dadosDaTarefa, ETAPAS_TAREFA, errosDaEtapaTarefa, naOrdemDoLapisTarefa, oQueADemandaTraz, primeiraEtapaComErroTarefa, semADemanda,
  semSairDaTarefa, TAREFA_VAZIA, validarTarefa, type CamposTarefa, type EtapaTarefa, type TrazidoDaDemanda
} from '../regras/tarefa';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { falha, feito } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { equipeVeTudo } from '../regras/equipeVeTudo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { Aviso, CaixaFormatada, Campo, CampoDeVarios, Carregando, estiloBotao, propsDoCampo, SecaoDoFormulario, useFocoNoGrupo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { GruposNoLapis } from '../ui/GruposDoItem';
import { EscolhaDeProcessos, nomeDoEscolhido, type ProcessoEscolhido } from '../ui/EscolhaDeProcessos';
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
  const pessoaInicial = params.get('pessoa'), demandaInicial = params.get('demanda'), contratoInicial = params.get('contrato'), processoInicial = params.get('processo');
  // A anotação de onde a tarefa nasce (o "+ Novo…" da seção "Ligada a"): ela fica ligada à tarefa nova.
  const daAnotacao = useAnotacaoDeOrigem(anotacaoNoEndereco(params, !!idAtualizar), 'tarefa');

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
  const { grupo: grupoDasPessoas, focarNoGrupo: focarNasPessoas } = useFocoNoGrupo();
  const [focarPessoa, setFocarPessoa] = useState<number | null>(null);
  // As demandas e os contratos que se pode ligar (os ativos mais recentes) e o texto digitado em cada busca.
  const [demandas, setDemandas] = useState<DemandaLista[]>([]);
  const [contratos, setContratos] = useState<ContratoLista[]>([]);
  const [buscaDemanda, setBuscaDemanda] = useState('');
  const [buscaContrato, setBuscaContrato] = useState('');
  // O processo escolhido, para mostrar o nome (o campo guarda só o id).
  const comProcessos = !!ctx.escritorio?.modulos?.processos;
  const [processo, setProcesso] = useState<ProcessoEscolhido | null>(null);
  // O processo de onde a tarefa nasceu (?processo=): o aviso no topo, o cartão para onde a tela volta ao salvar e, se ele foi
  // arquivado depois que o cartão abriu (ou o endereço ficou velho), a recusa: aí a tarefa nasce sem ele.
  const [doProcesso, setDoProcesso] = useState<{ codigo: string; nome: string; cartao: string; arquivado: boolean } | null>(null);
  // O nome da demanda e do contrato que vieram pelo cartão, para quando eles não estão nas listas de busca (ex.: quem não é
  // parte do contrato da demanda vê a ligação pelo código, e não só "Contrato ligado").
  const [conhecidos, setConhecidos] = useState<Record<string, string>>({});
  useTitulo(edicao ? null : alvo ? 'Atualizar tarefa' : 'Nova tarefa');

  // As pessoas de uma vez (ao abrir uma tarefa salva, ou ao escolher uma demanda com clientes).
  function porPessoas(lista: PessoaResumida[]) {
    setPessoas(lista.length ? lista : [null]);
    setChaves(lista.length ? lista.map((_, i) => i) : [0]);
    proximaChave.current = lista.length + 1;
  }
  // Os campos de agora, para a resposta da demanda, que chega depois de a pessoa talvez ter mudado alguma coisa.
  const camposAgora = useRef(c);
  camposAgora.current = c;
  // O que a demanda ligada trouxe (as pessoas e o contrato), para tirar junto com ela.
  const trazido = useRef<TrazidoDaDemanda | null>(null);
  // Ao ligar uma demanda: as pessoas e o contrato dela entram na tarefa, se a tarefa ainda não tem (decidido com os campos de agora).
  async function ligarDemanda(id: string) {
    mudar({ demandaId: id });
    camposAgora.current = { ...camposAgora.current, demandaId: id };
    const d = await SD.demandaObter(id).catch(() => null);
    if (!d) return;
    setConhecidos(x => ({ ...x, [d.id]: [d.codigo, d.titulo].filter(Boolean).join(' · '), ...(d.contrato_id && d.contrato_codigo ? { [d.contrato_id]: d.contrato_codigo } : {}) }));
    const r = oQueADemandaTraz(camposAgora.current, { id: d.id, clientes: d.clientes.map(p => p.id), contratoId: d.contrato_id });
    if (!r) return;
    trazido.current = r.trazido;
    if (r.mudancas.pessoas) porPessoas(d.clientes);
    mudar(r.mudancas);
  }
  // Ao tirar a demanda: sai também o que ela trouxe e a pessoa não mudou.
  function tirarDemanda() {
    const { mudancas, ficam } = semADemanda(c, trazido.current);
    trazido.current = null;
    if (ficam.includes(false)) {
      const restam = pessoas.filter((_, i) => ficam[i]);
      if (restam.length) { setPessoas(restam); setChaves(chaves.filter((_, i) => ficam[i])); } else porPessoas([]);
    }
    mudar(mudancas);
  }

  useEffect(() => {
    SD.demandasListar({ situacao: 'ativas', ordem: 'novos', porPagina: DEMANDAS_PARA_LIGAR, paraLigar: true }).then(r => setDemandas(r.linhas)).catch(() => {});
    SD.contratosListar({ situacao: 'ativos', ordem: 'novos', porPagina: CONTRATOS_PARA_LIGAR, paraLigar: true }).then(r => setContratos(r.linhas)).catch(() => {});
    if (idAtualizar) {
      SD.tarefaObter(idAtualizar)
        .then(t => {
          if (!t) throw new Error('Tarefa não encontrada.');
          setAlvo(t);
          setC(camposDaTarefa(t));
          setProcesso(t.processo);
          porPessoas(t.pessoas);
        })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    if (pessoaInicial) SD.pessoaObter(pessoaInicial).then(p => { if (p) { setPessoas([p]); setC(x => ({ ...x, pessoas: [p.id] })); } }).catch(falha);
    if (demandaInicial) void ligarDemanda(demandaInicial);
    if (contratoInicial) SD.contratoVer(contratoInicial).then(k => {
      if (!k) return;
      setConhecidos(x => ({ ...x, [k.id]: k.codigo }));
      porPessoas(k.clientes);
      setC(x => ({ ...x, contratoId: k.id, pessoas: k.clientes.length ? k.clientes.map(p => p.id) : [''] }));
    }).catch(falha);
    if (processoInicial && comProcessos) SD.processoObter(processoInicial).then(p => {
      if (!p) return;
      const arquivado = !!p.arquivado_em;
      setDoProcesso({ codigo: p.codigo, nome: nomeDoEscolhido(p), cartao: enderecoDoItem({ modulo: 'processos', id: p.id, tipo: p.tipo }), arquivado });
      // As pessoas só entram se o endereço não as traz por outro parâmetro (como ?pessoa=): as de lá ficam. Do processo arquivado,
      // como no cadastro de processo, vêm as pessoas, mas não a ligação.
      const { processoId, pessoas: daOrigem } = tarefaDoProcesso(p, !!(pessoaInicial || demandaInicial || contratoInicial));
      if (daOrigem) porPessoas(p.clientes);
      if (!arquivado) setProcesso(p);
      setC(x => ({ ...x, ...(daOrigem ? { pessoas: daOrigem } : {}), ...(arquivado ? {} : { processoId }) }));
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
    focarNasPessoas();
  }
  // Na busca de cada linha, quem já está em outra linha aparece desligado.
  const outraPessoa = (i: number) => (p: PessoaLista) => c.pessoas.some((x, j) => j !== i && x === p.id) ? 'já está na tarefa' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);

  // ---------- demanda e contrato ----------
  const demandaEscolhida = demandas.find(d => d.id === c.demandaId);
  const rotuloDemanda = demandaEscolhida ? rotuloDaDemanda(demandaEscolhida) : conhecidos[c.demandaId] ?? (alvo?.demanda_id === c.demandaId ? alvo?.demanda_codigo ?? '' : '');
  function digitarDemanda(texto: string) {
    const d = demandas.find(x => rotuloDaDemanda(x) === texto);
    if (d) { void ligarDemanda(d.id); setBuscaDemanda(''); } else setBuscaDemanda(texto);
  }
  const contratoEscolhido = contratos.find(k => k.id === c.contratoId);
  const rotuloContrato = contratoEscolhido ? rotuloDoContrato(contratoEscolhido) : conhecidos[c.contratoId] ?? (alvo?.contrato_id === c.contratoId ? alvo?.contrato_codigo ?? '' : '');
  function digitarContrato(texto: string) {
    const k = contratos.find(x => rotuloDoContrato(x) === texto);
    if (k) { mudar({ contratoId: k.id }); setBuscaContrato(''); } else setBuscaContrato(texto);
  }

  // ---------- envio ----------
  /** No lápis do cartão, o título e a descrição (#346) e as datas (#361) ficam de fora: o cartão já os muda no próprio lugar. */
  const noLapis = (d: DadosTarefa): DadosTarefa => edicao ? semOsCampos(semOsCamposDoLugar(d), DATAS_NO_LUGAR.tarefas.dados) : d;
  async function salvar() {
    if (ocupado) return;   // o Enter não respeita o botão desligado
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErroTarefa(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_TAREFA.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados: DadosTarefa = noLapis(dadosDaTarefa(c));
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: a tarefa como estava, no mesmo formato que o cadastro grava.
        const antes = noLapis(dadosDaTarefa(camposDaTarefa(alvo)));
        const eu = ctx.perfil.id, peloLigado = continuaPelaDemanda(alvo, dados.demanda_id), podeSair = gravaForaDoCartao(ctx, alvo.criado_por === eu, peloLigado);
        const { dados: gravar, ficou } = semSairDaTarefa(dados, eu, podeSair, { responsavel_id: alvo.responsavel_id, lista: alvo.participantes }, peloLigado);
        await SD.tarefaAtualizar(alvo.id, gravar);
        if (ficou) {
          // A pessoa se tirou do cartão: o resto já foi gravado com ela nele, e a saída vem por último, para valer mesmo que ela perca o acesso.
          await sairDoCartao('tarefas', alvo.id, 'Tarefa atualizada. Você saiu dela, e a saída ficou no histórico.');
          saidaLiberada.current = true;
          if (edicao && equipeVeTudo(ctx.escritorio)) edicao.aoTerminar(true); else navegar('/tarefas/');
          return;
        }
        feito('Tarefa atualizada.', 'atualização da tarefa', async () => {
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
        // Vinda do processo, volta ao cartão dele, onde a tarefa nova já aparece (a tarefa nasce com o processo gravado). Vinda de
        // uma anotação, liga a tarefa a ela e volta à anotação, no lugar do cadastro (o Voltar do navegador não reabre o formulário).
        const doCriado = depoisDeCriar(doProcesso?.cartao ?? null, !!processoInicial && dados.processo_id === processoInicial, '/tarefas/?id=' + r.id);
        navegar(await depoisDeCriarNaAnotacao(daAnotacao, 'tarefa', r.id, doCriado), { replace: !!daAnotacao });
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  const CONTEUDO: Record<EtapaTarefa, () => ReactNode> = {
    tarefa: () => <>
      {/* No lápis do cartão, o título e a descrição não se repetem: o cartão os muda no próprio lugar (#346). */}
      {!edicao && <>
        <Campo rotulo="Título" para="titulo" obrigatorio erro={erros.titulo} dica="O que precisa ser feito. Ex.: Emitir a GRU.">
          <input type="text" {...propsDoCampo('titulo', { dica: true, erro: erros.titulo })} maxLength={TAMANHO_TAREFA.titulo} value={c.titulo}
            onChange={e => mudar({ titulo: e.target.value })} />
        </Campo>
        <Campo rotulo="Descrição" para="descricao" erro={erros.descricao}>
          <CaixaFormatada {...propsDoCampo('descricao', { erro: erros.descricao })} maxLength={TAMANHO_TAREFA.descricao} valor={c.descricao}
            aoMudar={descricao => mudar({ descricao })} />
        </Campo>
      </>}
      {/* No lápis do cartão, as datas também não se repetem: o cartão as muda no próprio lugar (#361). */}
      {!edicao && <>
        <CampoDoPrazo rotulo="Prazo" prazo={c.prazo} hora={c.hora} lembrete={c.lembrete} erros={erros} aoMudar={mudar} />
        {/* A data de início só ao mudar uma tarefa que já existe: a nova começa no dia em que é criada (#357). */}
        {c.inicio !== null && <CampoDoInicio valor={c.inicio} erro={erros.inicio} aoMudar={inicio => mudar({ inicio })} />}
      </>}
      {/* As ligações, opcionais, na mesma etapa (#299): ligar a demanda traz as pessoas dela para a etapa seguinte. */}
      {ligacoes()}
    </>,
    pessoas: () => <>
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem faz a tarefa: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, participantes: c.participantes.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <EscolhaDaEquipe rotulo="Participantes" erro={erros.participantes} dica="Quem da equipe também trabalha na tarefa (e passa a vê-la)." adicionar="Adicionar participante"
        equipe={ctx.equipe} escolhidos={c.participantes} fora={c.responsavelId ? [c.responsavelId] : []} aoMudar={participantes => mudar({ participantes })} />
      <GruposNoLapis ids={alvo?.grupos} />
      <CampoDeVarios rotulo="Pessoas ligadas" erro={erros.pessoas} grupo={grupoDasPessoas}>
        {c.pessoas.map((_, i) => <div className="linha-cliente" key={chaves[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={<span className="sr">{c.pessoas.length === 1 ? 'Pessoa ligada' : `Pessoa ligada ${i + 1}`}</span>} escolhida={pessoas[i]}
              aoEscolher={escolherPessoa(i)} desativar={outraPessoa(i)} focar={chaves[i] === focarPessoa} />
          </div>
          {c.pessoas.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar a pessoa ${i + 1}`} onClick={() => tirarPessoa(i)}>
            <Icone nome="fechar" tam={15} />
          </button>}
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.pessoas.length >= CLIENTES_MAXIMOS} onClick={acrescentarPessoa}>
          <Icone nome="mais" tam={13} /> Adicionar pessoa
        </button></div>
      </CampoDeVarios>
    </>
  };
  /** A demanda, o contrato e o processo da tarefa: opcionais, no fim da primeira etapa. */
  function ligacoes() {
    return <>
      {c.demandaId
        ? <Escolhido rotulo="Demanda" texto={rotuloDemanda || 'Demanda ligada'} tirar="Tirar a demanda" aoTirar={tirarDemanda} />
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
      {/* O processo que a pessoa não pode abrir fica como está: só contado, sem o "X". */}
      {comProcessos && <EscolhaDeProcessos rotulo="Processo" dica="O processo de que a tarefa cuida. Busque pelo número, pelo nome ou pelo cliente." maximo={1}
        escolhidos={processo ? [processo] : []} ocultos={c.processoId && !processo ? 1 : 0}
        aoMudar={lista => { setProcesso(lista[0] ?? null); mudar({ processoId: lista[0]?.id ?? '' }); }} />}
    </>;
  }

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé, menos a que só tem o que o cartão muda no lugar.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar tarefa" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {naOrdemDoLapisTarefa(etapasDoLapis(ETAPAS_TAREFA, camposForaDoLapis(DATAS_NO_LUGAR.tarefas))).map(e => <SecaoDoFormulario key={e.id} titulo={e.tituloNoLapis ?? e.titulo} nivel={3}>
        {CONTEUDO[e.id]()}
      </SecaoDoFormulario>)}
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
    {/* De onde a tarefa nasce (?processo=), como no cadastro de processo; some se a pessoa tira o processo no campo dele. */}
    {doProcesso?.arquivado && <Aviso tipo="erro">O processo <b>{doProcesso.codigo}</b> ({doProcesso.nome}) está arquivado: esta tarefa não fica ligada a ele.</Aviso>}
    {doProcesso && !doProcesso.arquivado && c.processoId === processoInicial
      && <Aviso tipo="info">Esta tarefa nasce do processo <b>{doProcesso.codigo}</b> ({doProcesso.nome}) e fica ligada a ele.</Aviso>}
    <AvisoDaAnotacaoDeOrigem origem={daAnotacao} />
    {!pronto ? <Carregando /> : <>
      <div className="passos-topo">
        <span>Passo {passo + 1} de {total}</span>
        <div className="progresso"><i style={{ width: Math.round(100 * passo / (total - 1)) + '%' }} /></div>
      </div>

      <form className="form-grade" noValidate autoComplete="off" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
        <SecaoDoFormulario key={etapa.id} titulo={etapa.titulo} texto={etapa.texto}>
          {CONTEUDO[etapa.id]()}
        </SecaoDoFormulario>

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
