// Cadastro de compromisso (novo ou atualizar), por etapas como os de pessoa, demanda e processo: o compromisso (tipo, data e
// hora), onde e de qual processo, as pessoas e os detalhes. Vindo do cartão de uma pessoa (?pessoa=) ou de um processo
// (?processo=, que já começa como audiência), ele já vem escolhido. Ao escolher o processo, os clientes dele entram no
// compromisso, se ainda não houver pessoas. A data e a hora são as do relógio de Brasília.
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type Compromisso, type PessoaLista, type PessoaResumida, type ProcessoParaLigar, type TipoCompromisso } from '../dados';
import { CLIENTES_MAXIMOS, TAMANHO_COMPROMISSO } from '../dados/limites';
import {
  camposDoCompromisso, compromissoVazio, continuaPeloProcesso, dadosDoCompromisso, errosDaEtapaCompromisso, ETAPAS_COMPROMISSO, MODALIDADES, primeiraEtapaComErroCompromisso,
  semSairDoCompromisso, TIPOS, TIPOS_COMPROMISSO, validarCompromisso, type CamposCompromisso, type EtapaCompromisso
} from '../regras/compromisso';
import { clientesPorExtenso } from '../regras/contrato';
import { fmtCNJ, partesDoCNJ } from '../regras/numeroCNJ';
import { MASCARAS } from '../regras/pessoa';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { falha, feito } from '../ui/avisos';
import { sairDoCartao } from '../ui/sairDoCartao';
import { gravaForaDoCartao } from '../regras/sairDoCartao';
import { Aviso, Campo, Carregando, Escolhas, estiloBotao, Nota, propsDoCampo } from '../ui/base';
import { BuscaPessoa } from '../ui/BuscaPessoa';
import { CampoComSugestoes } from '../ui/CampoComSugestoes';
import { Icone } from '../ui/Icone';
import { colunaInicial } from '../ui/quadro/colunaInicial';
import { ordemNoFim } from '../ui/quadro/posicao';
import { useCtx } from '../ui/sessao';
import { subirAoCadastro, useAtrasado, useTitulo } from '../ui/util';
import './Contratos.css';
import './Demandas.css';

type Escolhida = Pick<PessoaLista, 'id' | 'nome'> | null;
/** Os campos da etapa que está na tela (o Enter passa de um para o outro). */
const CAMPOS_DA_ETAPA = '.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select';
const ENDERECO = '/agenda/';
/** Como o processo aparece na busca e no campo: número, nome e clientes. */
const rotuloDoProcesso = (p: Pick<ProcessoParaLigar, 'numero' | 'titulo' | 'cliente_nome'>) =>
  [p.numero, p.titulo, p.cliente_nome && clientesPorExtenso(p.cliente_nome)].filter(Boolean).join(' · ');

