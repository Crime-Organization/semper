// Cadastro de demanda (novo ou atualizar), por etapas como os de pessoa e de contrato: a demanda (título, descrição,
// prazo, hora e lembrete), as pessoas (responsável, colaboradores da equipe e clientes) e o contrato, que é opcional.
// Vindo do cartão de uma pessoa (?cliente=) ou de um contrato (?contrato=), ela já vem escolhida. Vinda do cartão de uma tarefa
// (?tarefa=), a demanda herda as pessoas e o contrato da tarefa; vinda de um processo (?processo=), ele já escolhido e os clientes
// dele. Ela nasce ligada à origem e, ao salvar, volta ao cartão de onde a pessoa partiu (#376). A origem arquivada não vale.
// Vinda do "+ Novo…" de uma anotação (?anotacao=), ela nasce ligada à anotação, com a pessoa única dela como cliente (por ?cliente=).
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type ContratoLista, type DadosDemanda, type Demanda, type PessoaLista, type PessoaResumida, type Tarefa } from '../dados';
import { semOsCamposDoLugar } from '../regras/edicaoNoLugar';
import { camposForaDoLapis, DATAS_NO_LUGAR, etapasDoLapis, semOsCampos } from '../regras/datasNoCartao';
import { CLIENTES_MAXIMOS, CONTRATOS_PARA_LIGAR, TAMANHO_DEMANDA } from '../dados/limites';
import { clientesPorExtenso } from '../regras/contrato';
import {
  camposDaDemanda, dadosDaDemanda, DEMANDA_VAZIA, ETAPAS_DEMANDA, errosDaEtapaDemanda, primeiraEtapaComErroDemanda, semSairDaDemanda, validarDemanda,
  type CamposDemanda, type EtapaDemanda
} from '../regras/demanda';
import { CampoDoInicio, CampoDoPrazo } from './CamposDoLembrete';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { avisar, falha, feito } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { equipeVeTudo } from '../regras/equipeVeTudo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { Aviso, CaixaFormatada, Campo, CampoDeVarios, Carregando, estiloBotao, propsDoCampo, SecaoDoFormulario, useFocoNoGrupo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { GruposNoLapis } from '../ui/GruposDoItem';
import { EscolhaDeProcessos, type ProcessoEscolhido } from '../ui/EscolhaDeProcessos';
import { mudancasNosProcessos } from '../regras/processo';
import {
  aoSalvarPelaOrigem, avisoDaLigacaoQueFalhou, clientesDaOrigem, motivoDoContratoDaTarefa, origemDaTarefa, origemDoProcesso, processoDeOrigemLigado, textoDaOrigem,
  type OrigemDoItem
} from '../regras/nascerLigado';
import { depoisDeCriar } from '../regras/origemDoCadastro';
import { ligarTarefaNaDemanda } from './ligarNoCartao';
import { anotacaoNoEndereco, AvisoDaAnotacaoDeOrigem, depoisDeCriarNaAnotacao, useAnotacaoDeOrigem } from './nascerNaAnotacao';
import { gravarProcessos } from './ProcessosDoCartao';
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

