// Cadastro de compromisso (novo ou atualizar), por etapas como os de pessoa, demanda e processo: o compromisso (tipo, data e
// hora), onde e de qual processo, as pessoas e os detalhes. Vindo do cartão de uma pessoa (?pessoa=) ou de um processo
// (?processo=, que já começa como audiência), ele já vem escolhido. Ao escolher o processo, os clientes dele entram no
// compromisso, se ainda não houver pessoas. A data e a hora são as do relógio de Brasília. Vindo do "+ Novo…" de uma anotação
// (?anotacao=, #376), ele nasce ligado a ela (com a pessoa única da anotação, por ?pessoa=) e, ao salvar, volta à anotação. Vindo do
// "+ Novo compromisso" de uma tarefa, demanda ou contrato (?tarefa=, ?demanda=, ?contrato=, #306), ele começa com as pessoas do item,
// nasce ligado a ele e, ao salvar, volta ao cartão dele. A sala do escritório (#308), se escolhida, é conferida antes de seguir da etapa
// "Onde" e antes de salvar: ocupada no horário, o cadastro diz com qual compromisso e não salva (o banco também recusa). Vindo do
// "Acompanhar na agenda" do processo de propriedade intelectual (?processo=…&acompanhar=protecao, #317), ele já vem com os prazos do
// INPI: o título, a primeira data, a repetição e a demanda de cada data.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { SD, type Compromisso, type DadosCompromisso, type PessoaLista, type PessoaResumida, type ProcessoParaLigar, type TipoCompromisso } from '../dados';
import { CLIENTES_MAXIMOS, DEMANDA_DO_COMPROMISSO, REPETICAO, TAMANHO_COMPROMISSO } from '../dados/limites';
import { avisoDasDemandasNascidas, diasAntesDosCampos } from '../regras/demandaDoCompromisso';
import { avisoDaRepeticao, FINS_DA_REPETICAO, FREQUENCIAS, FREQUENCIAS_DA_REPETICAO, type FimDaRepeticao } from '../regras/repeticao';
import {
  camposDoCompromisso, compromissoVazio, continuaPeloProcesso, dadosDoCompromisso, repeticaoDoCompromisso, errosDaEtapaCompromisso, ETAPAS_COMPROMISSO, MODALIDADES, primeiraEtapaComErroCompromisso,
  semSairDoCompromisso, TIPOS, TIPOS_COMPROMISSO, tituloNoLapis, validarCompromisso, type CamposCompromisso, type EtapaCompromisso
} from '../regras/compromisso';
import { semOsCamposDoLugar } from '../regras/edicaoNoLugar';
import { datasForaDoLapisDoCompromisso, semOsCampos } from '../regras/datasNoCartao';
import { errosJuntos } from '../regras/campoData';
import { voltaDoMenu } from '../regras/origemDoCadastro';
import { clientesPorExtenso } from '../regras/contrato';
import { fmtCNJ, partesDoCNJ } from '../regras/numeroCNJ';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { falha, feito } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { Aviso, Campo, CampoData, CampoDataHora, CampoDeVarios, Carregando, Escolhas, estiloBotao, propsDoCampo, SecaoDoFormulario, useFocoNoGrupo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { EscolhaDaEquipe } from '../ui/EscolhaDaEquipe';
import { GruposNoLapis } from '../ui/GruposDoItem';
import { Icone } from '../ui/Icone';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { ordemNoFim } from '../ui/quadro/posicao';
import { useCtx } from '../ui/sessao';
import { hojeISO, subirAoCadastro, useAtrasado, useTitulo } from '../ui/util';
import { camposParaAcompanhar, ehAcompanhamento, PARAMETRO_ACOMPANHAR } from '../regras/propriedadeIntelectual';
import { anotacaoNoEndereco, AvisoDaAnotacaoDeOrigem, depoisDeCriarNaAnotacao, useAnotacaoDeOrigem } from './nascerNaAnotacao';
import { depoisDeCriarNoItem, useOrigemDoCompromisso } from './agenda/origemDoCompromisso';
import { useSalas } from './agenda/useSalas';
import { avisoDoConflito, conflitoNaSala, nomeDaSala, salasParaEscolher } from '../regras/sala';
import { lerData } from '../regras/pessoa';
import { origemDoCompromissoNoEndereco } from '../regras/nascerLigado';
import './Contratos.css';
import './Demandas.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** Os campos da etapa que está na tela (o Enter passa de um para o outro). */
const CAMPOS_DA_ETAPA = '.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select';
const ENDERECO = '/agenda/';
/** O endereço deste cadastro (o do "+" do menu lateral). */
const CADASTRO = '/agenda/novo/';
/** Como o processo aparece na busca e no campo: número, nome e clientes. */
const rotuloDoProcesso = (p: Pick<ProcessoParaLigar, 'numero' | 'titulo' | 'cliente_nome'>) =>
  [p.numero, p.titulo, p.cliente_nome && clientesPorExtenso(p.cliente_nome)].filter(Boolean).join(' · ');

/** O lápis do cartão do compromisso: além do de todo cartão, o título gravado agora, que o cartão muda no próprio lugar (#346). */
export interface EdicaoDoCompromisso extends EdicaoNoCartao { titulo: string | null }

export default function NovoCompromisso({ edicao }: { edicao?: EdicaoDoCompromisso } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  // Aberto pelo "+" do menu lateral (#404): a tela onde a pessoa estava, para voltar a ela depois de gravar.
  const volta = voltaDoMenu(useLocation().state, CADASTRO);
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa'), pessoaInicial = params.get('pessoa'), processoInicial = params.get('processo');
  // Vindo do "Acompanhar na agenda" do processo de propriedade intelectual (#317, parte C): os prazos do INPI preenchem o compromisso que se
  // repete; ou, vindo do "Pôr o prazo extra na agenda", o compromisso do prazo que está no prazo extra.
  const qualAcompanhar = params.get(PARAMETRO_ACOMPANHAR);
  const acompanharProtecao = !idAtualizar && !!processoInicial && ehAcompanhamento(qualAcompanhar);
  const tipoInicial: TipoCompromisso = acompanharProtecao ? 'outro' : processoInicial ? 'audiencia' : 'reuniao';
  // A anotação de onde o compromisso nasce (o "+ Novo…" da seção "Ligada a"): ela fica ligada ao compromisso novo.
  const daAnotacao = useAnotacaoDeOrigem(anotacaoNoEndereco(params, !!idAtualizar), 'compromisso');
  // A tarefa, a demanda ou o contrato de onde o compromisso nasce (#306): ele fica ligado ao compromisso novo.
  const doItem = useOrigemDoCompromisso(origemDoCompromissoNoEndereco(params, !!idAtualizar));

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposCompromisso>(() => ({ ...compromissoVazio(tipoInicial), responsavelId: ctx.perfil.id }));
  const [alvo, setAlvo] = useState<Compromisso | null>(null);   // compromisso sendo atualizado
  const [pronto, setPronto] = useState(!idAtualizar);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaCompromisso>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // As salas do escritório e o aviso de quando a escolhida está ocupada no horário (#308).
  const salas = useSalas();
  const [erroSala, setErroSala] = useState('');
  // Enquanto confere a sala, o Próxima espera (dois cliques não pulam a etapa).
  const [conferindo, setConferindo] = useState(false);
  // A pessoa escolhida em cada linha (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [pessoas, setPessoas] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const { grupo: grupoDasPessoas, focarNoGrupo: focarNasPessoas } = useFocoNoGrupo();
  const [focarPessoa, setFocarPessoa] = useState<number | null>(null);
  // Os processos que combinam com o texto digitado na busca (a busca é no banco) e o nome do escolhido.
  const [processos, setProcessos] = useState<ProcessoParaLigar[]>([]);
  const [buscaProcesso, setBuscaProcesso] = useState('');
  const buscaAtrasada = useAtrasado(buscaProcesso);
  const [rotuloProcesso, setRotuloProcesso] = useState('');
  useTitulo(edicao ? null : alvo ? 'Atualizar compromisso' : 'Novo compromisso');
  // Com o lápis aberto, o título ainda muda no próprio lugar do cartão: o formulário acompanha o que ficou gravado, para decidir
  // se pede um título (tituloNoLapis), validar e desfazer com o título de agora, e não com o de quando o lápis abriu.
  const [tituloVisto, setTituloVisto] = useState(edicao?.titulo);
  if (edicao && edicao.titulo !== tituloVisto) {
    setTituloVisto(edicao.titulo);
    setC(x => ({ ...x, titulo: edicao.titulo ?? '' }));
  }

  // Mudou o compromisso (a sala, a data, a hora…): o aviso da sala ocupada sai, e a conferência é feita de novo ao seguir ou salvar.
  const mudar = (campos: Partial<CamposCompromisso>) => { setC(atual => ({ ...atual, ...campos })); setErroSala(''); };
  // As pessoas de uma vez (ao abrir um compromisso salvo, ou ao escolher um processo com clientes).
  const porPessoas = useCallback((lista: PessoaResumida[]) => {
    setPessoas(lista.length ? lista : [null]);
    setChaves(lista.length ? lista.map((_, i) => i) : [0]);
    proximaChave.current = lista.length + 1;
  }, []);
  // Ao ligar um processo: os clientes dele entram no compromisso, se ele ainda não tem pessoas.
  const camposAgora = useRef(c);
  useEffect(() => { camposAgora.current = c; }, [c]);
  const ligarProcesso = useCallback(async (id: string) => {
    setC(atual => ({ ...atual, processoId: id }));
    const p = await SD.processoObter(id).catch(() => null);
    if (p) setRotuloProcesso(rotuloDoProcesso({ ...p, cliente_nome: p.clientes.map(x => x.nome).join('; ') }));
    if (!p?.clientes.length || camposAgora.current.pessoas.some(Boolean)) return;
    porPessoas(p.clientes);
    setC(atual => ({ ...atual, pessoas: p.clientes.map(x => x.id) }));
  }, [porPessoas]);

  useEffect(() => {
    let vale = true;
    SD.processosParaLigar(buscaAtrasada).then(r => { if (vale) setProcessos(r); }).catch(() => {});
    return () => { vale = false; };
  }, [buscaAtrasada]);
  useEffect(() => {
    if (idAtualizar) {
      SD.compromissoObter(idAtualizar)
        .then(x => {
          if (!x) throw new Error('Compromisso não encontrado.');
          setAlvo(x);
          setC(camposDoCompromisso(x));
          setRotuloProcesso(x.processo ? rotuloDoProcesso(x.processo) : x.processo_numero ?? '');
          porPessoas(x.pessoas);
        })
        .catch(falha)
        .finally(() => setPronto(true));
      return;
    }
    if (pessoaInicial) SD.pessoaObter(pessoaInicial).then(p => { if (p) { setPessoas([p]); setC(x => ({ ...x, pessoas: [p.id] })); } }).catch(falha);
    if (processoInicial) void ligarProcesso(processoInicial);
  }, [idAtualizar, pessoaInicial, processoInicial, porPessoas, ligarProcesso]);
  // Os prazos do INPI do processo (#317, parte C) preenchem o título, a primeira data, a repetição e a demanda de cada data (ou o prazo extra).
  useEffect(() => {
    if (!acompanharProtecao || !processoInicial) return;
    let vale = true;
    SD.processoObter(processoInicial).then(p => {
      const campos = p && camposParaAcompanhar(qualAcompanhar, p, hojeISO());
      if (vale && campos) setC(atual => ({ ...atual, ...campos }));
    }).catch(falha);
    return () => { vale = false; };
  }, [acompanharProtecao, qualAcompanhar, processoInicial]);
  // As pessoas da origem entram no compromisso, se ele ainda não tem nenhuma.
  useEffect(() => {
    if (!doItem?.pessoas.length || camposAgora.current.pessoas.some(Boolean)) return;
    porPessoas(doItem.pessoas);
    setC(atual => ({ ...atual, pessoas: doItem.pessoas.map(p => p.id) }));
  }, [doItem, porPessoas]);
  // A cada etapa, o foco vai para o primeiro campo dela.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>(CAMPOS_DA_ETAPA)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  const etapa = ETAPAS_COMPROMISSO[passo];
  const ultimo = passo === ETAPAS_COMPROMISSO.length - 1;
  const conferidos = new Set(ETAPAS_COMPROMISSO.filter(e => conferidas.has(e.id)).flatMap(e => e.campos));
  const erros: Partial<Record<keyof CamposCompromisso, string>> = Object.fromEntries(Object.entries(validarCompromisso(c)).filter(([campo]) => conferidos.has(campo as keyof CamposCompromisso)));
  const doProcesso = TIPOS_COMPROMISSO[c.tipo].doProcesso, exigeHora = TIPOS_COMPROMISSO[c.tipo].exigeHora;
  // A repetição (#307) só no cadastro de um compromisso novo, e só nos tipos que se repetem (audiência e perícia, não).
  const repeteAqui = !idAtualizar && !edicao && TIPOS_COMPROMISSO[c.tipo].repete;
  // A demanda de cada data (#307, parte B), só com o módulo Demandas ligado no escritório.
  const geraDemanda = !!ctx.escritorio?.modulos?.demandas;

  // ---------- etapas ----------
  function irPara(i: number) {
    setPasso(i);
    subirAoCadastro();
  }
  const focarErro = () => requestAnimationFrame(() =>
    document.querySelector('.etapa.ativa .pergunta.erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  async function avancar() {
    if (edicao) { void salvar(); return; }
    setConferidas(x => new Set(x).add(etapa.id));
    if (Object.keys(errosDaEtapaCompromisso(etapa.id, c)).length) { focarErro(); return; }
    if (etapa.id === 'onde') {
      if (conferindo) return;
      setConferindo(true);
      const livre = await salaLivre().finally(() => setConferindo(false));
      if (!livre) { focarErro(); return; }
    }
    if (ultimo) void salvar(); else irPara(passo + 1);
  }
  /**
   * A sala escolhida está livre no horário? Lê quem a ocupa no dia (fora este compromisso, ao mudar um) e, ocupada, mostra com qual
   * compromisso (a regra fica em regras/sala.ts). Sem sala, com a data ainda inválida ou sem conseguir ler, segue: o banco confere de novo.
   */
  async function salaLivre() {
    const sala = salas.find(s => s.id === c.salaId);
    if (!sala) return true;
    let data: string | null;
    try { data = lerData(c.data); } catch { return true; }
    if (!data) return true;
    const ocupacoes = await SD.salaOcupacao(sala.id, data, alvo?.id ?? null).catch(() => []);
    const conflito = conflitoNaSala({ hora: c.hora, horaFim: c.horaFim }, ocupacoes);
    setErroSala(conflito ? avisoDoConflito(sala.nome, conflito) : '');
    return !conflito;
  }
  // Enter: vai para o próximo campo da etapa ou para a próxima etapa. A busca de pessoa trata o Enter dela.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...document.querySelectorAll<HTMLElement>(CAMPOS_DA_ETAPA)].filter(x => x.offsetParent !== null && !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else void avancar();
  }

  // ---------- pessoas ----------
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
  const outraPessoa = (i: number) => (p: PessoaLista) => c.pessoas.some((x, j) => j !== i && x === p.id) ? 'já está ligada' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);

  // ---------- processo ----------
  function digitarProcesso(texto: string) {
    const p = processos.find(x => rotuloDoProcesso(x) === texto);
    // O número colado só com os algarismos fica pontuado, para combinar com o que a lista mostra.
    if (p) { setRotuloProcesso(texto); void ligarProcesso(p.id); setBuscaProcesso(''); } else setBuscaProcesso(partesDoCNJ(texto) ? fmtCNJ(texto) : texto);
  }

  // ---------- envio ----------
  /**
   * No lápis do cartão, o título fica de fora: o cartão já o muda no próprio lugar (#346). Só volta quando o tipo escolhido
   * exige um título e o compromisso não tem nenhum (veja tituloNoLapis). A data e o horário também ficam de fora (#361), a não ser
   * a hora, quando o tipo escolhido a exige e o compromisso não tem (veja horaNoLapis).
   */
  const comTitulo = !edicao || !alvo || tituloNoLapis(c.tipo, edicao.titulo);
  const datasFora = edicao && alvo ? datasForaDoLapisDoCompromisso(c.tipo, alvo.hora) : null;
  const noLapis = (d: DadosCompromisso): DadosCompromisso => {
    const semTitulo = comTitulo ? d : semOsCamposDoLugar(d);
    return datasFora ? semOsCampos(semTitulo, datasFora.dados) : semTitulo;
  };
  /** O lápis mostra este campo da data e do horário? */
  const mostra = (campo: string) => !datasFora?.campos.includes(campo);
  async function salvar() {
    if (ocupado) return;   // o Enter não respeita o botão desligado
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErroCompromisso(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_COMPROMISSO.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados = noLapis(dadosDoCompromisso(c));
    setOcupado(true);
    try {
      // A sala ocupada no horário não deixa salvar: volta à etapa dela, com o aviso.
      if (!await salaLivre()) {
        if (!edicao) irPara(ETAPAS_COMPROMISSO.findIndex(e => e.id === 'onde'));
        focarErro();
        setOcupado(false);
        return;
      }
      if (alvo) {
        // Para desfazer: o compromisso como estava, no mesmo formato que o cadastro grava.
        const antes = noLapis(dadosDoCompromisso(camposDoCompromisso(edicao ? { ...alvo, titulo: edicao.titulo } : alvo)));
        const eu = ctx.perfil.id, peloLigado = continuaPeloProcesso(alvo, dados.processo_id), podeSair = gravaForaDoCartao(ctx, alvo.criado_por === eu, peloLigado);
        const { dados: gravar, ficou } = semSairDoCompromisso(dados, eu, podeSair, { responsavel_id: alvo.responsavel_id, lista: alvo.participantes }, peloLigado);
        await SD.compromissoAtualizar(alvo.id, gravar);
        if (ficou) {
          // A pessoa se tirou do cartão: o resto já foi gravado com ela nele, e a saída vem por último, para valer mesmo que ela perca o acesso.
          await sairDoCartao('compromissos', alvo.id, 'Compromisso atualizado. Você saiu dele, e a saída ficou no histórico.');
          saidaLiberada.current = true;
          navegar(ENDERECO);   // fora do compromisso, o cartão diria "não encontrado"
          return;
        }
        feito('Compromisso atualizado.', 'atualização do compromisso', async () => {
          await SD.compromissoAtualizar(alvo.id, antes);
          return { tipo: 'compromissoAtualizado', id: alvo.id };
        });
        saidaLiberada.current = true;
        if (edicao) edicao.aoTerminar(true); else navegar(ENDERECO + '?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, o compromisso novo entra na coluna-marco de início.
        const coluna = etapaInicial || await colunaInicial('compromissos');
        const r = await SD.compromissoCriar({ ...dadosDoCompromisso(c), etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        const doCriado = volta ?? ENDERECO + '?id=' + r.id;
        // Vindo de uma tarefa, demanda ou contrato, a ligação vem antes de repetir: as datas seguintes, e a demanda de cada uma (#307), a levam junto.
        const destinoDoItem = daAnotacao ? null : await depoisDeCriarNoItem(doItem, r.id, doCriado);
        // Que se repete (#307): as datas seguintes viram compromissos. Se não der, o compromisso fica cadastrado sem repetir, e a pessoa sabe.
        const regra = repeteAqui ? repeticaoDoCompromisso(c) : null;
        const repetidos = regra && await SD.compromissoRepetir(r.id, regra).catch(e => {
          falha(new Error(`O compromisso ${r.codigo} foi cadastrado, mas não foi possível repeti-lo: ${(e as Error).message}`));
          return null;
        });
        // E gera a demanda de cada data, tantos dias antes: as das datas que já estão no prazo nascem agora; as outras, na rotina diária.
        const dias = repetidos && geraDemanda ? diasAntesDosCampos(c) : null;
        const nascidas = dias ? await SD.compromissoGerarDemandas(r.id, dias).catch(e => {
          falha(new Error(`O compromisso ${r.codigo} se repete, mas não foi possível marcá-lo para gerar demanda: ${(e as Error).message}`));
          return null;
        }) : null;
        const todos = [r.id, ...repetidos?.ids ?? []];
        feito(repetidos ? avisoDaRepeticao(r.codigo, repetidos) + avisoDasDemandasNascidas(nascidas?.length ?? 0) : `Compromisso ${r.codigo} cadastrado.`, 'cadastro do compromisso', async () => {
          if (nascidas?.length) { await SD.demandasArquivar(nascidas, true); await SD.demandasExcluir(nascidas); }
          await SD.compromissosArquivar(todos, true);
          const x = await SD.compromissosExcluir(todos);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'compromissoCriado', id: r.id };
        });
        saidaLiberada.current = true;
        // Vindo de uma anotação (ou de uma tarefa, demanda ou contrato), liga o compromisso a ela e volta ao cartão dela, no lugar do cadastro.
        // Vindo do "+" do menu lateral (#404), volta à tela onde a pessoa estava (o aviso no pé da tela diz que foi cadastrado); senão, abre
        // o cartão do compromisso novo na Agenda.
        navegar(daAnotacao ? await depoisDeCriarNaAnotacao(daAnotacao, 'compromisso', r.id, doCriado) : destinoDoItem ?? doCriado,
          { replace: !!daAnotacao || !!doItem || !!volta });
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  const CONTEUDO: Record<EtapaCompromisso, () => ReactNode> = {
    compromisso: () => <>
      <Escolhas rotulo="Tipo" obrigatorio>
        {TIPOS.map(t => <label key={t}><input type="radio" name="tipo" checked={c.tipo === t} onChange={() => mudar({ tipo: t })} />{TIPOS_COMPROMISSO[t].nome}</label>)}
      </Escolhas>
      {comTitulo && <Campo rotulo="Título" para="titulo" obrigatorio={!doProcesso} erro={erros.titulo} dica={doProcesso ? 'Opcional. Sem ele, o cartão mostra o tipo e as pessoas.' : undefined}>
        <input type="text" {...propsDoCampo('titulo', { dica: doProcesso, erro: erros.titulo })} maxLength={TAMANHO_COMPROMISSO.titulo} value={c.titulo} onChange={e => mudar({ titulo: e.target.value })} />
      </Campo>}
      {/* A data e a hora num campo só (#299). No lápis que só pede a hora (a data o cartão muda no lugar), a hora fica sozinha. */}
      {mostra('data') && <Campo rotulo="Data" para="data" obrigatorio erro={errosJuntos(erros.data, erros.hora)}
        dica={exigeHora ? 'Com a hora, no horário de Brasília.' : 'A hora é opcional, no horário de Brasília. Sem ela, vale o dia inteiro.'}>
        <CampoDataHora {...propsDoCampo('data', { dica: true, erro: errosJuntos(erros.data, erros.hora) })} aria-invalid={erros.data ? true : undefined} valor={c.data}
          aoMudar={data => mudar({ data })} hora={c.hora} aoMudarHora={hora => mudar({ hora })} horaObrigatoria={exigeHora} horaComErro={!!erros.hora} />
      </Campo>}
      {!mostra('data') && mostra('hora') && <Campo rotulo="Hora" para="hora" obrigatorio={exigeHora} erro={erros.hora} dica={exigeHora ? 'No horário de Brasília.' : 'No horário de Brasília. Sem hora, vale o dia inteiro.'}>
        <input type="time" {...propsDoCampo('hora', { dica: true, erro: erros.hora })} value={c.hora} onChange={e => mudar({ hora: e.target.value })} />
      </Campo>}
      {mostra('horaFim') && <Campo rotulo="Até" para="horaFim" erro={erros.horaFim} dica="Opcional. A hora em que deve terminar.">
        <input type="time" {...propsDoCampo('horaFim', { dica: true, erro: erros.horaFim })} value={c.horaFim} onChange={e => mudar({ horaFim: e.target.value })} />
      </Campo>}
      {repeteAqui && <Campo rotulo="Repetir" para="repetir" dica="Cada data vira um compromisso na agenda. Audiência e perícia não se repetem.">
        <select {...propsDoCampo('repetir', { dica: true })} value={c.repetir} onChange={e => mudar({ repetir: e.target.value as CamposCompromisso['repetir'] })}>
          <option value="">Não se repete</option>
          {FREQUENCIAS_DA_REPETICAO.map(f => <option key={f} value={f}>{FREQUENCIAS[f].nome}</option>)}
        </select>
      </Campo>}
      {repeteAqui && c.repetir && <>
        <Campo rotulo={`A cada (${FREQUENCIAS[c.repetir].unidade[1]})`} para="aCada" obrigatorio erro={erros.aCada} dica="1 é toda vez. A renovação de uma marca, por exemplo, é a cada 10 anos.">
          <input type="number" inputMode="numeric" min={1} max={REPETICAO.intervaloMaximo} {...propsDoCampo('aCada', { dica: true, erro: erros.aCada })} value={c.aCada}
            onChange={e => mudar({ aCada: e.target.value })} />
        </Campo>
        <Escolhas rotulo="Termina" obrigatorio>
          {(Object.keys(FINS_DA_REPETICAO) as FimDaRepeticao[]).map(fim => <label key={fim}>
            <input type="radio" name="termina" checked={c.termina === fim} onChange={() => mudar({ termina: fim })} />{FINS_DA_REPETICAO[fim]}
          </label>)}
        </Escolhas>
        {c.termina === 'data' && <Campo rotulo="Repetir até" para="repetirAte" obrigatorio erro={erros.repetirAte}>
          <CampoData {...propsDoCampo('repetirAte', { erro: erros.repetirAte })} valor={c.repetirAte} aoMudar={repetirAte => mudar({ repetirAte })} />
        </Campo>}
        {c.termina === 'vezes' && <Campo rotulo="Quantas vezes" para="repetirVezes" obrigatorio erro={erros.repetirVezes} dica="Contando a primeira.">
          <input type="number" inputMode="numeric" min={2} max={REPETICAO.vezesMaximas} {...propsDoCampo('repetirVezes', { dica: true, erro: erros.repetirVezes })}
            value={c.repetirVezes} onChange={e => mudar({ repetirVezes: e.target.value })} />
        </Campo>}
        {geraDemanda && <Campo rotulo="Gerar demanda (dias antes)" para="demandaDiasAntes" erro={erros.demandaDiasAntes}
          dica="Opcional. A demanda de cada data nasce esses dias corridos antes (no dia útil anterior, se cair em fim de semana ou feriado), com o mesmo contrato e as mesmas pessoas. O responsável é avisado em Mensagens.">
          <input type="number" inputMode="numeric" min={1} max={DEMANDA_DO_COMPROMISSO.diasMaximos} {...propsDoCampo('demandaDiasAntes', { dica: true, erro: erros.demandaDiasAntes })}
            value={c.demandaDiasAntes} onChange={e => mudar({ demandaDiasAntes: e.target.value })} />
        </Campo>}
      </>}
    </>,
    onde: () => <>
      {c.processoId
        ? <div className="pergunta">
          <span className="rot">Processo</span>
          <div className="demanda-contrato-escolhido">
            <span>{rotuloProcesso || 'Processo ligado'}</span>
            <button type="button" className={estiloBotao({ forma: 'mini' })} onClick={() => mudar({ processoId: '' })}>Tirar o processo</button>
          </div>
        </div>
        : <Campo rotulo="Processo" para="processo" obrigatorio={doProcesso} erro={erros.processoId} dica="Busque pelo número, pelo nome ou pelo cliente.">
          <CampoComSugestoes id="processo" aria-describedby="processo-dica" placeholder="Buscar processo…" valor={buscaProcesso} aoMudar={digitarProcesso}
            sugestoes={processos.map(p => ({ valor: rotuloDoProcesso(p) }))} />
        </Campo>}
      {(salas.length > 0 || !!c.salaId) && <Campo rotulo="Sala" para="salaId" erro={erroSala || undefined} dica="Uma sala do escritório. Se ela estiver ocupada no horário, o SEMPER avisa e não salva.">
        <select {...propsDoCampo('salaId', { dica: true, erro: erroSala || undefined })} value={c.salaId} onChange={e => mudar({ salaId: e.target.value })}>
          <option value="">Nenhuma sala</option>
          {salasParaEscolher(salas, alvo?.sala_id).map(s => <option key={s.id} value={s.id}>{nomeDaSala(s)}</option>)}
        </select>
      </Campo>}
      <Escolhas rotulo="Modalidade" obrigatorio={doProcesso} erro={erros.modalidade}>
        {Object.entries(MODALIDADES).map(([v, nome]) => <label key={v}><input type="radio" name="modalidade" checked={c.modalidade === v} onChange={() => mudar({ modalidade: v as CamposCompromisso['modalidade'] })} />{nome}</label>)}
      </Escolhas>
      <Campo rotulo="Local" para="local" erro={erros.local} dica="O endereço, a sala ou o link da sala virtual.">
        <input type="text" {...propsDoCampo('local', { dica: true, erro: erros.local })} maxLength={TAMANHO_COMPROMISSO.local} value={c.local} onChange={e => mudar({ local: e.target.value })} />
      </Campo>
    </>,
    pessoas: () => <>
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
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pelo compromisso: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, participantes: c.participantes.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <EscolhaDaEquipe rotulo="Participantes" erro={erros.participantes} dica="Quem da equipe também vai (e passa a ver o compromisso)." adicionar="Adicionar participante"
        equipe={ctx.equipe} escolhidos={c.participantes} fora={c.responsavelId ? [c.responsavelId] : []} aoMudar={participantes => mudar({ participantes })} />
      <GruposNoLapis ids={alvo?.grupos} />
      <Escolhas rotulo="Agenda geral" dica="Todos do escritório veem. Mudar, só quem participa.">
        <label><input type="checkbox" checked={c.geral} onChange={e => mudar({ geral: e.target.checked })} />Mostrar na Agenda geral</label>
      </Escolhas>
    </>,
    detalhes: () => <>
      {doProcesso && <Campo rotulo="Resultado" para="resultado" erro={erros.resultado} dica="O que aconteceu. Dá para preencher depois do compromisso.">
        <textarea {...propsDoCampo('resultado', { dica: true, erro: erros.resultado })} maxLength={TAMANHO_COMPROMISSO.resultado} value={c.resultado} onChange={e => mudar({ resultado: e.target.value })} />
      </Campo>}
      <Campo rotulo="Observações" para="observacoes" erro={erros.observacoes}>
        <textarea {...propsDoCampo('observacoes', { erro: erros.observacoes })} maxLength={TAMANHO_COMPROMISSO.observacoes} value={c.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
      </Campo>
    </>
  };

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar compromisso" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {ETAPAS_COMPROMISSO.map(e => <SecaoDoFormulario key={e.id} titulo={e.titulo} nivel={3}>
        {CONTEUDO[e.id]()}
      </SecaoDoFormulario>)}
      <RodapeDaEdicao estado={{ c, pessoas }} ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = ENDERECO + (idAtualizar ? '?id=' + idAtualizar : '');
  const total = ETAPAS_COMPROMISSO.length;
  return <div className="passos">
    <AvisoAoSair estado={{ c, pessoas }} liberada={saidaLiberada} ocupado={ocupado} />
    <header>
      <p className="olho"><Link to={voltar}>Agenda</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar compromisso' : 'Novo compromisso'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando o compromisso <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
    <AvisoDaAnotacaoDeOrigem origem={daAnotacao} />
    <AvisoDaAnotacaoDeOrigem origem={doItem?.origem ?? null} />
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
          <button type="button" className={estiloBotao({ variante: 'principal' })} disabled={ocupado || conferindo} onClick={() => void avancar()}>
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar compromisso') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
