// Cadastro de processo (novo ou atualizar), por etapas como os de pessoa, contrato e demanda: o processo (tipo, número,
// nome e órgão), as pessoas (clientes, o papel de cada um e equipe) e os detalhes, nenhum deles obrigatório. No judicial, o número segue
// o padrão do CNJ (ou é marcado como antigo) e já indica o órgão. Vindo do cartão de uma pessoa (?cliente=), ela já vem escolhida.
// Vindo do "+ Novo processo" de uma demanda, de um contrato ou de uma tarefa (?demanda=, ?contrato=, ?tarefa=; #376), ele traz o que
// a origem tem (NASCE_DE) e, ao salvar, nasce ligado a ela; do contrato e da tarefa, a tela volta ao cartão de origem. Da demanda e
// da pessoa, volta só quando o cadastro foi aberto pelo "+ Novo processo" do cartão (a marca da volta, cadastroComVolta).
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { semOsCamposDoLugar } from '../regras/edicaoNoLugar';
import { SD, type DadosProcesso, type CampoDeOpcao, type CampoDeProcesso, type OpcaoDeProcesso, type PessoaLista, type PessoaResumida, type Processo, type SugestoesDeProcesso, type TipoProcesso } from '../dados';
import { CLIENTES_MAXIMOS, TAMANHO_CAMPO, TAMANHO_PROCESSO } from '../dados/limites';
import { SIGLAS_SUGERIDAS } from '../regras/calendario';
import { camposDoTipo, camposParaDesfazer, errosDosCampos, valoresNoFormulario, valoresParaGravar } from '../regras/camposDeProcesso';
import {
  aoMudarNumero, camposDoProcesso, dadosDoProcesso, ETAPAS_PROCESSO, errosDaEtapaProcesso, GRATUIDADES, ehOpcaoPronta, LISTAS_DO_PROCESSO, MEIOS, opcaoNaLista, opcoesDoCampo, orgaoIndicadoNoProcesso,
  comPapelDoCliente, escritosAoTrocarCliente, PAPEIS_DO_CLIENTE, papeisAoTrocarCliente, errosDosDadosDoProcesso, LIGACOES, ligacaoDaOrigem, ligacaoDoEndereco, ligacoesDaOrigem, origemAoCriar, primeiraEtapaComErroProcesso,
  CAMPOS_PROCESSO, processoDoProcesso, processoVazio, semSairDoProcesso, soOsDadosDaSecao, tipoDoDerivado, tipoDoEndereco, TIPOS,
  TIPOS_PROCESSO, validarProcesso, type CamposProcesso, type EtapaProcesso
} from '../regras/processo';
import { camposDaDemanda } from '../regras/processoDaDemanda';
import { enderecoDoItem } from '../regras/anotacao';
import {
  cartaoDeOrigem, depoisDeCriar, origemNoEndereco, processoDaTarefa, processoDoContrato, recusaDaOrigem, type RecusaDaOrigem
} from '../regras/origemDoCadastro';
import { ligarContratoNoProcesso, ligarNoItem } from './ligarNoCartao';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { CamposDaProtecao } from './processo/CamposDaProtecao';
import { OpcoesDoPapel, papelDaEscolha } from './processo/EscolhaDoPapel';
import { nomesParaALista, valorDoPapel } from '../regras/papelEscrito';
import { incluirNaListaDoEscritorio, usePapeisEscritos } from '../ui/papeisEscritos';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { avisar, falha, feito } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { equipeVeTudo } from '../regras/equipeVeTudo';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { Aviso, Campo, CampoData, CampoDeVarios, Carregando, Escolhas, estiloBotao, FormularioDosDados, idsDoCampoDeVarios, propsDoCampo, SecaoDoFormulario, useFocoNoGrupo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { GruposNoLapis } from '../ui/GruposDoItem';
import { Icone } from '../ui/Icone';
import { pedirTexto } from '../ui/janela';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { ordemNoFim } from '../ui/quadro/posicao';
import { useCtx } from '../ui/sessao';
import { subirAoCadastro, useTitulo } from '../ui/util';
import './Contratos.css';
import './Demandas.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** Os campos da etapa que está na tela (o Enter passa de um para o outro). */
const CAMPOS_DA_ETAPA = '.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select';
const NADA_SUGERIDO: SugestoesDeProcesso = { orgaos: [], comarcas: [], varas: [] };
const emSugestoes = (lista: string[]) => lista.map(valor => ({ valor }));
const NAO_INFORMADO = 'Não informado';
/** A primeira pergunta com erro: na etapa que está na tela ou, na seção de dados do cartão (#428), no formulário dela. */
const PERGUNTA_COM_ERRO = '.etapa.ativa .pergunta.erro, .dados-editaveis-edicao .linha-dos-dados.erro';
/** A base dos ids do grupo Clientes (idsDoCampoDeVarios): o papel de cada linha aponta para a dica e o erro dele. */
const GRUPO_DOS_CLIENTES = 'clientes-do-processo';

/** De que cartões o processo novo pode nascer (o nome do parâmetro do endereço), na ordem em que são lidos. Do processo: recurso ou incidental (#316). */
const ORIGENS = ['demanda', 'contrato', 'tarefa', 'processo'] as const;
type OrigemDoProcesso = typeof ORIGENS[number];
/**
 * A origem lida: o aviso no topo do cadastro, o que ela traz (e o nome sugerido), o cartão para onde voltar (null: vai ao processo novo)
 * e, quando o endereço ficou velho, por que ela não aceita mais o processo ligado (recusaDaOrigem): aí o cadastro ainda traz o que ela tem,
 * mas diz, antes de gravar, que o processo não fica ligado, e a ligação nem é tentada.
 */
interface OrigemLida {
  codigo: string; aviso: ReactNode; campos: Partial<CamposProcesso>; clientes: PessoaResumida[]; titulo?: string; cartao: string | null; recusa: RecusaDaOrigem | null;
  /** O tipo do processo de origem (#425): diz que ligações o cadastro oferece (o administrativo oferece também o judicial). */
  tipoDoProcesso?: TipoProcesso;
}
/** Como os avisos falam da origem: "A tarefa", "arquivada" e "ela" (no fim: "não fica ligado a ela"). */
interface FalaDaOrigem { nome: string; arquivada: string; pronome: string }
interface ComoNasce {
  ler: (id: string, ativos: string[], eu: string) => Promise<OrigemLida | null>;
  /** A ligação, depois de gravar o processo. */
  ligar: (processoId: string, origemId: string) => Promise<unknown>;
  /** Como o aviso de falha fala da origem ("à demanda"). */
  aOrigem: string;
  fala: FalaDaOrigem;
}
/** O aviso de quando a origem não aceita mais o processo ligado a ela: o cadastro continua, e o processo nasce sem a ligação. */
const AVISO_DA_RECUSA: Record<RecusaDaOrigem, (f: FalaDaOrigem, codigo: string) => ReactNode> = {
  arquivada: (f, codigo) => <>{f.nome} <b>{codigo}</b> está {f.arquivada}: este processo não fica ligado a {f.pronome}.</>,
  ocupada: (f, codigo) => <>{f.nome} <b>{codigo}</b> já tem um processo: este processo novo não fica ligado a {f.pronome}.</>
};
/**
 * Como o processo nasce de cada origem. Da demanda, com o nome dela; a tela vai ao processo novo, a não ser que o cadastro tenha vindo
 * do "+ Novo processo" do cartão da demanda (a marca da volta, cartaoDeOrigem): aí volta a ela.
 */
const NASCE_DE: Record<OrigemDoProcesso, ComoNasce> = {
  demanda: {
    ler: async (id, ativos, eu) => {
      const d = await SD.demandaObter(id);
      return d && { codigo: d.codigo, aviso: <>Este processo nasce da demanda <b>{d.codigo}</b> ({d.titulo}) e fica ligado a ela.</>,
        campos: camposDaDemanda(d, ativos, eu), clientes: d.clientes, titulo: d.titulo, cartao: null, recusa: recusaDaOrigem({ arquivada: !!d.arquivado_em }) };
    },
    ligar: (processoId, demandaId) => SD.processoDemandaLigar(processoId, demandaId),
    aOrigem: 'à demanda',
    fala: { nome: 'A demanda', arquivada: 'arquivada', pronome: 'ela' }
  },
  contrato: {
    ler: async (id, ativos, eu) => {
      const k = await SD.contratoVer(id);
      return k && { codigo: k.codigo, aviso: <>Este processo nasce do contrato <b>{k.codigo}</b> e fica ligado a ele.</>,
        campos: processoDoContrato(k, ativos, eu), clientes: k.clientes, cartao: enderecoDoItem({ modulo: 'contratos', id: k.id }),
        recusa: recusaDaOrigem({ arquivada: !!k.arquivado_em }) };
    },
    ligar: (processoId, contratoId) => ligarContratoNoProcesso(processoId, contratoId),
    aOrigem: 'ao contrato',
    fala: { nome: 'O contrato', arquivada: 'arquivado', pronome: 'ele' }
  },
  tarefa: {
    ler: async id => {
      const t = await SD.tarefaObter(id);
      // A tarefa tem um processo só: a que já ganhou um (ex.: a pessoa voltou pelo navegador depois de criar) não aceita outro.
      return t && { codigo: t.codigo, aviso: <>Este processo nasce da tarefa <b>{t.codigo}</b> ({t.titulo}) e fica ligado a ela.</>,
        campos: processoDaTarefa(t), clientes: t.pessoas, cartao: enderecoDoItem({ modulo: 'tarefas', id: t.id }),
        recusa: recusaDaOrigem({ arquivada: !!t.arquivado_em, ocupada: !!t.processo_id }) };
    },
    ligar: (processoId, tarefaId) => ligarNoItem('processo da tarefa', tarefaId, processoId),
    aOrigem: 'à tarefa',
    fala: { nome: 'A tarefa', arquivada: 'arquivada', pronome: 'ela' }
  },
  // O recurso ou incidental (#316) e o judicial do administrativo (#425): a ligação vai junto ao criar (origemAoCriar), e a tela volta
  // ao processo de origem, onde ele aparece.
  processo: {
    ler: async (id, ativos, eu) => {
      const o = await SD.processoObter(id);
      if (!o) return null;
      // Arquivado, o processo de origem não aceita mais o novo ligado: o cadastro traz o que ele tem, mas sem a origem.
      const recusa = recusaDaOrigem({ arquivada: !!o.arquivado_em }), campos = processoDoProcesso(o, ativos, eu);
      return { codigo: o.codigo, aviso: <>Este processo nasce do processo <b>{o.codigo}</b> ({o.numero}) e fica ligado a ele, com o próprio número e os próprios andamentos.</>,
        campos: recusa ? { ...campos, origemId: '' } : campos, clientes: o.clientes, cartao: TIPOS_PROCESSO[o.tipo].caminho + '?id=' + o.id, recusa, tipoDoProcesso: o.tipo };
    },
    ligar: async () => {},
    aOrigem: 'ao processo',
    fala: { nome: 'O processo', arquivada: 'arquivado', pronome: 'ele' }
  }
};

/** Como cada tipo de campo do escritório é preenchido. */
const CONTROLE_DO_CAMPO: Record<CampoDeProcesso['tipo'], (p: { id: string; campo: CampoDeProcesso; valor: string; erro?: string; aoMudar: (v: string) => void }) => ReactNode> = {
  texto: ({ id, valor, erro, aoMudar }) => <input type="text" {...propsDoCampo(id, { erro })} maxLength={TAMANHO_CAMPO.texto} value={valor} onChange={e => aoMudar(e.target.value)} />,
  data: ({ id, valor, erro, aoMudar }) => <CampoData {...propsDoCampo(id, { erro })} valor={valor} aoMudar={aoMudar} />,
  numero: ({ id, valor, erro, aoMudar }) => <input type="text" {...propsDoCampo(id, { erro })} inputMode="decimal" value={valor} onChange={e => aoMudar(e.target.value)} />,
  // O valor que saiu da lista continua aparecendo até a pessoa escolher outro.
  lista: ({ id, campo, valor, erro, aoMudar }) => <select {...propsDoCampo(id, { erro })} value={valor} onChange={e => aoMudar(e.target.value)}>
    <option value="">{NAO_INFORMADO}</option>
    {[...new Set([...campo.opcoes, ...(valor ? [valor] : [])])].map(o => <option key={o} value={o}>{o}</option>)}
  </select>
};
function CampoDoEscritorio({ campo, valor, erro, aoMudar }: { campo: CampoDeProcesso; valor: string; erro?: string; aoMudar: (v: string) => void }) {
  const id = 'extra-' + campo.id;
  return <Campo rotulo={campo.nome} para={id} erro={erro}>{CONTROLE_DO_CAMPO[campo.tipo]({ id, campo, valor, erro, aoMudar })}</Campo>;
}

export default function NovoProcesso({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa'), clienteInicial = params.get('cliente');
  const tipoInicial: TipoProcesso = tipoDoEndereco(params.get('tipo'));
  // Vindo de uma demanda, de um contrato ou de uma tarefa, o processo já traz o que ela tem e nasce ligado a ela.
  const [origem] = useState(() => idAtualizar ? null : origemNoEndereco(params, ORIGENS));
  const [lida, setLida] = useState<OrigemLida | null>(null);

  // Quem cadastra já vem como responsável.
  // O recurso ou incidental já pode vir escolhido pelo botão do cartão de origem (?ligacao=, #316).
  const [c, setC] = useState<CamposProcesso>(() => ({ ...processoVazio(tipoInicial), responsavelId: ctx.perfil.id, ligacao: ligacaoDoEndereco(params.get('ligacao')) }));
  const [alvo, setAlvo] = useState<Processo | null>(null);   // processo sendo atualizado
  // Vindo de outro cartão, espera os dados dele: o que chegar depois não pode trocar o que a pessoa já escolheu.
  const [pronto, setPronto] = useState(!idAtualizar && !origem);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaProcesso>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // A pessoa escolhida em cada linha de cliente (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [clientes, setClientes] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const { grupo: grupoDosClientes, focarNoGrupo: focarNosClientes } = useFocoNoGrupo();
  const [focarCliente, setFocarCliente] = useState<number | null>(null);
  // As listas ampliadas pelo escritório e o que já foi digitado em outros processos.
  const [opcoes, setOpcoes] = useState<OpcaoDeProcesso[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestoesDeProcesso>(NADA_SUGERIDO);
  // Os campos que o escritório criou.
  const [camposDoEscritorio, setCamposDoEscritorio] = useState<CampoDeProcesso[]>([]);
  // Os papéis escritos pela equipe (#443), a lista do escritório.
  const papeisDoEscritorio = usePapeisEscritos();
  // Os nomes que a pessoa escreveu agora na janela: só eles vão para a lista ao gravar (o copiado da origem do recurso não vai).
  const [escritosAgora, setEscritosAgora] = useState<string[]>([]);
  // O órgão que o número indicou: troca se o número mudar, mas nunca o que a pessoa digitou.
  const orgaoIndicado = useRef('');
  useTitulo(edicao ? null : alvo ? 'Atualizar processo' : 'Novo processo');

  useEffect(() => {
    SD.processoOpcoes().then(setOpcoes).catch(() => {});
    if (idAtualizar) {
      Promise.all([SD.processoObter(idAtualizar), SD.processoCampos()])
        .then(([p, doEscritorio]) => {
          if (!p) throw new Error('Processo não encontrado.');
          setAlvo(p);
          setCamposDoEscritorio(doEscritorio);
          const campos = { ...camposDoProcesso(p), extras: valoresNoFormulario(doEscritorio, p.campos) };
          setC(campos);
          orgaoIndicado.current = orgaoIndicadoNoProcesso(campos);
          setClientes(p.clientes.length ? p.clientes : [null]);
          setChaves(p.clientes.length ? p.clientes.map((_, i) => i) : [0]);
          proximaChave.current = p.clientes.length + 1;
        })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    SD.processoCampos().then(setCamposDoEscritorio).catch(falha);
    if (clienteInicial) SD.pessoaObter(clienteInicial).then(p => { if (p) { setClientes([p]); setC(x => ({ ...x, clientes: [p.id] })); } }).catch(falha);
  }, [idAtualizar, clienteInicial]);
  // A equipe de quando o cadastro abriu: reler a equipe depois não pode apagar o que já foi digitado.
  const aoAbrir = useRef({ ativos: ctx.equipe.filter(m => m.ativo !== false).map(m => m.id), eu: ctx.perfil.id });
  useEffect(() => {
    if (!origem) return;
    NASCE_DE[origem.tipo].ler(origem.id, aoAbrir.current.ativos, aoAbrir.current.eu).then(l => {
      if (!l) return;
      setLida(l);
      // O judicial do administrativo (#425) já vem escolhido pelo botão do cartão: o tipo é o da ligação, e não o da origem. A ligação
      // que a origem não oferece (um link antigo ou mudado à mão) volta a nenhuma, para a pessoa escolher entre as que aparecem.
      setC(x => {
        if (!l.tipoDoProcesso) return { ...x, ...l.campos, titulo: x.titulo || (l.titulo ?? '') };
        const ligacao = ligacaoDaOrigem(x.ligacao, l.tipoDoProcesso);
        return { ...x, ...l.campos, titulo: x.titulo || (l.titulo ?? ''), ligacao, tipo: tipoDoDerivado(ligacao, l.tipoDoProcesso) };
      });
      if (l.clientes.length) {
        setClientes(l.clientes);
        setChaves(l.clientes.map((_, i) => i));
        proximaChave.current = l.clientes.length + 1;
      }
    }).catch(falha).finally(() => setPronto(true));
  }, [origem]);
  useEffect(() => { SD.processoSugestoes(c.tipo).then(setSugestoes).catch(() => {}); }, [c.tipo]);
  // A cada etapa, o foco vai para o primeiro campo dela.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>(CAMPOS_DA_ETAPA)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  const etapa = ETAPAS_PROCESSO[passo];
  const ultimo = passo === ETAPAS_PROCESSO.length - 1;
  const todos = validarProcesso(c);
  const conferidos = new Set(ETAPAS_PROCESSO.filter(e => conferidas.has(e.id)).flatMap(e => e.campos));
  const erros: Partial<Record<keyof CamposProcesso, string>> = Object.fromEntries(Object.entries(todos).filter(([campo]) => conferidos.has(campo as keyof CamposProcesso)));
  const mudar = (campos: Partial<CamposProcesso>) => setC(atual => ({ ...atual, ...campos }));
  // O papel que falta na linha de um cliente já escolhido (#426), e a dica e o erro do grupo que o leitor de tela lê junto dele.
  const papelFaltando = (id: string) => !!erros.papeisClientes && !!id && !c.papeisClientes[id];
  const descricaoDoPapel = (id: string) => {
    const ids = idsDoCampoDeVarios(GRUPO_DOS_CLIENTES);
    return [ids.dica, papelFaltando(id) ? ids.erro : ''].filter(Boolean).join(' ');
  };
  const judicial = c.tipo === 'judicial', noPadrao = judicial && !c.numeroAntigo;
  // Os erros dos campos do escritório aparecem junto com os da etapa de detalhes.
  const errosDosExtras = errosDosCampos(camposDoEscritorio, c.tipo, c.extras);
  const extrasComErro = Object.keys(errosDosExtras).length > 0;
  const errosVisiveisDosExtras = conferidas.has('detalhes') ? errosDosExtras : {};

  // ---------- etapas ----------
  function irPara(i: number) {
    setPasso(i);
    subirAoCadastro();
  }
  const focarErro = () => requestAnimationFrame(() =>
    document.querySelector(PERGUNTA_COM_ERRO)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  function avancar() {
    if (edicao) { void salvar(); return; }
    setConferidas(x => new Set(x).add(etapa.id));
    if (Object.keys(errosDaEtapaProcesso(etapa.id, c)).length || (etapa.id === 'detalhes' && extrasComErro)) { focarErro(); return; }
    if (ultimo) void salvar(); else irPara(passo + 1);
  }
  // Enter: vai para o próximo campo da etapa ou para a próxima etapa. A busca de pessoa trata o Enter dela.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...document.querySelectorAll<HTMLElement>(CAMPOS_DA_ETAPA)].filter(x => x.offsetParent !== null && !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else avancar();
  }

  // ---------- número e órgão ----------
  function mudarNumero(mudanca: Parameters<typeof aoMudarNumero>[1]) {
    const r = aoMudarNumero(c, mudanca, orgaoIndicado.current);
    orgaoIndicado.current = r.orgaoIndicado;
    mudar(r.campos);
  }
  const siglas = [...new Set([...sugestoes.orgaos, ...SIGLAS_SUGERIDAS])];

  // ---------- clientes ----------
  const escolherCliente = (i: number) => (p: PessoaLista | null) => {
    setClientes(atual => atual.map((x, j) => j === i ? p : x));
    setC(atual => ({ ...atual, clientes: atual.clientes.map((x, j) => j === i ? p?.id ?? '' : x),
      papeisClientes: papeisAoTrocarCliente(atual.papeisClientes, atual.clientes[i], p?.id ?? ''),
      papeisEscritos: escritosAoTrocarCliente(atual.papeisClientes, atual.papeisEscritos, atual.clientes[i], p?.id ?? '') }));
  };
  // O papel de uma linha (#426): um da lista, um escrito pela equipe ou, pela última opção, um que a pessoa escreve agora (#443).
  // Se ela desiste de escrever, nada muda, e o select volta ao que estava. Com mais de um cliente, a janela diz de quem é o papel.
  async function escolherPapel(i: number, clienteId: string, valor: string) {
    const escolha = await papelDaEscolha(valor, papeisDoEscritorio, c.clientes.length > 1 ? clientes[i]?.nome : null);
    if (escolha === undefined) return;
    setC(atual => ({ ...atual, papeisClientes: comPapelDoCliente(atual.papeisClientes, clienteId, escolha?.papel ?? ''),
      papeisEscritos: { ...atual.papeisEscritos, [clienteId]: escolha?.escrito } }));
    // O nome escrito agora vai para a lista do escritório depois de gravar o processo (nomesParaALista).
    const escrito = escolha?.escritoAgora && escolha.escrito;
    if (escrito) setEscritosAgora(atual => [...atual, escrito]);
  }
  // Os nomes já escritos no formulário aparecem no grupo "Do escritório" das outras linhas.
  const escritosNoFormulario = c.clientes.map(id => c.papeisClientes[id] === 'outro' ? c.papeisEscritos[id] : undefined);
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

  // ---------- listas que o administrador amplia ----------
  const doEscritorio = (campo: CampoDeOpcao) => opcoes.filter(o => o.campo === campo).map(o => o.valor);
  async function acrescentarOpcao(campo: CampoDeOpcao) {
    const valor = await pedirTexto(`Acrescentar opção em "${LISTAS_DO_PROCESSO[campo].rotulo}"`, '', { maximo: TAMANHO_PROCESSO.opcao });
    if (!valor) return;
    const jaExiste = opcaoNaLista(opcoesDoCampo(campo, doEscritorio(campo)), valor);
    if (jaExiste) { mudar({ [campo]: jaExiste }); return; }
    try {
      const nova = await SD.processoOpcaoCriar(campo, valor);
      setOpcoes(atual => [...atual, nova]);
      mudar({ [campo]: nova.valor });
    } catch (e) { falha(e); }
  }
  async function retirarOpcao(opcao: OpcaoDeProcesso) {
    try {
      await SD.processoOpcaoExcluir(opcao.id);
      setOpcoes(atual => atual.filter(o => o.id !== opcao.id));
      feito(`Opção "${opcao.valor}" retirada da lista.`, 'retirada da opção', async () => {
        const devolvida = await SD.processoOpcaoCriar(opcao.campo, opcao.valor);
        setOpcoes(atual => [...atual, devolvida]);
      });
    } catch (e) { falha(e); }
  }
  // A escolhida, quando é uma das que o escritório acrescentou: o administrador pode retirá-la (ex.: digitada errado).
  // Se ela também é de uma lista pronta, retirar não a tira da lista: o botão não aparece (#288).
  const opcaoEscolhida = (campo: CampoDeOpcao) => ehOpcaoPronta(campo, c[campo]) ? undefined : opcoes.find(o => o.campo === campo && o.valor === c[campo]);
  const listaDe = (campo: CampoDeOpcao, escolhida = opcaoEscolhida(campo)) => <Campo rotulo={LISTAS_DO_PROCESSO[campo].rotulo} para={campo} curto={CAMPOS_PROCESSO[campo]}
    depois={ctx.ehAdmin && <div className="acoes-lote">
      <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => void acrescentarOpcao(campo)}><Icone nome="mais" tam={13} /> Acrescentar opção</button>
      {escolhida && <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => void retirarOpcao(escolhida)}><Icone nome="fechar" tam={13} /> Retirar da lista</button>}
    </div>}>
    <select {...propsDoCampo(campo)} value={c[campo]} onChange={e => mudar({ [campo]: e.target.value })}>
      <option value="">{NAO_INFORMADO}</option>
      {opcoesDoCampo(campo, doEscritorio(campo), c[campo]).map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </Campo>;

  // ---------- envio ----------
  /**
   * No lápis do cartão, o nome do cartão fica de fora: o cartão já o muda no próprio lugar (#346). Na seção de dados (#428), também
   * as pessoas e a equipe: o que está gravado nelas continua como está.
   */
  const soOsDados = !!edicao?.soOsDados;
  const noLapis = (d: DadosProcesso): DadosProcesso => soOsDados ? soOsDadosDaSecao(d) : edicao ? semOsCamposDoLugar(d) : d;
  async function salvar() {
    if (ocupado) return;   // o Enter não respeita o botão desligado
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = extrasComErro ? ETAPAS_PROCESSO.findIndex(e => e.id === 'detalhes') : primeiraEtapaComErroProcesso(c);
    const primeiroErro = primeiraEtapaComErroProcesso(c);
    // Na seção de dados, só os erros dos campos dela (o cliente que falta num processo antigo não a impede de salvar).
    const temErro = soOsDados ? extrasComErro || Object.keys(errosDosDadosDoProcesso(c)).length > 0 : primeiroErro >= 0 || comErro >= 0;
    if (temErro) {
      setConferidas(new Set(ETAPAS_PROCESSO.map(e => e.id)));
      if (!edicao) irPara(primeiroErro >= 0 ? primeiroErro : comErro);
      focarErro();
      return;
    }
    const { caminho, quadro } = TIPOS_PROCESSO[c.tipo];
    setOcupado(true);
    try {
      // Parte do que está guardado agora: alguém pode ter preenchido um campo novo depois que este formulário abriu.
      const guardados = alvo ? (await SD.processoObter(alvo.id))?.campos ?? alvo.campos : {};
      const dados = { ...noLapis(dadosDoProcesso(c)), campos: valoresParaGravar(camposDoEscritorio, c.tipo, c.extras, guardados) };
      if (alvo) {
        // Para desfazer: o processo como estava, no mesmo formato que o cadastro grava.
        const antes = noLapis(dadosDoProcesso(camposDoProcesso(alvo)));
        // A seção de dados não mexe na equipe: ninguém sai do processo por ela.
        const eu = ctx.perfil.id, { dados: gravar, ficou } = soOsDados ? { dados, ficou: false }
          : semSairDoProcesso(dados, eu, gravaForaDoCartao(ctx, alvo.criado_por === eu), { responsavel_id: alvo.responsavel_id, lista: alvo.colaboradores });
        await SD.processoAtualizar(alvo.id, gravar);
        // O papel escrito agora (#443) entra na lista do escritório: os próximos cadastros já o oferecem.
        incluirNaListaDoEscritorio(nomesParaALista(escritosAgora, gravar.papeis_escritos ?? {}));
        if (ficou) {
          // A pessoa se tirou do cartão: o resto já foi gravado com ela nele, e a saída vem por último, para valer mesmo que ela perca o acesso.
          await sairDoCartao('processos', alvo.id, 'Processo atualizado. Você saiu dele, e a saída ficou no histórico.');
          saidaLiberada.current = true;
          if (edicao && equipeVeTudo(ctx.escritorio)) edicao.aoTerminar(true); else navegar(caminho);
          return;
        }
        feito('Processo atualizado.', 'atualização do processo', async () => {
          const { valores, naoVoltaram } = camposParaDesfazer(await SD.processoCampos(), alvo.tipo, alvo.campos, gravar.campos ?? {});
          await SD.processoAtualizar(alvo.id, { ...antes, campos: valores });
          if (naoVoltaram.length) avisar(`Não voltou ao valor anterior, porque ele saiu da lista ou o campo foi apagado: ${naoVoltaram.join(', ')}.`, 'erro');
          return { tipo: 'processoAtualizado', id: alvo.id };
        });
        saidaLiberada.current = true;
        if (edicao) edicao.aoTerminar(true); else navegar(caminho + '?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, o processo novo entra na coluna-marco de início. A coluna vinda do quadro só vale para o tipo daquele quadro.
        const coluna = (c.tipo === tipoInicial && etapaInicial) || await colunaInicial(quadro);
        // A origem do recurso ou incidental vai junto (#316): ela não muda depois.
        const r = await SD.processoCriar({ ...dados, ...(lida?.recusa ? {} : origemAoCriar(c)), tipo: c.tipo, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        incluirNaListaDoEscritorio(nomesParaALista(escritosAgora, dados.papeis_escritos ?? {}));
        feito(`Processo ${r.codigo} cadastrado.`, 'cadastro do processo', async () => {
          await SD.processosArquivar([r.id], true);
          const x = await SD.processosExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'processoCriado', id: r.id };
        });
        let ligado = false;
        if (origem && lida && !lida.recusa) {
          // O processo já existe: se a ligação falhar, ele continua, e a pessoa fica sabendo (e vai ao cartão dele, não ao da origem).
          const como = NASCE_DE[origem.tipo];
          try { await como.ligar(r.id, origem.id); ligado = true; }
          catch (e) { avisar(`Não foi possível ligar o processo ${como.aOrigem} ${lida.codigo}. ${e instanceof Error ? e.message : ''}`.trim(), 'erro'); }
        }
        saidaLiberada.current = true;
        // Aberto pelo "+ Novo processo" de um cartão (#376), volta a ele, onde o processo já aparece ligado. Pela marca da volta
        // (cadastroComVolta), o da demanda (que vem antes do cliente) ou o da pessoa; sem ela, o do contrato ou o da tarefa (NASCE_DE).
        // Se o processo não ficou ligado à origem (ligação que falhou, cliente trocado), vai ao cartão dele.
        const pelaMarca = cartaoDeOrigem(params, {
          demanda: id => ligado && origem?.tipo === 'demanda' && origem.id === id,
          cliente: id => c.clientes.includes(id)
        });
        navegar(pelaMarca ?? depoisDeCriar(lida?.cartao ?? null, ligado, caminho + '?id=' + r.id));
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
      // Um campo pode ter sido apagado com o formulário aberto: ele sai da tela, e salvar de novo funciona, sem perder o resto.
      SD.processoCampos().then(setCamposDoEscritorio).catch(() => {});
    }
  }

  // O número e o órgão: no cadastro, na primeira etapa; na seção de dados do cartão (#428), juntos com os detalhes. Na seção, as caixas
  // de marcar dizem só o valor, como a leitura ("Segredo de justiça: Sim", #432): o rótulo da linha já diz o resto.
  const numeroEOrgao = () => <>
      <Campo rotulo="Número do processo" curto={CAMPOS_PROCESSO.numero} para="numero" obrigatorio erro={erros.numero}
        dica={noPadrao ? 'No padrão do CNJ. O sistema confere o número e indica o órgão.' : judicial ? 'Como aparece nos autos.' : 'O número do pedido ou do protocolo no órgão.'}>
        <input type="text" {...propsDoCampo('numero', { dica: true, erro: erros.numero })} inputMode={noPadrao ? 'numeric' : undefined} maxLength={TAMANHO_PROCESSO.numero} value={c.numero}
          onChange={e => mudarNumero({ numero: e.target.value })} />
      </Campo>
      {judicial && <Escolhas rotulo="Formato do número" curto="Número antigo">
        <label><input type="checkbox" checked={c.numeroAntigo} onChange={e => mudarNumero({ numeroAntigo: e.target.checked })} />{soOsDados ? 'De antes do padrão do CNJ' : 'É um número antigo, de antes do padrão do CNJ'}</label>
      </Escolhas>}
      <Campo rotulo="Órgão" para="orgao" erro={erros.orgao} dica="A sigla. Ex.: TJMG, TRF6, INPI, INSS. Aparece acima do nome do cartão.">
        <CampoComSugestoes type="text" {...propsDoCampo('orgao', { dica: true, erro: erros.orgao })} maxLength={TAMANHO_PROCESSO.orgao} valor={c.orgao}
          aoMudar={orgao => mudar({ orgao: orgao.toUpperCase() })} sugestoes={emSugestoes(siglas)} />
      </Campo>
  </>;

  /** Os campos que o escritório criou para o tipo do processo. */
  const extrasDoEscritorio = () => camposDoTipo(camposDoEscritorio, c.tipo).map(campo => <CampoDoEscritorio key={campo.id} campo={campo} valor={c.extras[campo.id] ?? ''}
    erro={errosVisiveisDosExtras[campo.id]} aoMudar={valor => setC(atual => ({ ...atual, extras: { ...atual.extras, [campo.id]: valor } }))} />);

  const CONTEUDO: Record<EtapaProcesso, () => ReactNode> = {
    processo: () => <>
      {/* O recurso ou incidental (#316) e, do administrativo, o judicial (#425): nasce de outro processo, e a pessoa diz como. O
          judicial do administrativo é sempre judicial: o tipo acompanha a escolha. */}
      {!alvo && c.origemId && lida?.tipoDoProcesso && <Escolhas rotulo="Este processo é" obrigatorio erro={erros.ligacao}>
        {ligacoesDaOrigem(lida.tipoDoProcesso).map(l => <label key={l}><input type="radio" name="ligacao" checked={c.ligacao === l}
          onChange={() => { mudar({ ligacao: l }); mudarNumero({ tipo: tipoDoDerivado(l, lida.tipoDoProcesso!) }); }} />{LIGACOES[l].nome}</label>)}
      </Escolhas>}
      {/* O tipo não muda depois de salvo: cada tipo tem o seu quadro. Nem no judicial do administrativo (#425). */}
      {alvo || (c.origemId && c.ligacao && LIGACOES[c.ligacao].tipo) ? <div className="pergunta"><span className="rot">Tipo</span><span>{TIPOS_PROCESSO[c.tipo].nome}</span></div>
        : <Escolhas rotulo="Tipo" obrigatorio>
          {TIPOS.map(t => <label key={t}><input type="radio" name="tipo" checked={c.tipo === t} onChange={() => mudarNumero({ tipo: t })} />{TIPOS_PROCESSO[t].nome}</label>)}
        </Escolhas>}
      {numeroEOrgao()}
      {/* No lápis do cartão, o nome não se repete: o cartão o muda no próprio lugar (#346). */}
      {!edicao && <Campo rotulo="Nome do cartão" para="titulo" erro={erros.titulo} dica="Opcional. Sem ele, o cartão mostra o nome dos clientes.">
        <input type="text" {...propsDoCampo('titulo', { dica: true, erro: erros.titulo })} maxLength={TAMANHO_PROCESSO.titulo} value={c.titulo}
          onChange={e => mudar({ titulo: e.target.value })} />
      </Campo>}
    </>,
    pessoas: () => <>
      <CampoDeVarios rotulo="Clientes" obrigatorio id={GRUPO_DOS_CLIENTES} erro={erros.clientes ?? erros.papeisClientes} grupo={grupoDosClientes}
        dica="Ao lado de cada cliente, o papel dele no processo (obrigatório).">
        {c.clientes.map((id, i) => <div className="linha-cliente com-papel" key={chaves[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={<span className="sr">{c.clientes.length === 1 ? 'Cliente' : `Cliente ${i + 1}`}</span>} escolhida={clientes[i]}
              aoEscolher={escolherCliente(i)} desativar={outroCliente(i)} focar={chaves[i] === focarCliente} />
          </div>
          {/* O papel do cliente (#426): a mesma lista das pessoas com papel; escolhe-se depois da pessoa. Ele aponta para a dica e,
              sem papel, para o erro do grupo: o leitor de tela diz por que está inválido. */}
          <select aria-label={c.clientes.length === 1 ? 'Papel do cliente' : `Papel do cliente ${i + 1}`}
            value={id ? valorDoPapel(c.papeisClientes[id], c.papeisEscritos[id]) : ''} disabled={!id}
            aria-invalid={papelFaltando(id) || undefined} aria-describedby={descricaoDoPapel(id)}
            onChange={e => void escolherPapel(i, id, e.target.value)}>
            <OpcoesDoPapel vazio="Papel do cliente…" fixos={PAPEIS_DO_CLIENTE} lista={papeisDoEscritorio} usados={escritosNoFormulario} />
          </select>
          {c.clientes.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar o cliente ${i + 1}`} onClick={() => tirarCliente(i)}>
            <Icone nome="fechar" tam={15} />
          </button>}
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.clientes.length >= CLIENTES_MAXIMOS} onClick={acrescentarCliente}>
          <Icone nome="mais" tam={13} /> Adicionar cliente
        </button></div>
      </CampoDeVarios>
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pelo processo: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, colaboradores: c.colaboradores.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <EscolhaDaEquipe rotulo="Colaboradores" erro={erros.colaboradores} dica="Quem da equipe também trabalha no processo (e passa a vê-lo)." adicionar="Adicionar colaborador"
        equipe={ctx.equipe} escolhidos={c.colaboradores} fora={c.responsavelId ? [c.responsavelId] : []} aoMudar={colaboradores => mudar({ colaboradores })} />
      <GruposNoLapis ids={alvo?.grupos} />
    </>,
    detalhes: () => <>
      {listaDe('sistema')}
      <Campo rotulo="Meio de tramitação" para="meio">
        <select {...propsDoCampo('meio')} value={c.meio} onChange={e => mudar({ meio: e.target.value as CamposProcesso['meio'] })}>
          <option value="">{NAO_INFORMADO}</option>
          {Object.entries(MEIOS).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
        </select>
      </Campo>
      {listaDe('area')}
      {/* Na área Propriedade intelectual (#317): o tipo de proteção e os campos dele. */}
      <CamposDaProtecao c={c} erros={erros} mudar={mudar} />
      {judicial && <>
        {listaDe('natureza')}
        <Campo rotulo="Gratuidade de justiça" para="gratuidade">
          <select {...propsDoCampo('gratuidade')} value={c.gratuidade} onChange={e => mudar({ gratuidade: e.target.value as CamposProcesso['gratuidade'] })}>
            <option value="">{NAO_INFORMADO}</option>
            {Object.entries(GRATUIDADES).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Comarca" para="comarca" erro={erros.comarca}>
          <CampoComSugestoes type="text" {...propsDoCampo('comarca', { erro: erros.comarca })} maxLength={TAMANHO_PROCESSO.comarca} valor={c.comarca}
            aoMudar={comarca => mudar({ comarca })} sugestoes={emSugestoes(sugestoes.comarcas)} />
        </Campo>
        <Campo rotulo="Vara" para="vara" erro={erros.vara}>
          <CampoComSugestoes type="text" {...propsDoCampo('vara', { erro: erros.vara })} maxLength={TAMANHO_PROCESSO.vara} valor={c.vara}
            aoMudar={vara => mudar({ vara })} sugestoes={emSugestoes(sugestoes.varas)} />
        </Campo>
        <Campo rotulo="Classe" para="classe" erro={erros.classe}>
          <input type="text" {...propsDoCampo('classe', { erro: erros.classe })} maxLength={TAMANHO_PROCESSO.classe} value={c.classe} onChange={e => mudar({ classe: e.target.value })} />
        </Campo>
        <Campo rotulo="Assunto" para="assunto" erro={erros.assunto}>
          <input type="text" {...propsDoCampo('assunto', { erro: erros.assunto })} maxLength={TAMANHO_PROCESSO.assunto} value={c.assunto} onChange={e => mudar({ assunto: e.target.value })} />
        </Campo>
        <Campo rotulo="Juiz ou relator" para="juiz" erro={erros.juiz}>
          <input type="text" {...propsDoCampo('juiz', { erro: erros.juiz })} maxLength={TAMANHO_PROCESSO.juiz} value={c.juiz} onChange={e => mudar({ juiz: e.target.value })} />
        </Campo>
        <Campo rotulo="Data da distribuição" curto={CAMPOS_PROCESSO.distribuicao} para="distribuicao" erro={erros.distribuicao}>
          <CampoData {...propsDoCampo('distribuicao', { erro: erros.distribuicao })} valor={c.distribuicao} aoMudar={distribuicao => mudar({ distribuicao })} />
        </Campo>
        <Campo rotulo="Valor da causa" para="valorCausa" erro={erros.valorCausa}>
          <input type="text" {...propsDoCampo('valorCausa', { erro: erros.valorCausa })} inputMode="decimal" placeholder="0,00" value={c.valorCausa}
            onChange={e => mudar({ valorCausa: e.target.value })} />
        </Campo>
        <Campo rotulo="Instância" para="instancia" erro={erros.instancia}>
          <input type="text" {...propsDoCampo('instancia', { erro: erros.instancia })} maxLength={TAMANHO_PROCESSO.instancia} value={c.instancia} onChange={e => mudar({ instancia: e.target.value })} />
        </Campo>
        <Escolhas rotulo="Segredo de justiça">
          <label><input type="checkbox" checked={c.segredo} onChange={e => mudar({ segredo: e.target.checked })} />{soOsDados ? 'Sim' : 'Este processo corre em segredo de justiça'}</label>
        </Escolhas>
        <Campo rotulo="Advogado da parte contrária" curto={CAMPOS_PROCESSO.advogado_contrario} para="advogadoContrario" erro={erros.advogadoContrario}>
          <input type="text" {...propsDoCampo('advogadoContrario', { erro: erros.advogadoContrario })} maxLength={TAMANHO_PROCESSO.advogadoContrario} value={c.advogadoContrario}
            onChange={e => mudar({ advogadoContrario: e.target.value })} />
        </Campo>
      </>}
      {!soOsDados && extrasDoEscritorio()}
      <Campo rotulo="Observações" para="observacoes" erro={erros.observacoes}>
        <textarea {...propsDoCampo('observacoes', { erro: erros.observacoes })} maxLength={TAMANHO_PROCESSO.observacoes} value={c.observacoes}
          onChange={e => mudar({ observacoes: e.target.value })} />
      </Campo>
      {/* Na seção de dados (#432), os campos do escritório vêm depois das observações, na ordem da leitura (linhasDosCampos). */}
      {soOsDados && extrasDoEscritorio()}
    </>
  };

  // Na seção "Dados do processo" do cartão (#428): os dados que ela mostra, inclusive os vazios, com Cancelar e Salvar no pé.
  if (edicao && soOsDados) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <FormularioDosDados rotulo="Editar os dados do processo" estado={c} ocupado={ocupado} aoMudarSujo={edicao.aoMudarSujo}
      aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()}>
      {numeroEOrgao()}
      {CONTEUDO.detalhes()}
    </FormularioDosDados>;

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar processo" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {ETAPAS_PROCESSO.map(e => <SecaoDoFormulario key={e.id} titulo={e.titulo} nivel={3}>
        {CONTEUDO[e.id]()}
      </SecaoDoFormulario>)}
      <RodapeDaEdicao estado={{ c, clientes }} ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = TIPOS_PROCESSO[c.tipo].caminho + (idAtualizar ? '?id=' + idAtualizar : '');
  const total = ETAPAS_PROCESSO.length;
  return <div className="passos">
    <AvisoAoSair estado={{ c, clientes }} liberada={saidaLiberada} ocupado={ocupado} />
    <header>
      <p className="olho"><Link to={voltar}>Processos</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar processo' : 'Novo processo'}<span className="ponto">.</span></h1>
    </header>
    {lida && origem && (lida.recusa
      ? <Aviso tipo="erro">{AVISO_DA_RECUSA[lida.recusa](NASCE_DE[origem.tipo].fala, lida.codigo)}</Aviso>
      : <Aviso tipo="info">{lida.aviso}</Aviso>)}
    {alvo && <Aviso tipo="info">Você está atualizando o processo <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
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
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar processo') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