export default function NovaDemanda({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa');
  const clienteInicial = params.get('cliente'), contratoInicial = params.get('contrato');
  // A origem do "+ Nova demanda" de um cartão (#376): a tarefa fica ligada à demanda nova; o processo já vem escolhido.
  const tarefaInicial = idAtualizar ? null : params.get('tarefa'), processoInicial = idAtualizar ? null : params.get('processo');
  const [origem, setOrigem] = useState<OrigemDoItem | null>(null);
  // A anotação de onde a demanda nasce (o "+ Novo…" da seção "Ligada a"): ela fica ligada à demanda nova.
  const daAnotacao = useAnotacaoDeOrigem(anotacaoNoEndereco(params, !!idAtualizar), 'demanda');
  // A tarefa de origem, só quando ela vale (ativa): é ela que fica ligada à demanda nova.
  const [tarefa, setTarefa] = useState<Tarefa | null>(null);

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposDemanda>(() => ({ ...DEMANDA_VAZIA, responsavelId: ctx.perfil.id }));
  const [alvo, setAlvo] = useState<Demanda | null>(null);   // demanda sendo atualizada
  // Vinda de um cartão, espera os dados da origem: o que chegar depois não pode trocar o que a pessoa já escolheu.
  const [pronto, setPronto] = useState(!idAtualizar && !tarefaInicial && !processoInicial);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaDemanda>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // A pessoa escolhida em cada linha de cliente (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [clientes, setClientes] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const { grupo: grupoDosClientes, focarNoGrupo: focarNosClientes } = useFocoNoGrupo();
  const [focarCliente, setFocarCliente] = useState<number | null>(null);
  // Os contratos que se pode ligar (os ativos mais recentes) e o texto digitado na busca.
  const [contratos, setContratos] = useState<ContratoLista[]>([]);
  const [buscaContrato, setBuscaContrato] = useState('');
  // O contrato que veio da origem, como o cartão dela o mostra (ele pode não estar entre os contratos para ligar).
  const [contratoDaOrigem, setContratoDaOrigem] = useState<{ id: string; rotulo: string } | null>(null);
  // Os processos ligados (os que a pessoa pode abrir; os outros só contados) e os que já estavam, para gravar só o que mudou.
  const comProcessos = !!ctx.escritorio?.modulos?.processos;
  const [processos, setProcessos] = useState<ProcessoEscolhido[]>([]);
  const [processosOcultos, setProcessosOcultos] = useState(0);
  const processosAntes = useRef<string[]>([]);
  useTitulo(edicao ? null : alvo ? 'Atualizar demanda' : 'Nova demanda');

  /** Os clientes que vêm da origem (o contrato, a tarefa ou o processo), cada um na sua linha; sem nenhum, uma linha vazia. */
  const porClientes = useCallback((pessoas: readonly PessoaResumida[]) => {
    const lista = clientesDaOrigem(pessoas);
    setClientes(lista.length ? lista : [null]);
    setChaves(lista.length ? lista.map((_, i) => i) : [0]);
    proximaChave.current = lista.length + 1;
    setC(x => ({ ...x, clientes: lista.length ? lista.map(p => p.id) : [''] }));
  }, []);
  useEffect(() => {
    SD.contratosListar({ situacao: 'ativos', ordem: 'novos', porPagina: CONTRATOS_PARA_LIGAR, paraLigar: true }).then(r => setContratos(r.linhas)).catch(() => {});
    if (idAtualizar) {
      Promise.all([SD.demandaObter(idAtualizar), comProcessos ? SD.processosDaDemanda(idAtualizar) : { visiveis: [], ocultos: 0 }])
        .then(([d, ligados]) => {
          if (!d) throw new Error('Demanda não encontrada.');
          setProcessos(ligados.visiveis);
          setProcessosOcultos(ligados.ocultos);
          processosAntes.current = ligados.visiveis.map(p => p.id);
          setAlvo(d);
          setC(camposDaDemanda(d));
          setClientes(d.clientes.length ? d.clientes : [null]);
          setChaves(d.clientes.length ? d.clientes.map((_, i) => i) : [0]);
          proximaChave.current = d.clientes.length + 1;
        })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    if (clienteInicial) SD.pessoaObter(clienteInicial).then(p => { if (p) { setClientes([p]); setC(x => ({ ...x, clientes: [p.id] })); } }).catch(falha);
    // Do cartão de um contrato: ele, os clientes e o responsável dele já vêm escolhidos.
    if (contratoInicial) SD.contratoVer(contratoInicial).then(k => {
      if (!k) return;
      porClientes(k.clientes);
      setC(x => ({ ...x, contratoId: k.id, responsavelId: k.responsavel_id }));
    }).catch(falha);
  // oxlint-disable-next-line react/exhaustive-deps -- carrega uma vez só, ao abrir o formulário
  }, []);
  useEffect(() => {
    // Do cartão de uma tarefa: as pessoas dela como clientes e o contrato dela, para a tarefa poder ficar na demanda (#283).
    if (tarefaInicial) SD.tarefaObter(tarefaInicial).then(t => {
      if (!t) return;
      const o = origemDaTarefa(t);
      setOrigem(o);
      if (o.arquivada) return;
      setTarefa(t);
      porClientes(t.pessoas);
      if (t.contrato_id) {
        const contratoId = t.contrato_id;
        setC(x => ({ ...x, contratoId }));
        setContratoDaOrigem({ id: contratoId, rotulo: t.contrato ? `${t.contrato.codigo} · ${t.contrato.servico}` : t.contrato_codigo ?? '' });
      }
    }).catch(falha).finally(() => setPronto(true));
    // Do cartão de um processo: ele já escolhido nos processos da demanda, e os clientes dele.
    if (processoInicial) (comProcessos ? SD.processoObter(processoInicial) : Promise.resolve(null)).then(p => {
      if (!p) return;
      const o = origemDoProcesso(p, 'demanda');
      setOrigem(o);
      if (o.arquivada) return;
      setProcessos([{ id: p.id, codigo: p.codigo, tipo: p.tipo, numero: p.numero, titulo: p.titulo, cliente_nome: p.cliente_nome }]);
      porClientes(p.clientes);
    }).catch(falha).finally(() => setPronto(true));
  }, [tarefaInicial, processoInicial, comProcessos, porClientes]);
  // A cada etapa, o foco vai para o primeiro campo dela.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>(CAMPOS_DA_ETAPA)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  const etapa = ETAPAS_DEMANDA[passo];
  const ultimo = passo === ETAPAS_DEMANDA.length - 1;
  const todos = validarDemanda(c);
  const conferidos = new Set(ETAPAS_DEMANDA.filter(e => conferidas.has(e.id)).flatMap(e => e.campos));
  const erros: Partial<Record<keyof CamposDemanda, string>> = Object.fromEntries(Object.entries(todos).filter(([campo]) => conferidos.has(campo as keyof CamposDemanda)));
  const mudar = (campos: Partial<CamposDemanda>) => setC(atual => ({ ...atual, ...campos }));

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
    if (Object.keys(errosDaEtapaDemanda(etapa.id, c)).length) { focarErro(); return; }
    if (ultimo) void salvar(); else irPara(passo + 1);
  }
  // Enter: vai para o próximo campo da etapa ou para a próxima etapa. A busca de pessoa e a de contrato tratam o Enter delas.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...document.querySelectorAll<HTMLElement>(CAMPOS_DA_ETAPA)].filter(x => x.offsetParent !== null && !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else avancar();
  }

  // ---------- clientes ----------
  const escolherCliente = (i: number) => (p: PessoaLista | null) => {
    setClientes(atual => atual.map((x, j) => j === i ? p : x));
    setC(atual => ({ ...atual, clientes: atual.clientes.map((x, j) => j === i ? p?.id ?? '' : x) }));
  };
  function acrescentarCliente() {
    const chave = proximaChave.current++;
    setClientes(atual => [...atual, null]);
    setChaves(atual => [...atual, chave]);
    setC(atual => ({ ...atual, clientes: [...atual.clientes, ''] }));
    setFocarCliente(chave);
  }
  function tirarCliente(i: number) {
    setClientes(atual => atual.toSpliced(i, 1));
    setChaves(atual => atual.toSpliced(i, 1));
    setC(atual => ({ ...atual, clientes: atual.clientes.toSpliced(i, 1) }));
    focarNosClientes();
  }
  // Na busca de cada linha, quem já é cliente em outra linha aparece desligado.
  const outroCliente = (i: number) => (p: PessoaLista) => c.clientes.some((x, j) => j !== i && x === p.id) ? 'já é cliente' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);

  // ---------- contrato ----------
  const contratoEscolhido = contratos.find(k => k.id === c.contratoId);
  const rotuloEscolhido = contratoEscolhido ? rotuloDoContrato(contratoEscolhido) : alvo?.contrato_codigo && alvo.contrato_id === c.contratoId ? alvo.contrato_codigo
    : contratoDaOrigem?.id === c.contratoId ? contratoDaOrigem.rotulo : '';
  // A tarefa de origem com outro contrato não poderia ficar na demanda: avisa antes de salvar.
  const contratoForaDaTarefa = tarefa ? motivoDoContratoDaTarefa(tarefa.contrato_id, c.contratoId) : '';
  function digitarContrato(texto: string) {
    const k = contratos.find(x => rotuloDoContrato(x) === texto);
    if (k) { mudar({ contratoId: k.id }); setBuscaContrato(''); } else setBuscaContrato(texto);
  }

  // ---------- envio ----------
  /** No lápis do cartão, o título e a descrição (#346) e as datas (#361) ficam de fora: o cartão já os muda no próprio lugar. */
  const noLapis = (d: DadosDemanda): DadosDemanda => edicao ? semOsCampos(semOsCamposDoLugar(d), DATAS_NO_LUGAR.demandas.dados) : d;
  async function salvar() {
    if (ocupado) return;   // o Enter não respeita o botão desligado
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErroDemanda(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_DEMANDA.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados: DadosDemanda = noLapis(dadosDaDemanda(c));
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: a demanda como estava, no mesmo formato que o cadastro grava.
        const antes = noLapis(dadosDaDemanda(camposDaDemanda(alvo)));
        const eu = ctx.perfil.id, { dados: gravar, ficou } = semSairDaDemanda(dados, eu, gravaForaDoCartao(ctx, alvo.criado_por === eu), { responsavel_id: alvo.responsavel_id, lista: alvo.colaboradores });
        await SD.demandaAtualizar(alvo.id, gravar);
        // Os processos antes de uma eventual saída: depois dela, a pessoa pode não poder mais ligar nem desligar.
        const mudou = mudancasNosProcessos(processosAntes.current, processos.map(p => p.id));
        const ligar = (id: string) => SD.processoDemandaLigar(id, alvo.id, 'atua'), desligar = (id: string) => SD.processoDemandaDesligar(id, alvo.id);
        await gravarProcessos(mudou, ligar, desligar);
        if (ficou) {
          // A pessoa se tirou do cartão: o resto já foi gravado com ela nele, e a saída vem por último, para valer mesmo que ela perca o acesso.
          await sairDoCartao('demandas', alvo.id, 'Demanda atualizada. Você saiu dela, e a saída ficou no histórico.');
          saidaLiberada.current = true;
          if (edicao && equipeVeTudo(ctx.escritorio)) edicao.aoTerminar(true); else navegar('/demandas/');
          return;
        }
        feito('Demanda atualizada.', 'atualização da demanda', async () => {
          await SD.demandaAtualizar(alvo.id, antes);
          await gravarProcessos({ ligar: mudou.desligar, desligar: mudou.ligar }, ligar, desligar);
          return { tipo: 'demandaAtualizada', id: alvo.id };
        });
        saidaLiberada.current = true;
        if (edicao) edicao.aoTerminar(true); else navegar('/demandas/?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, a demanda nova entra na coluna-marco de início ("Para fazer").
        const coluna = etapaInicial || await colunaInicial('demandas');
        const r = await SD.demandaCriar({ ...dados, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        // A demanda já existe: a ligação que falhar não a desfaz (salvar de novo a duplicaria), e a pessoa fica sabendo.
        const ligacoes = await Promise.allSettled(processos.map(p => SD.processoDemandaLigar(p.id, r.id, 'atua')));
        feito(`Demanda ${r.codigo} cadastrada.`, 'cadastro da demanda', async () => {
          await SD.demandasArquivar([r.id], true);
          const x = await SD.demandasExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'demandaCriada', id: r.id };
        });
        ligacoes.forEach((x, i) => { if (x.status === 'rejected') avisar(avisoDaLigacaoQueFalhou('processo na demanda', processos[i].codigo, x.reason), 'erro'); });
        // Vinda de um cartão, volta a ele, com a demanda nova na seção. Sem origem, ou com a tarefa de outro contrato (que não
        // fica nela, como o cadastro já avisou), abre o cartão da demanda.
        const doCriado = '/demandas/?id=' + r.id;
        const { liga, volta } = aoSalvarPelaOrigem(origem, contratoForaDaTarefa, doCriado);
        // A tarefa de origem pela ligação dela; o processo de origem, se continuou entre os escolhidos e a ligação dele deu certo.
        let ficouLigada = !!origem && processoDeOrigemLigado(origem.id, processos, ligacoes);
        if (liga && tarefa) {
          try { await ligarTarefaNaDemanda(tarefa.id, r.id); ficouLigada = true; }
          catch (e) { avisar(avisoDaLigacaoQueFalhou('tarefa na demanda', tarefa.codigo, e), 'erro'); }
        }
        saidaLiberada.current = true;
        // Se não ficou ligada à origem, a demanda não apareceria lá: vai ao cartão dela.
        navegar(await depoisDeCriarNaAnotacao(daAnotacao, 'demanda', r.id, depoisDeCriar(volta, ficouLigada, doCriado)), { replace: !!origem || !!daAnotacao });
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  const CONTEUDO: Record<EtapaDemanda, () => ReactNode> = {
    demanda: () => <>
      {/* No lápis do cartão, o título e a descrição não se repetem: o cartão os muda no próprio lugar (#346). */}
      {!edicao && <>
        <Campo rotulo="Título" para="titulo" obrigatorio erro={erros.titulo} dica="O que precisa ser feito. Ex.: Pedido de registro de marca.">
          <input type="text" {...propsDoCampo('titulo', { dica: true, erro: erros.titulo })} maxLength={TAMANHO_DEMANDA.titulo} value={c.titulo}
            onChange={e => mudar({ titulo: e.target.value })} />
        </Campo>
        <Campo rotulo="Descrição" para="descricao" erro={erros.descricao}>
          <CaixaFormatada {...propsDoCampo('descricao', { erro: erros.descricao })} maxLength={TAMANHO_DEMANDA.descricao} valor={c.descricao}
            aoMudar={descricao => mudar({ descricao })} />
        </Campo>
      </>}
      <CampoDoPrazo rotulo="Prazo de entrega" prazo={c.prazo} hora={c.hora} lembrete={c.lembrete} erros={erros} aoMudar={mudar} />
      {/* A data de início só ao mudar uma demanda que já existe: a nova começa no dia em que é criada (#357). */}
      {c.inicio !== null && <CampoDoInicio valor={c.inicio} erro={erros.inicio} aoMudar={inicio => mudar({ inicio })} />}
    </>,
    pessoas: () => <>
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pela demanda: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, colaboradores: c.colaboradores.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <EscolhaDaEquipe rotulo="Colaboradores" erro={erros.colaboradores} dica="Quem da equipe também trabalha na demanda (e passa a vê-la)." adicionar="Adicionar colaborador"
        equipe={ctx.equipe} escolhidos={c.colaboradores} fora={c.responsavelId ? [c.responsavelId] : []} aoMudar={colaboradores => mudar({ colaboradores })} />
      <GruposNoLapis ids={alvo?.grupos} />
      <CampoDeVarios rotulo="Clientes" erro={erros.clientes} grupo={grupoDosClientes}>
        {c.clientes.map((_, i) => <div className="linha-cliente" key={chaves[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={<span className="sr">{c.clientes.length === 1 ? 'Cliente' : `Cliente ${i + 1}`}</span>} escolhida={clientes[i]}
              aoEscolher={escolherCliente(i)} desativar={outroCliente(i)} focar={chaves[i] === focarCliente} />
          </div>
          {c.clientes.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar o cliente ${i + 1}`} onClick={() => tirarCliente(i)}>
            <Icone nome="fechar" tam={15} />
          </button>}
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.clientes.length >= CLIENTES_MAXIMOS} onClick={acrescentarCliente}>
          <Icone nome="mais" tam={13} /> Adicionar cliente
        </button></div>
      </CampoDeVarios>
    </>,
    contrato: () => <>
      {c.contratoId
        ? <div className="pergunta">
          <span className="rot">Contrato</span>
          <div className="demanda-contrato-escolhido">
            <span>{rotuloEscolhido || 'Contrato ligado'}</span>
            <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => mudar({ contratoId: '' })}>Tirar o contrato</button>
          </div>
          {contratoForaDaTarefa && <Aviso tipo="info">{contratoForaDaTarefa}</Aviso>}
        </div>
        : <Campo rotulo="Contrato" para="contrato" dica="Busque pelo número, pelo cliente ou pelo objeto. Deixe vazio se a demanda não vem de um contrato.">
          <CampoComSugestoes id="contrato" aria-describedby="contrato-dica" placeholder="Buscar contrato…" valor={buscaContrato} aoMudar={digitarContrato}
            sugestoes={contratos.map(k => ({ valor: rotuloDoContrato(k) }))} />
        </Campo>}
      {comProcessos && <EscolhaDeProcessos rotulo="Processos" dica="Os processos em que a demanda trabalha. Busque pelo número, pelo nome ou pelo cliente."
        escolhidos={processos} ocultos={processosOcultos} aoMudar={setProcessos} />}
    </>
  };

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé, menos a que só tem o que o cartão muda no lugar.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar demanda" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {etapasDoLapis(ETAPAS_DEMANDA, camposForaDoLapis(DATAS_NO_LUGAR.demandas)).map(e => <SecaoDoFormulario key={e.id} titulo={e.titulo} nivel={3}>
        {CONTEUDO[e.id]()}
      </SecaoDoFormulario>)}
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = idAtualizar ? '/demandas/?id=' + idAtualizar : '/demandas/';
  const total = ETAPAS_DEMANDA.length;
  return <div className="passos">
    <AvisoAoSair estado={{ c, clientes, processos }}liberada={saidaLiberada} ocupado={ocupado} />
    <header>
      <p className="olho"><Link to={voltar}>Demandas</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar demanda' : 'Nova demanda'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando a demanda <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
    {origem && <Aviso tipo="info">{textoDaOrigem(origem)[0]} <b>{origem.codigo}</b> ({origem.nome}){textoDaOrigem(origem)[1]}</Aviso>}
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
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar demanda') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
