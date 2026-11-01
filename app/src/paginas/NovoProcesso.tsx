// Cadastro de processo (novo ou atualizar), por etapas como os de pessoa, contrato e demanda: o processo (tipo, número,
// nome e órgão), as pessoas (clientes, polo e equipe) e os detalhes, nenhum deles obrigatório. No judicial, o número segue
// o padrão do CNJ (ou é marcado como antigo) e já indica o órgão. Vindo do cartão de uma pessoa (?cliente=), ela já vem escolhida.
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type CampoDeOpcao, type OpcaoDeProcesso, type PessoaLista, type Processo, type SugestoesDeProcesso, type TipoProcesso } from '../dados';
import { CLIENTES_MAXIMOS, TAMANHO_PROCESSO } from '../dados/limites';
import { SIGLAS_SUGERIDAS } from '../regras/calendario';
import { MASCARAS } from '../regras/pessoa';
import {
  aoMudarNumero, camposDoProcesso, dadosDoProcesso, ETAPAS_PROCESSO, errosDaEtapaProcesso, GRATUIDADES, LISTAS_DO_PROCESSO, MEIOS, opcaoNaLista, opcoesDoCampo, orgaoIndicadoNoProcesso, POLOS,
  primeiraEtapaComErroProcesso, processoVazio, semSairDoProcesso, TIPOS, TIPOS_PROCESSO, validarProcesso, type CamposProcesso, type EtapaProcesso
} from '../regras/processo';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { falha, feito } from '../ui/avisos';
import { Aviso, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
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

export default function NovoProcesso({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa'), clienteInicial = params.get('cliente');
  const tipoInicial: TipoProcesso = params.get('tipo') === 'administrativo' ? 'administrativo' : 'judicial';

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposProcesso>(() => ({ ...processoVazio(tipoInicial), responsavelId: ctx.perfil.id }));
  const [alvo, setAlvo] = useState<Processo | null>(null);   // processo sendo atualizado
  const [pronto, setPronto] = useState(!idAtualizar);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaProcesso>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // A pessoa escolhida em cada linha de cliente (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [clientes, setClientes] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const [focarCliente, setFocarCliente] = useState<number | null>(null);
  // As listas ampliadas pelo escritório e o que já foi digitado em outros processos.
  const [opcoes, setOpcoes] = useState<OpcaoDeProcesso[]>([]);
  const [sugestoes, setSugestoes] = useState<SugestoesDeProcesso>(NADA_SUGERIDO);
  // O órgão que o número indicou: troca se o número mudar, mas nunca o que a pessoa digitou.
  const orgaoIndicado = useRef('');
  useTitulo(edicao ? null : alvo ? 'Atualizar processo' : 'Novo processo');

  useEffect(() => {
    SD.processoOpcoes().then(setOpcoes).catch(() => {});
    if (idAtualizar) {
      SD.processoObter(idAtualizar)
        .then(p => {
          if (!p) throw new Error('Processo não encontrado.');
          setAlvo(p);
          const campos = camposDoProcesso(p);
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
    if (clienteInicial) SD.pessoaObter(clienteInicial).then(p => { if (p) { setClientes([p]); setC(x => ({ ...x, clientes: [p.id] })); } }).catch(falha);
  }, [idAtualizar, clienteInicial]);
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
  const judicial = c.tipo === 'judicial', noPadrao = judicial && !c.numeroAntigo;

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
    if (Object.keys(errosDaEtapaProcesso(etapa.id, c)).length) { focarErro(); return; }
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
  }
  // Na busca de cada linha, quem já é cliente em outra linha aparece desligado.
  const outroCliente = (i: number) => (p: PessoaLista) => c.clientes.some((x, j) => j !== i && x === p.id) ? 'já é cliente' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);
  const opcoesColab = ctx.equipe.filter(m => m.id !== c.responsavelId && (m.ativo !== false || c.colaboradores.includes(m.id)));
  const marcarColaborador = (id: string, marcar: boolean) =>
    mudar({ colaboradores: marcar ? [...c.colaboradores, id] : c.colaboradores.filter(x => x !== id) });

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
  const opcaoEscolhida = (campo: CampoDeOpcao) => opcoes.find(o => o.campo === campo && o.valor === c[campo]);
  const listaDe = (campo: CampoDeOpcao, escolhida = opcaoEscolhida(campo)) => <Campo rotulo={LISTAS_DO_PROCESSO[campo].rotulo} para={campo}
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
  async function salvar() {
    if (ocupado) return;   // o Enter não respeita o botão desligado
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErroProcesso(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_PROCESSO.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados = dadosDoProcesso(c), { caminho, quadro } = TIPOS_PROCESSO[c.tipo];
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: o processo como estava, no mesmo formato que o cadastro grava.
        const antes = dadosDoProcesso(camposDoProcesso(alvo));
        const eu = ctx.perfil.id, { dados: gravar, ficou } = semSairDoProcesso(dados, eu, ctx.ehAdmin || alvo.criado_por === eu);
        await SD.processoAtualizar(alvo.id, gravar);
        feito(ficou ? 'Processo atualizado. Você continua como colaborador; só um administrador pode tirar você dele.' : 'Processo atualizado.', 'atualização do processo', async () => {
          await SD.processoAtualizar(alvo.id, antes);
          return { tipo: 'processoAtualizado', id: alvo.id };
        });
        if (edicao) edicao.aoTerminar(true); else navegar(caminho + '?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, o processo novo entra na coluna-marco de início. A coluna vinda do quadro só vale para o tipo daquele quadro.
        const coluna = (c.tipo === tipoInicial && etapaInicial) || await colunaInicial(quadro);
        const r = await SD.processoCriar({ ...dados, tipo: c.tipo, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        feito(`Processo ${r.codigo} cadastrado.`, 'cadastro do processo', async () => {
          await SD.processosArquivar([r.id], true);
          const x = await SD.processosExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'processoCriado', id: r.id };
        });
        navegar(caminho + '?id=' + r.id);
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  const CONTEUDO: Record<EtapaProcesso, () => ReactNode> = {
    processo: () => <>
      {/* O tipo não muda depois de salvo: cada tipo tem o seu quadro. */}
      {alvo ? <div className="pergunta"><span className="rot">Tipo</span><span>{TIPOS_PROCESSO[c.tipo].nome}</span></div>
        : <Escolhas rotulo="Tipo" obrigatorio>
          {TIPOS.map(t => <label key={t}><input type="radio" name="tipo" checked={c.tipo === t} onChange={() => mudarNumero({ tipo: t })} />{TIPOS_PROCESSO[t].nome}</label>)}
        </Escolhas>}
      <Campo rotulo="Número do processo" para="numero" obrigatorio erro={erros.numero}
        dica={noPadrao ? 'No padrão do CNJ. O sistema confere o número e indica o órgão.' : judicial ? 'Como aparece nos autos.' : 'O número do pedido ou do protocolo no órgão.'}>
        <input type="text" {...propsDoCampo('numero', { dica: true, erro: erros.numero })} inputMode={noPadrao ? 'numeric' : undefined} maxLength={TAMANHO_PROCESSO.numero} value={c.numero}
          onChange={e => mudarNumero({ numero: e.target.value })} />
      </Campo>
      {judicial && <Escolhas rotulo="Formato do número">
        <label><input type="checkbox" checked={c.numeroAntigo} onChange={e => mudarNumero({ numeroAntigo: e.target.checked })} />É um número antigo, de antes do padrão do CNJ</label>
      </Escolhas>}
      <Campo rotulo="Órgão" para="orgao" erro={erros.orgao} dica="A sigla. Ex.: TJMG, TRF6, INPI, INSS. Aparece acima do nome do cartão.">
        <CampoComSugestoes type="text" {...propsDoCampo('orgao', { dica: true, erro: erros.orgao })} maxLength={TAMANHO_PROCESSO.orgao} valor={c.orgao}
          aoMudar={orgao => mudar({ orgao: orgao.toUpperCase() })} sugestoes={emSugestoes(siglas)} />
      </Campo>
      <Campo rotulo="Nome do cartão" para="titulo" erro={erros.titulo} dica="Opcional. Sem ele, o cartão mostra o nome dos clientes.">
        <input type="text" {...propsDoCampo('titulo', { dica: true, erro: erros.titulo })} maxLength={TAMANHO_PROCESSO.titulo} value={c.titulo}
          onChange={e => mudar({ titulo: e.target.value })} />
      </Campo>
    </>,
    pessoas: () => <>
      <div className={'pergunta' + (erros.clientes ? ' erro' : '')} role="group" aria-label="Clientes">
        {c.clientes.map((_, i) => <div className="linha-cliente" key={chaves[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={c.clientes.length === 1 ? <span>Cliente<span className="req" aria-hidden="true">*</span></span> : `Cliente ${i + 1}`} escolhida={clientes[i]}
              aoEscolher={escolherCliente(i)} desativar={outroCliente(i)} focar={chaves[i] === focarCliente} />
          </div>
          {c.clientes.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar o cliente ${i + 1}`} onClick={() => tirarCliente(i)}>
            <Icone nome="fechar" tam={15} />
          </button>}
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.clientes.length >= CLIENTES_MAXIMOS} onClick={acrescentarCliente}>
          <Icone nome="mais" tam={13} /> Adicionar cliente
        </button></div>
        {erros.clientes && <span className="msg-erro" role="alert">{erros.clientes}</span>}
      </div>
      <Campo rotulo="Polo do cliente" para="polo">
        <select {...propsDoCampo('polo')} value={c.polo} onChange={e => mudar({ polo: e.target.value as CamposProcesso['polo'] })}>
          <option value="">{NAO_INFORMADO}</option>
          {Object.entries(POLOS).map(([v, nome]) => <option key={v} value={v}>{nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pelo processo: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, colaboradores: c.colaboradores.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <Escolhas rotulo="Colaboradores" erro={erros.colaboradores} dica="Quem da equipe também trabalha no processo (e passa a vê-lo).">
        {opcoesColab.length ? opcoesColab.map(m => <label key={m.id}>
          <input type="checkbox" checked={c.colaboradores.includes(m.id)} onChange={e => marcarColaborador(m.id, e.target.checked)} />{m.nome}
        </label>) : <Nota>Não há mais ninguém na equipe.</Nota>}
      </Escolhas>
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
        <Campo rotulo="Data da distribuição" para="distribuicao" erro={erros.distribuicao}>
          <input type="text" {...propsDoCampo('distribuicao', { erro: erros.distribuicao })} inputMode="numeric" placeholder="DD/MM/AAAA" value={c.distribuicao}
            onChange={e => mudar({ distribuicao: MASCARAS.data(e.target.value) })} />
        </Campo>
        <Campo rotulo="Valor da causa" para="valorCausa" erro={erros.valorCausa}>
          <input type="text" {...propsDoCampo('valorCausa', { erro: erros.valorCausa })} inputMode="decimal" placeholder="0,00" value={c.valorCausa}
            onChange={e => mudar({ valorCausa: e.target.value })} />
        </Campo>
        <Campo rotulo="Instância" para="instancia" erro={erros.instancia}>
          <input type="text" {...propsDoCampo('instancia', { erro: erros.instancia })} maxLength={TAMANHO_PROCESSO.instancia} value={c.instancia} onChange={e => mudar({ instancia: e.target.value })} />
        </Campo>
        <Escolhas rotulo="Segredo de justiça">
          <label><input type="checkbox" checked={c.segredo} onChange={e => mudar({ segredo: e.target.checked })} />Este processo corre em segredo de justiça</label>
        </Escolhas>
        <Campo rotulo="Advogado da parte contrária" para="advogadoContrario" erro={erros.advogadoContrario}>
          <input type="text" {...propsDoCampo('advogadoContrario', { erro: erros.advogadoContrario })} maxLength={TAMANHO_PROCESSO.advogadoContrario} value={c.advogadoContrario}
            onChange={e => mudar({ advogadoContrario: e.target.value })} />
        </Campo>
      </>}
      <Campo rotulo="Observações" para="observacoes" erro={erros.observacoes}>
        <textarea {...propsDoCampo('observacoes', { erro: erros.observacoes })} maxLength={TAMANHO_PROCESSO.observacoes} value={c.observacoes}
          onChange={e => mudar({ observacoes: e.target.value })} />
      </Campo>
    </>
  };

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar processo" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {ETAPAS_PROCESSO.map(e => <section className="etapa ativa" key={e.id} aria-labelledby={'etapa-' + e.id}>
        <header><h2 id={'etapa-' + e.id}>{e.titulo}</h2></header>
        {CONTEUDO[e.id]()}
      </section>)}
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = TIPOS_PROCESSO[c.tipo].caminho + (idAtualizar ? '?id=' + idAtualizar : '');
  const total = ETAPAS_PROCESSO.length;
  return <div className="passos">
    <header>
      <p className="olho"><Link to={voltar}>Processos</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar processo' : 'Novo processo'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando o processo <b>{alvo.codigo}</b>. As informações anteriores ficam no histórico.</Aviso>}
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
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar processo') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
