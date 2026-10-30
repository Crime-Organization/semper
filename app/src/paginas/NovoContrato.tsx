// Cadastro de contrato por etapas, no modelo do cadastro de pessoa (também usado para atualizar: /contratos/novo/?id=...):
// cliente e responsável; o que foi contratado (objetos e categoria); honorários; divisão; documento e observações.
// Cada etapa só segue com os campos dela certos (regras/contrato.ts, ETAPAS_CONTRATO). O número do contrato é dado pelo
// banco ao salvar e, depois de dado, não muda.
import { useEffect, useRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type Contrato, type PessoaLista } from '../dados';
import { CLIENTES_MAXIMOS, OBJETOS_MAXIMOS, PARTICIPANTES_MAXIMOS, TAMANHO_CONTRATO } from '../dados/limites';
import {
  calculadosDoContrato, camposDoContrato, CATEGORIAS, CONTRATO_VAZIO, dadosDoContrato, dinheiroNoCampo, errosDaEtapa, ETAPAS_CONTRATO,
  fmtDinheiro, fmtPercentual, lerDinheiro, nomesPorExtenso, PERCENTUAIS_ESCRITORIO, primeiraEtapaComErro, validarContrato,
  type CampoComErro, type CamposContrato, type EtapaContrato
} from '../regras/contrato';
import { motivoParaNaoParticipar, opcoesDeResponsavel } from '../regras/equipe';
import { MASCARAS } from '../regras/pessoa';
import { falha, feito } from '../ui/avisos';
import { Aviso, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { Icone } from '../ui/Icone';
import { ordemNoFim } from '../ui/quadro/posicao';
import { normal } from '../regras/texto';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import './Contratos.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** A pessoa única do contrato escolhida pela busca e o campo dela no formulário (clientes e participantes são listas). */
const PAPEIS = {
  indicador: { campo: 'indicadorId', percentual: 'indicadorPercentual' }
} as const satisfies Record<string, { campo: keyof CamposContrato; percentual: keyof CamposContrato | null }>;
type Papel = keyof typeof PAPEIS;
type CampoTexto = Exclude<keyof CamposContrato, 'clientes' | 'objetos' | 'participantes'>;
/** Os campos da etapa que está na tela (o Enter passa de um para o outro). */
const CAMPOS_DA_ETAPA = '.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select';

export default function NovoContrato({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id');
  const etapaInicial = params.get('etapa');

  // Quem é advogado já vem como responsável.
  const [c, setC] = useState<CamposContrato>(() => ({
    ...CONTRATO_VAZIO, responsavelId: opcoesDeResponsavel(ctx.equipe).some(m => m.id === ctx.perfil.id) ? ctx.perfil.id : ''
  }));
  const [pessoas, setPessoas] = useState<Record<Papel, Escolhida>>({ indicador: null });
  // A pessoa escolhida em cada linha de cliente (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [clientes, setClientes] = useState<Escolhida[]>([null]);
  const [chavesCli, setChavesCli] = useState<number[]>([0]);
  const [focarCliente, setFocarCliente] = useState<number | null>(null);
  const [alvo, setAlvo] = useState<Contrato | null>(null);   // contrato sendo atualizado
  const [pronto, setPronto] = useState(!idAtualizar);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaContrato>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // Cada linha de objeto e de participante tem a sua chave, para o React não trocar o que foi digitado ao tirar uma
  // linha do meio.
  const [chaves, setChaves] = useState<number[]>([1]);
  const [chavesPart, setChavesPart] = useState<number[]>([]);
  const proximaChave = useRef(2);
  // A pessoa escolhida em cada linha de participante (para mostrar o nome) e a linha nova, que recebe o foco.
  const [participantes, setParticipantes] = useState<Escolhida[]>([]);
  const [focarParticipante, setFocarParticipante] = useState<number | null>(null);
  const [sugeridos, setSugeridos] = useState<string[]>([]);
  useTitulo(edicao ? null : alvo ? 'Atualizar contrato' : 'Novo contrato');

  useEffect(() => {
    if (!idAtualizar) return;
    SD.contratoObter(idAtualizar)
      .then(k => {
        if (!k) throw new Error('Contrato não encontrado.');
        setAlvo(k);
        const campos = camposDoContrato(k);
        setC(campos);
        const objetos = campos.objetos.length;
        setChaves(campos.objetos.map((_, i) => i + 1));
        setChavesPart(k.participantes.map((_, i) => objetos + 1 + i));
        setChavesCli(k.clientes.map((_, i) => objetos + k.participantes.length + 1 + i));
        proximaChave.current = objetos + k.participantes.length + k.clientes.length + 1;
        setParticipantes(k.participantes.map(p => p.pessoa));
        setClientes(k.clientes.length ? k.clientes : [null]);
        setPessoas({ indicador: k.indicador });
      })
      .catch(falha)
      .finally(() => setPronto(true));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega o contrato a atualizar uma vez só, ao abrir o formulário
  }, []);
  // Vindo do cartão de uma pessoa ("Novo contrato com esta pessoa como cliente"): ela já vem escolhida.
  const clienteInicial = params.get('cliente');
  useEffect(() => {
    if (idAtualizar || !clienteInicial) return;
    SD.pessoaObter(clienteInicial)
      .then(p => { if (p) { setClientes([p]); setC(atual => ({ ...atual, clientes: [p.id] })); } })
      .catch(falha);
  // oxlint-disable-next-line react/exhaustive-deps -- uma vez só, ao abrir o formulário
  }, []);
  // Os objetos já usados no escritório aparecem como sugestão enquanto se digita (sem elas, o cadastro segue igual).
  useEffect(() => { SD.objetosSugeridos().then(setSugeridos).catch(() => {}); }, []);
  // A cada etapa, o foco vai para o primeiro campo dela.
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>(CAMPOS_DA_ETAPA)?.focus({ preventScroll: true }), 0);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  const etapa = ETAPAS_CONTRATO[passo];
  const ultimo = passo === ETAPAS_CONTRATO.length - 1;
  const todos = validarContrato(c);
  const conferidos = new Set(ETAPAS_CONTRATO.filter(e => conferidas.has(e.id)).flatMap(e => e.campos));
  const erros: Partial<Record<CampoComErro, string>> = Object.fromEntries(Object.entries(todos).filter(([campo]) => conferidos.has(campo as CampoComErro)));
  const calculados = calculadosDoContrato(c);
  const mudar = (campos: Partial<CamposContrato>) => setC(atual => ({ ...atual, ...campos }));
  // Tirar o indicador tira também o percentual dele.
  const escolher = (papel: Papel) => (p: PessoaLista | null) => {
    const { campo, percentual } = PAPEIS[papel];
    setPessoas(x => ({ ...x, [papel]: p }));
    mudar({ [campo]: p?.id ?? '', ...(percentual && !p ? { [percentual]: '' } : {}) });
  };

  // ---------- etapas ----------
  function irPara(i: number) {
    setPasso(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const focarErro = () => requestAnimationFrame(() =>
    document.querySelector('.etapa.ativa .pergunta.erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  function avancar() {
    if (edicao) { void salvar(); return; }
    setConferidas(x => new Set(x).add(etapa.id));
    if (Object.keys(errosDaEtapa(etapa.id, c)).length) { focarErro(); return; }
    if (ultimo) void salvar(); else irPara(passo + 1);
  }
  // Enter: vai para o próximo campo da etapa ou para a próxima etapa. A busca de pessoa e os objetos tratam o Enter deles.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.defaultPrevented || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    const campos = [...document.querySelectorAll<HTMLElement>(CAMPOS_DA_ETAPA)].filter(x => x.offsetParent !== null && !x.hasAttribute('disabled'));
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else avancar();
  }

  // ---------- objetos ----------
  const idObjeto = (i: number) => 'contrato-objeto-' + chaves[i];
  const mudarObjeto = (i: number, v: string) => setC(atual => ({ ...atual, objetos: atual.objetos.map((o, j) => j === i ? v : o) }));
  function acrescentarObjeto(depois = c.objetos.length - 1) {
    const chave = proximaChave.current++;
    setC(atual => ({ ...atual, objetos: atual.objetos.toSpliced(depois + 1, 0, '') }));
    setChaves(atual => atual.toSpliced(depois + 1, 0, chave));
    setTimeout(() => document.getElementById('contrato-objeto-' + chave)?.focus(), 0);
  }
  function tirarObjeto(i: number) {
    setC(atual => ({ ...atual, objetos: atual.objetos.toSpliced(i, 1) }));
    setChaves(atual => atual.toSpliced(i, 1));
  }
  // As sugestões de cada linha: os objetos do escritório, menos os que já estão nas outras linhas.
  const sugestoesDoObjeto = (i: number) => {
    const escolhidos = new Set(c.objetos.filter((o, j) => j !== i && o.trim()).map(normal));
    return sugeridos.filter(o => !escolhidos.has(normal(o))).map(valor => ({ valor }));
  };
  // Enter num objeto vai para o próximo; no último preenchido, abre uma linha nova.
  function teclarObjeto(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (i < c.objetos.length - 1) document.getElementById(idObjeto(i + 1))?.focus();
    else if (c.objetos[i].trim() && c.objetos.length < OBJETOS_MAXIMOS) acrescentarObjeto(i);
  }

  // ---------- clientes ----------
  const escolherCliente = (i: number) => (p: PessoaLista | null) => {
    setClientes(atual => atual.map((x, j) => j === i ? p : x));
    setC(atual => ({ ...atual, clientes: atual.clientes.map((x, j) => j === i ? p?.id ?? '' : x) }));
  };
  function acrescentarCliente() {
    const chave = proximaChave.current++;
    setC(atual => ({ ...atual, clientes: [...atual.clientes, ''] }));
    setClientes(atual => [...atual, null]);
    setChavesCli(atual => [...atual, chave]);
    setFocarCliente(chave);
  }
  function tirarCliente(i: number) {
    setC(atual => ({ ...atual, clientes: atual.clientes.toSpliced(i, 1) }));
    setClientes(atual => atual.toSpliced(i, 1));
    setChavesCli(atual => atual.toSpliced(i, 1));
  }
  const outroCliente = (i: number) => (p: PessoaLista) => c.clientes.some((x, j) => j !== i && x === p.id) ? 'já é cliente' : null;

  // ---------- participantes ----------
  const mudarParticipante = (i: number, campos: Partial<CamposContrato['participantes'][number]>) =>
    setC(atual => ({ ...atual, participantes: atual.participantes.map((p, j) => j === i ? { ...p, ...campos } : p) }));
  // Trocar a pessoa de uma linha mantém o % já digitado.
  const escolherParticipante = (i: number) => (p: PessoaLista | null) => {
    setParticipantes(atual => atual.map((x, j) => j === i ? p : x));
    mudarParticipante(i, { pessoaId: p?.id ?? '' });
  };
  function acrescentarParticipante() {
    const chave = proximaChave.current++;
    setC(atual => ({ ...atual, participantes: [...atual.participantes, { pessoaId: '', percentual: '' }] }));
    setParticipantes(atual => [...atual, null]);
    setChavesPart(atual => [...atual, chave]);
    setFocarParticipante(chave);
  }
  function tirarParticipante(i: number) {
    setC(atual => ({ ...atual, participantes: atual.participantes.toSpliced(i, 1) }));
    setParticipantes(atual => atual.toSpliced(i, 1));
    setChavesPart(atual => atual.toSpliced(i, 1));
  }
  // Na busca de cada linha, quem já está no contrato aparece desligado, com o motivo.
  const jaNoContrato = (i: number) => (p: PessoaLista) => p.id === c.indicadorId ? 'já é o indicador'
    : c.participantes.some((x, j) => j !== i && x.pessoaId === p.id) ? 'já é participante' : null;

  // Quem pode ser responsável: os advogados da equipe e quem já é o responsável (para não sair sem querer).
  const opcoesResp = opcoesDeResponsavel(ctx.equipe, c.responsavelId);
  // Participante é sempre alguém da equipe; quem não é aparece desligado na busca, com o motivo.
  const podeParticipar = (i: number) => (p: PessoaLista) => jaNoContrato(i)(p) ?? motivoParaNaoParticipar(ctx.equipe, p.id);

  // ---------- envio ----------
  async function salvar() {
    // Uma etapa anterior pode ter ficado com erro (a pessoa voltou e mudou): volta para ela.
    const comErro = primeiraEtapaComErro(c);
    if (comErro >= 0) {
      setConferidas(new Set(ETAPAS_CONTRATO.map(e => e.id)));
      if (!edicao) irPara(comErro);
      focarErro();
      return;
    }
    const dados = dadosDoContrato(c);
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: o contrato como estava, no mesmo formato que o cadastro grava.
        const antes = dadosDoContrato(camposDoContrato(alvo));
        await SD.contratoAtualizar(alvo.id, dados);
        feito('Contrato atualizado.', 'atualização do contrato', async () => {
          await SD.contratoAtualizar(alvo.id, antes);
          return { tipo: 'contratoAtualizado', id: alvo.id };
        });
        if (edicao) edicao.aoTerminar(true); else navegar('/contratos/?id=' + alvo.id);
      } else {
        // Sem coluna escolhida, o contrato novo entra na primeira coluna do quadro.
        const coluna = etapaInicial || (await SD.colunasListar('contratos')).sort((a, b) => a.ordem - b.ordem)[0]?.id || null;
        const r = await SD.contratoCriar({ ...dados, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        feito(`Contrato ${r.codigo} cadastrado.`, 'cadastro do contrato', async () => {
          await SD.contratosArquivar([r.id], true);
          const x = await SD.contratosExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'contratoCriado', id: r.id };
        });
        navegar('/contratos/?id=' + r.id);
      }
    } catch (err) {
      falha(err);
      setOcupado(false);
    }
  }

  // ---------- pedaços do formulário ----------
  const req = <span className="req" aria-hidden="true">*</span>;
  const texto = (nome: CampoTexto, props: InputHTMLAttributes<HTMLInputElement> = {}, dica = false) =>
    <input type="text" {...propsDoCampo(nome, { dica, erro: erros[nome] })} value={c[nome]} onChange={e => mudar({ [nome]: e.target.value })} {...props} />;
  // Valor em reais: ao sair do campo, fica no formato 1.500,00 (se der para ler).
  const dinheiro = (nome: 'valor' | 'entrada' | 'descontos', dica = false) => texto(nome, {
    inputMode: 'decimal', placeholder: '0,00',
    onBlur: e => { try { mudar({ [nome]: dinheiroNoCampo(lerDinheiro(e.target.value)) }); } catch { /* o erro aparece ao seguir */ } }
  }, dica);
  const data = (nome: 'assinadoEm' | 'primeiroPagamento') =>
    texto(nome, { inputMode: 'numeric', placeholder: 'DD/MM/AAAA', onChange: e => mudar({ [nome]: MASCARAS.data(e.target.value) }) });
  const radios = (nome: 'categoria' | 'percentualEscritorio', opcoes: [string, string][]) => opcoes.map(([v, t]) =>
    <label key={v || 'nenhum'}><input type="radio" name={nome} value={v} checked={c[nome] === v} onChange={() => mudar({ [nome]: v })} />{t}</label>);
  // Busca de pessoa com o visual dos outros campos da etapa (a busca é a mesma de Vínculos e de Equipe).
  const pessoa = (papel: Papel, rotulo: ReactNode, desativar?: (p: PessoaLista) => string | null) => {
    const erro = erros[PAPEIS[papel].campo];
    return <div className={'pergunta' + (erro ? ' erro' : '')}>
      <div className="campo-busca"><BuscaPessoa rotulo={rotulo} escolhida={pessoas[papel]} aoEscolher={escolher(papel)} desativar={desativar} /></div>
      {erro && <span className="msg-erro" role="alert">{erro}</span>}
    </div>;
  };
  const calculado = (rotulo: string, valor: string, erro?: string) =>
    <div className={'pergunta' + (erro ? ' erro' : '')}>
      <span className="rot">{rotulo} <small className="calculado">calculado</small></span>
      <output className="contrato-calculado" aria-label={rotulo}>{valor || '—'}</output>
      {erro && <span className="msg-erro" role="alert">{erro}</span>}
    </div>;

  const CONTEUDO: Record<EtapaContrato, () => ReactNode> = {
    partes: () => <>
      <div className={'pergunta' + (erros.clientes ? ' erro' : '')} role="group" aria-label="Clientes">
        {c.clientes.map((_, i) => <div className="linha-cliente" key={chavesCli[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={c.clientes.length === 1 ? <span>Cliente{req}</span> : `Cliente ${i + 1}`} escolhida={clientes[i]}
              aoEscolher={escolherCliente(i)} desativar={outroCliente(i)} focar={chavesCli[i] === focarCliente} />
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
      <Campo rotulo="Advogado responsável" para="responsavelId" obrigatorio erro={erros.responsavelId}
        dica={(alvo ? 'Trocar o responsável não muda o número do contrato.' : 'A sigla do número vem do nome e do CPF dele, do cadastro em Pessoas.') + ' Só advogados da equipe.'}>
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId} onChange={e => mudar({ responsavelId: e.target.value })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Código antigo" para="codigoAntigo" dica="Das planilhas, se houver (ex.: HE62-DE74-001/24)." erro={erros.codigoAntigo}>
        {texto('codigoAntigo', { maxLength: TAMANHO_CONTRATO.codigo_antigo, className: 'caixa-alta' }, true)}
      </Campo>
      {!alvo && <Nota>O número é dado ao salvar: a sigla do responsável, o número do contrato no ano (a contagem recomeça em janeiro) e o ano.
        Depois de dado, ele não muda.</Nota>}
    </>,
    objetos: () => <>
      <div className={'pergunta' + (erros.objetos ? ' erro' : '')} role="group" aria-labelledby="objetos-rotulo">
        <span className="rot" id="objetos-rotulo">Objetos do contrato{req}</span>
        <p className="dica">Um por linha. Enter abre a linha seguinte; os já usados no escritório aparecem como sugestão.</p>
        <div className="lista-objetos">{c.objetos.map((o, i) => <div className="linha-campo" key={chaves[i]}>
          <CampoComSugestoes type="text" id={idObjeto(i)} aria-label={`Objeto ${i + 1}`} maxLength={TAMANHO_CONTRATO.objeto}
            placeholder={i === 0 ? 'Ex.: Registro da marca no INPI' : undefined} valor={o} aoMudar={v => mudarObjeto(i, v)} sugestoes={sugestoesDoObjeto(i)}
            aria-invalid={erros.objetos ? true : undefined} aria-describedby={erros.objetos ? 'objetos-erro' : undefined} onKeyDown={e => teclarObjeto(e, i)} />
          {c.objetos.length > 1 && <button type="button" className="icone-btn" aria-label={`Tirar o objeto ${i + 1}`} onClick={() => tirarObjeto(i)}><Icone nome="fechar" tam={15} /></button>}
        </div>)}</div>
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.objetos.length >= OBJETOS_MAXIMOS} onClick={() => acrescentarObjeto()}>
          <Icone nome="mais" tam={13} /> Adicionar objeto
        </button></div>
        {erros.objetos && <span className="msg-erro" id="objetos-erro" role="alert">{erros.objetos}</span>}
      </div>
      <Escolhas rotulo="Categoria de honorário" obrigatorio erro={erros.categoria}>{radios('categoria', Object.entries(CATEGORIAS))}</Escolhas>
    </>,
    honorarios: () => <>
      <div className="grade-campos">
        <Campo rotulo="Valor do contrato" para="valor" erro={erros.valor}>{dinheiro('valor')}</Campo>
        <Campo rotulo="Entrada" para="entrada" erro={erros.entrada}>{dinheiro('entrada')}</Campo>
      </div>
      <div className="grade-campos">
        <Campo rotulo="Parcelas" para="parcelas" erro={erros.parcelas}>{texto('parcelas', { inputMode: 'numeric', placeholder: '1' })}</Campo>
        {calculado('Valor da parcela', fmtDinheiro(calculados.parcela))}
        <Campo rotulo="Descontos" para="descontos" erro={erros.descontos}>{dinheiro('descontos')}</Campo>
      </div>
      <div className="grade-campos">
        <Campo rotulo="Assinado em" para="assinadoEm" erro={erros.assinadoEm}>{data('assinadoEm')}</Campo>
        <Campo rotulo="Primeiro pagamento" para="primeiroPagamento" erro={erros.primeiroPagamento}>{data('primeiroPagamento')}</Campo>
      </div>
      <Nota>Com entrada, ela conta como a primeira parcela: as demais dividem o que sobra.</Nota>
    </>,
    divisao: () => <>
      <Escolhas rotulo="Enviado ao escritório" dica="Quanto do que o cliente pagar vai para a conta PJ." erro={erros.percentualEscritorio}>
        {radios('percentualEscritorio', [['', 'A definir'], ...PERCENTUAIS_ESCRITORIO.map(v => [String(v), `${v}% do que o cliente pagar`] as [string, string])])}
      </Escolhas>
      {calculado('Fica com o responsável', fmtPercentual(calculados.responsavel), erros.divisao)}
      <div className={'pergunta' + (erros.participantes ? ' erro' : '')} role="group" aria-labelledby="participantes-rotulo">
        <span className="rot" id="participantes-rotulo">Participantes</span>
        <p className="dica">Quem da equipe trabalha no caso com o responsável, cada um com o seu % sobre o total.</p>
        {c.participantes.map((p, i) => <div className="linha-participante" key={chavesPart[i]}>
          <div className="campo-busca">
            <BuscaPessoa rotulo={`Participante ${i + 1}`} escolhida={participantes[i]} aoEscolher={escolherParticipante(i)}
              desativar={podeParticipar(i)} focar={chavesPart[i] === focarParticipante} />
          </div>
          <label>%
            <input type="text" inputMode="decimal" placeholder="0" aria-label={`% do participante ${i + 1}`} value={p.percentual}
              aria-invalid={erros.participantes ? true : undefined} onChange={e => mudarParticipante(i, { percentual: e.target.value })} />
          </label>
          <button type="button" className="icone-btn" aria-label={`Tirar o participante ${i + 1}`} onClick={() => tirarParticipante(i)}>
            <Icone nome="fechar" tam={15} />
          </button>
        </div>)}
        <div><button type="button" className={estiloBotao({ forma: 'mini' })} disabled={c.participantes.length >= PARTICIPANTES_MAXIMOS} onClick={acrescentarParticipante}>
          <Icone nome="mais" tam={13} /> Adicionar participante
        </button></div>
        {erros.participantes && <span className="msg-erro" role="alert">{erros.participantes}</span>}
      </div>
      <div className="grade-indicador">
        {pessoa('indicador', 'Indicador', p => c.participantes.some(x => x.pessoaId === p.id) ? 'já é participante' : null)}
        <Campo rotulo="% do indicador" para="indicadorPercentual" erro={erros.indicadorPercentual}>
          {texto('indicadorPercentual', { inputMode: 'decimal', placeholder: '0', disabled: !c.indicadorId })}
        </Campo>
      </div>
      <Nota>Os participantes são sempre da equipe. O indicador é um só e pode ser qualquer pessoa, da equipe ou um parceiro de fora. Todos precisam estar cadastrados em Pessoas.</Nota>
    </>,
    documento: () => <>
      <Campo rotulo="Link do contrato no Drive" para="documentoUrl" erro={erros.documentoUrl}>
        {texto('documentoUrl', { inputMode: 'url', maxLength: TAMANHO_CONTRATO.documento_url, placeholder: 'https://drive.google.com/…' })}
      </Campo>
      <Campo rotulo="Observações" para="observacoes">
        <textarea {...propsDoCampo('observacoes')} maxLength={TAMANHO_CONTRATO.observacoes} value={c.observacoes} onChange={e => mudar({ observacoes: e.target.value })} />
      </Campo>
    </>
  };

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="form-grade edicao-cartao" noValidate autoComplete="off" aria-label="Editar contrato" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      {ETAPAS_CONTRATO.map(e => <section className="etapa ativa" key={e.id} aria-labelledby={'etapa-' + e.id}>
        <header><h2 id={'etapa-' + e.id}>{e.titulo}</h2></header>
        {CONTEUDO[e.id]()}
      </section>)}
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
    </form>;

  const voltar = idAtualizar ? '/contratos/?id=' + idAtualizar : '/contratos/';
  const total = ETAPAS_CONTRATO.length;
  return <div className="passos">
    <header>
      <p className="olho"><Link to={voltar}>Contratos</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar contrato' : 'Novo contrato'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info">Você está atualizando o contrato <b>{alvo.codigo}</b> de <b>{nomesPorExtenso(alvo.clientes.map(x => x.nome))}</b>. O número não muda, e as informações anteriores ficam no histórico.</Aviso>}
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
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar contrato') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