export default function NovoCompromisso({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id'), etapaInicial = params.get('etapa'), pessoaInicial = params.get('pessoa'), processoInicial = params.get('processo');
  const tipoInicial: TipoCompromisso = processoInicial ? 'audiencia' : 'reuniao';

  // Quem cadastra já vem como responsável.
  const [c, setC] = useState<CamposCompromisso>(() => ({ ...compromissoVazio(tipoInicial), responsavelId: ctx.perfil.id }));
  const [alvo, setAlvo] = useState<Compromisso | null>(null);   // compromisso sendo atualizado
  const [pronto, setPronto] = useState(!idAtualizar);
  const [passo, setPasso] = useState(0);
  // Os erros de uma etapa aparecem depois da primeira tentativa de seguir e, daí em diante, acompanham o que se digita.
  const [conferidas, setConferidas] = useState<ReadonlySet<EtapaCompromisso>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  // A pessoa escolhida em cada linha (para mostrar o nome), a chave de cada linha e a linha nova, que recebe o foco.
  const [pessoas, setPessoas] = useState<Escolhida[]>([null]);
  const [chaves, setChaves] = useState<number[]>([0]);
  const proximaChave = useRef(1);
  const [focarPessoa, setFocarPessoa] = useState<number | null>(null);
  // Os processos que combinam com o texto digitado na busca (a busca é no banco) e o nome do escolhido.
  const [processos, setProcessos] = useState<ProcessoParaLigar[]>([]);
  const [buscaProcesso, setBuscaProcesso] = useState('');
  const buscaAtrasada = useAtrasado(buscaProcesso);
  const [rotuloProcesso, setRotuloProcesso] = useState('');
  useTitulo(edicao ? null : alvo ? 'Atualizar compromisso' : 'Novo compromisso');

  const mudar = (campos: Partial<CamposCompromisso>) => setC(atual => ({ ...atual, ...campos }));
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
    if (Object.keys(errosDaEtapaCompromisso(etapa.id, c)).length) { focarErro(); return; }
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
  }
  // Na busca de cada linha, quem já está em outra linha aparece desligado.
  const outraPessoa = (i: number) => (p: PessoaLista) => c.pessoas.some((x, j) => j !== i && x === p.id) ? 'já está ligada' : null;

  // ---------- equipe ----------
  // Responsável: qualquer um da equipe ativa, e quem já é o responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = ctx.equipe.filter(m => m.ativo !== false || m.id === c.responsavelId);
  const opcoesPart = ctx.equipe.filter(m => m.id !== c.responsavelId && (m.ativo !== false || c.participantes.includes(m.id)));
  const marcarParticipante = (id: string, marcar: boolean) =>
    mudar({ participantes: marcar ? [...c.participantes, id] : c.participantes.filter(x => x !== id) });

  // ---------- processo ----------
  function digitarProcesso(texto: string) {
    const p = processos.find(x => rotuloDoProcesso(x) === texto);
    // O número colado só com os algarismos fica pontuado, para combinar com o que a lista mostra.
    if (p) { setRotuloProcesso(texto); void ligarProcesso(p.id); setBuscaProcesso(''); } else setBuscaProcesso(partesDoCNJ(texto) ? fmtCNJ(texto) : texto);
  }

  // ---------- envio ----------
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
    const dados = dadosDoCompromisso(c);
    setOcupado(true);
    try {
      if (alvo) {
        // Para desfazer: o compromisso como estava, no mesmo formato que o cadastro grava.
        const antes = dadosDoCompromisso(camposDoCompromisso(alvo));
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
        const r = await SD.compromissoCriar({ ...dados, etapa_id: coluna, etapa_ordem: coluna ? ordemNoFim() : null });
        feito(`Compromisso ${r.codigo} cadastrado.`, 'cadastro do compromisso', async () => {
          await SD.compromissosArquivar([r.id], true);
          const x = await SD.compromissosExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'compromissoCriado', id: r.id };
        });
        saidaLiberada.current = true;
        navegar(ENDERECO + '?id=' + r.id);
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
      <Campo rotulo="Título" para="titulo" obrigatorio={!doProcesso} erro={erros.titulo} dica={doProcesso ? 'Opcional. Sem ele, o cartão mostra o tipo e as pessoas.' : undefined}>
        <input type="text" {...propsDoCampo('titulo', { dica: doProcesso, erro: erros.titulo })} maxLength={TAMANHO_COMPROMISSO.titulo} value={c.titulo} onChange={e => mudar({ titulo: e.target.value })} />
      </Campo>
      <Campo rotulo="Data" para="data" obrigatorio erro={erros.data}>
        <input type="text" {...propsDoCampo('data', { erro: erros.data })} inputMode="numeric" placeholder="DD/MM/AAAA" value={c.data} onChange={e => mudar({ data: MASCARAS.data(e.target.value) })} />
      </Campo>
      <Campo rotulo="Hora" para="hora" obrigatorio={exigeHora} erro={erros.hora} dica={exigeHora ? 'No horário de Brasília.' : 'No horário de Brasília. Sem hora, vale o dia inteiro.'}>
        <input type="time" {...propsDoCampo('hora', { dica: true, erro: erros.hora })} value={c.hora} onChange={e => mudar({ hora: e.target.value })} />
      </Campo>
      <Campo rotulo="Até" para="horaFim" erro={erros.horaFim} dica="Opcional. A hora em que deve terminar.">
        <input type="time" {...propsDoCampo('horaFim', { dica: true, erro: erros.horaFim })} value={c.horaFim} onChange={e => mudar({ horaFim: e.target.value })} />
      </Campo>
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
      <Escolhas rotulo="Modalidade" obrigatorio={doProcesso} erro={erros.modalidade}>
        {Object.entries(MODALIDADES).map(([v, nome]) => <label key={v}><input type="radio" name="modalidade" checked={c.modalidade === v} onChange={() => mudar({ modalidade: v as CamposCompromisso['modalidade'] })} />{nome}</label>)}
      </Escolhas>
      <Campo rotulo="Local" para="local" erro={erros.local} dica="O endereço, a sala ou o link da sala virtual.">
        <input type="text" {...propsDoCampo('local', { dica: true, erro: erros.local })} maxLength={TAMANHO_COMPROMISSO.local} value={c.local} onChange={e => mudar({ local: e.target.value })} />
      </Campo>
    </>,
    pessoas: () => <>
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
      <Campo rotulo="Responsável" para="responsavelId" obrigatorio erro={erros.responsavelId} dica="Quem responde pelo compromisso: qualquer um da equipe.">
        <select {...propsDoCampo('responsavelId', { dica: true, erro: erros.responsavelId })} value={c.responsavelId}
          onChange={e => mudar({ responsavelId: e.target.value, participantes: c.participantes.filter(x => x !== e.target.value) })}>
          <option value="">Escolha…</option>
          {opcoesResp.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
      </Campo>
      <Escolhas rotulo="Participantes" erro={erros.participantes} dica="Quem da equipe também vai (e passa a ver o compromisso).">
        {opcoesPart.length ? opcoesPart.map(m => <label key={m.id}>
          <input type="checkbox" checked={c.participantes.includes(m.id)} onChange={e => marcarParticipante(m.id, e.target.checked)} />{m.nome}
        </label>) : <Nota>Não há mais ninguém na equipe.</Nota>}
      </Escolhas>
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
      {ETAPAS_COMPROMISSO.map(e => <section className="etapa ativa" key={e.id} aria-labelledby={'etapa-' + e.id}>
        <header><h2 id={'etapa-' + e.id}>{e.titulo}</h2></header>
        {CONTEUDO[e.id]()}
      </section>)}
      <RodapeDaEdicao ocupado={ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvar()} />
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
            {ocupado ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar compromisso') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
