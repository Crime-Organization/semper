// Cadastro de pessoa em etapas (também usado para atualizar: /pessoas/nova/?id=...), com busca de CNPJ e CEP,
// controle de duplicidade por CPF/CNPJ (oferece atualizar o cadastro existente) e aviso de telefone repetido. Aberto pelo
// "+ Nova pessoa" de um cartão (?demanda=, ?processo=, ?vinculo_com=…; veja regras/origemDaPessoa.ts, #376), ao terminar liga a
// pessoa ao item de origem e volta ao cartão dele; com o CPF/CNPJ já cadastrado, oferece ligar a pessoa que já existe.
import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { SD, type DadosPessoa, type Pessoa, type PessoaResumida, type TipoPessoa } from '../dados';
import { AvisoAoSair } from '../ui/AvisoAoSair';
import { ordemNoFim } from '../ui/quadro/posicao';
import { contratoDaPessoaFechada } from './clienteAoContrato';
import {
  cnpjValido, dig, ehIndividual, ENTIDADES, faltaNoveCelular, fmtCEP, fmtCNPJ,
  fmtCPF, fmtData, fmtTelefone, lerData, limparDocumento, MASCARAS, telefoneNormal, UFS, variantesTelefone
} from '../regras/pessoa';
import { consultarCEP, consultarCNPJ } from '../dados/consultas';
import { avisar, falha, feito } from '../ui/avisos';
import {
  ACOES_DO_EXISTENTE, AVISO_SEM_ORIGEM, cadastradaNaOrigem, casoDoExistente, existenteNaOrigem, faixaDaOrigem, jaEstavaNaOrigem, lerOrigem, naoLigouNaOrigem,
  ORIGEM_DA_PESSOA, TEXTO_DO_EXISTENTE, type EscolhaDoExistente, type Origem, type SemOrigem
} from '../regras/origemDaPessoa';
import { ligarEAvisar, type Desfazer } from './ligarNoCartao';
import { lerItemDeOrigem, type ItemDeOrigem } from './novaPessoa/origem';
import { enviarParaPlanilhaAntiga, lembrarDeApagarNaPlanilha } from '../improvisos/planilhaAntiga'; // PROVISORIO-219
import { Icone } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { subirAoCadastro, useTitulo } from '../ui/util';
import { RodapeDaEdicao, type EdicaoNoCartao } from '../ui/AcoesDoCartao';
import { Aviso, CampoData, Carregando, estiloBotao, idsDoCampoDeVarios, propsDoCampo, useFocoNoGrupo } from '../ui/base';
import { DOCUMENTO_INVALIDO, fluxo, maiusculas, MSG, type CamposCadastro, type Etapa, type Linha } from '../regras/cadastro';
import { ETAPAS } from './novaPessoa/etapas';
import { FormularioCtx, type Formulario, type ListaDoContato, type OpcoesTexto, type Retorno } from './novaPessoa/formulario';
import './NovaPessoa.css';

type Campos = CamposCadastro;
/** O nome de cada linha das listas do contato para o leitor de tela ("Telefone 2") e o do botão de tirar ("Tirar o telefone 2"). */
const LINHA_DA_LISTA: Record<ListaDoContato, { nome: string; tirar: string }> = {
  telefones: { nome: 'Telefone', tirar: 'Tirar o telefone' },
  emails: { nome: 'E-mail', tirar: 'Tirar o e-mail' }
};

let seq = 0;
const linha = (v = ''): Linha => ({ k: ++seq, v });
export default function NovaPessoa({ edicao }: { edicao?: EdicaoNoCartao } = {}) {
  const ctx = useCtx();
  const navegar = useNavigate();
  /** Marcada logo antes de sair por conta própria: aí o aviso de sair sem salvar não pergunta. */
  const saidaLiberada = useRef(false);
  const [params] = useSearchParams();
  const idAtualizar = edicao?.id ?? params.get('id');
  const etapaInicial = params.get('etapa');
  const membros = ctx.equipe.filter(m => m.ativo);
  // Aberto pelo "+ Nova pessoa" de um cartão (#376): ao terminar, a pessoa fica ligada ao item de origem e a tela volta a ele. A
  // descrição do vínculo vem com a navegação (no estado do histórico), e não no endereço: é texto livre.
  const { state: estadoDaNavegacao } = useLocation();
  const [origem] = useState<Origem | null>(() => edicao || idAtualizar ? null
    : lerOrigem(params, (estadoDaNavegacao as { descricao?: string } | null)?.descricao));
  /** O item de origem já lido, ou por que o cadastro segue sem ligar (não achado, ou arquivado). */
  const [leituraDaOrigem, setLeituraDaOrigem] = useState<ItemDeOrigem | SemOrigem>('sumiu');
  /** O item de origem a ligar (null: o cadastro segue sem ligar). */
  const itemDeOrigemRef = useRef<ItemDeOrigem | null>(null);

  // O estado vive também num ref: as consultas e janelas (assíncronas) sempre leem o valor mais novo.
  const [c, setC] = useState<Campos>(() => ({
    tipo: '', nome: '', cnpjBusca: '', natureza: '', genero: '', nac: '', nacOutra: '', profissao: '', ec: '', cpf: '',
    rg: '', rgExp: '', mae: '', pai: '', nasc: '', nascMun: '', nascUf: '', entidade: '', fantasia: '', porte: '', cnpj: '',
    abertura: '', representantes: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', municipio: '', uf: '',
    telefones: [], emails: [], resp: membros.some(m => m.id === ctx.perfil.id) ? [ctx.perfil.id] : [], lgpdBase: 'contrato', lgpdData: ''
  }));
  const cRef = useRef(c);
  const [alvo, setAlvo] = useState<Pessoa | null>(null);   // pessoa sendo atualizada
  const alvoRef = useRef(alvo);
  const [passo, setPasso] = useState(0);
  const passoRef = useRef(0);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [avisosTel, setAvisosTel] = useState<Record<number, PessoaResumida[]>>({});
  const [noveTel, setNoveTel] = useState<Record<number, string>>({});
  const [retornoCNPJ, setRetornoCNPJ] = useState<Retorno>(null);
  const [retornoCEP, setRetornoCEP] = useState<Retorno>(null);
  const [ocupado, setOcupado] = useState<false | 'validando' | 'salvando'>(false);
  const ocupadoRef = useRef(false);
  const [pronto, setPronto] = useState(!idAtualizar && !origem);
  const botaoAvancar = useRef<HTMLButtonElement>(null);
  const botaoCNPJ = useRef<HTMLButtonElement>(null);
  const botaoCEP = useRef<HTMLButtonElement>(null);
  // Ao tirar um telefone ou um e-mail, o foco vai ao grupo da lista (o botão de tirar some com a linha).
  const gruposDasListas: Record<ListaDoContato, ReturnType<typeof useFocoNoGrupo>> = { telefones: useFocoNoGrupo(), emails: useFocoNoGrupo() };
  const verificacao = useRef<{ doc: string | null; promessa: Promise<boolean> | null }>({ doc: null, promessa: null });
  useTitulo(edicao ? null : alvo ? 'Atualizar cadastro' : 'Cadastro de pessoa');

  // Muda campos (e apaga o erro de cada campo mudado).
  function mudar(campos: Partial<Campos>) {
    cRef.current = { ...cRef.current, ...campos };
    setC(cRef.current);
    const chaves = Object.keys(campos);
    setErros(e => chaves.some(k => k in e) ? Object.fromEntries(Object.entries(e).filter(([k]) => !chaves.includes(k))) : e);
  }
  const mudarTexto = (campo: keyof Campos, valor: string) => mudar({ [campo]: valor } as Partial<Campos>);
  const mudarLista = (campo: 'telefones' | 'emails', valor: Linha[]) => mudar({ [campo]: valor } as Partial<Campos>);
  const marcarErro = (campo: string, texto?: string) => setErros(e => ({ ...e, [campo]: texto || MSG[campo] }));

  // ---------- etapas ----------
  const etapas = fluxo(c);
  const etapa = etapas[Math.min(passo, etapas.length - 1)];
  const total = c.tipo ? etapas.length : 5;
  const ultimo = passo === etapas.length - 1 && !!c.tipo;

  function irPara(i: number) {
    const f = fluxo(cRef.current);
    const novo = Math.max(0, Math.min(i, f.length - 1));
    passoRef.current = novo;
    setPasso(novo);
    const ajustes = ETAPAS[f[novo]].aoEntrar?.(cRef.current, { entidadeDoCadastro: alvoRef.current?.tipo_entidade, novaLinha: () => linha() });
    if (ajustes && Object.keys(ajustes).length) mudar(ajustes);
    subirAoCadastro();
  }
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>('.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select')
      ?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  // ---------- validação ----------
  // Cada etapa sabe se está certa (novaPessoa/etapas.tsx e regras/cadastro.ts); aqui só se aplicam os ajustes,
  // se confere o CPF/CNPJ no banco quando a etapa pede, e se mostram os erros.
  async function validar(e: Etapa) {
    const r = ETAPAS[e].validar(cRef.current);
    if (Object.keys(r.ajustes).length) mudar(r.ajustes);
    let ok = !Object.keys(r.erros).length;
    if (ok && r.documento !== undefined) ok = await verificarDocumento(r.documento);
    // Os campos conferidos agora ficam só com o erro novo (ou sem erro).
    setErros(x => ({ ...Object.fromEntries(Object.entries(x).filter(([k]) => !r.conferidos.includes(k))), ...r.erros }));
    if (Object.keys(r.erros).length) {
      requestAnimationFrame(() => document.querySelector('.etapa.ativa .pergunta.erro')?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
    return ok;
  }

  // ---------- duplicidade ----------
  // A mesma verificação pode ser pedida ao sair do campo e ao avançar: uma só pergunta por documento.
  function verificarDocumento(doc: string) {
    const v = verificacao.current;
    if (v.doc === doc && v.promessa) return v.promessa;
    const promessa = conferirDocumento(doc).then(ok => { if (!ok) verificacao.current = { doc: null, promessa: null }; return ok; });
    verificacao.current = { doc, promessa };
    return promessa;
  }

  // CPF/CNPJ já cadastrado: oferece atualizar o cadastro existente com os dados desta tela.
  async function conferirDocumento(doc: string) {
    const atual = alvoRef.current;
    if (!doc || (atual && atual.documento === doc)) return true;
    let ex: PessoaResumida | null;
    try { ex = await SD.pessoaPorDocumento(doc, atual?.id); }
    catch (e) { falha(e); return false; }
    if (!ex) return true;
    const rotulo = doc.length === 14 ? 'CNPJ' : 'CPF';
    if (atual) {
      const v = await janela({
        titulo: `${rotulo} já cadastrado`,
        corpo: <p>Já existe outro cadastro com este {rotulo}: <b>{ex.nome}</b> ({ex.codigo}). Dois cadastros não podem ter o mesmo documento.</p>,
        acoes: [{ rotulo: 'Ver o outro cadastro', valor: 'ver' }, { rotulo: 'Corrigir', valor: null, tipo: 'pri' }]
      });
      if (v === 'ver') { saidaLiberada.current = true; navegar('/pessoas/?id=' + ex.id); }
      return false;
    }
    // Aberto por um cartão: a pessoa ativa que já existe pode ir para o item de origem como está (#376), sem passar pelo resto do
    // cadastro; a arquivada, só atualizando o cadastro (que a devolve às ativas). Os casos ficam em regras/origemDaPessoa.ts.
    const item = itemDeOrigemRef.current;
    const caso = casoDoExistente(!!(item && origem), !!ex.arquivado_em);
    const ligada = item && origem ? ORIGEM_DA_PESSOA[origem.modulo].ligada(item.nome) : '';
    const escolha = await janela<EscolhaDoExistente>({
      titulo: 'Cadastro já existente',
      corpo: <>
        <p>Já existe um cadastro com este {rotulo}: <b>{ex.nome}</b> ({ex.codigo}){ex.arquivado_em ? ', que está arquivado' : ''}.</p>
        {TEXTO_DO_EXISTENTE[caso](ligada, !!ex.arquivado_em).map(t => <p key={t}>{t}</p>)}
      </>,
      acoes: ACOES_DO_EXISTENTE[caso]
    });
    if (escolha === 'ver') { saidaLiberada.current = true; navegar('/pessoas/?id=' + ex.id); return false; }
    if (escolha === 'ligar' && item && origem) {
      await ligarEAvisar(() => item.ligar(ex.id), { feito: existenteNaOrigem(origem.modulo, item.nome), oQue: 'ligação da pessoa', ja: jaEstavaNaOrigem(origem.modulo, item.nome) },
        () => { saidaLiberada.current = true; navegar(item.endereco, { replace: true }); });
      return false;
    }
    if (escolha !== 'atualizar') return false;
    try { await entrarAtualizacao(ex.id, true); }
    catch (e) { falha(e); return false; }
    return true;
  }

  // Celular antigo, sem o 9: o campo já fica corrigido, com um aviso de como estava.
  function completarCelular(k: number, valor: string) {
    if (!faltaNoveCelular(valor)) { setNoveTel(a => ({ ...a, [k]: '' })); return valor; }
    const novo = fmtTelefone(valor);
    mudarLista('telefones', cRef.current.telefones.map(y => y.k === k ? { ...y, v: novo } : y));
    setNoveTel(a => ({ ...a, [k]: valor }));
    return novo;
  }

  // Telefone repetido: só avisa, sem impedir. Procura com e sem o 9 (cadastros antigos podem estar sem ele).
  async function conferirTelefone(k: number, valor: string) {
    const t = variantesTelefone(valor);
    setAvisosTel(a => ({ ...a, [k]: [] }));
    if (t[0].length < 10) return;
    try {
      const achados = await SD.pessoasPorTelefones(t, alvoRef.current?.id);
      if (achados.length) setAvisosTel(a => ({ ...a, [k]: achados }));
    } catch { /* o aviso não é essencial */ }
  }

  // ---------- consultas ----------
  async function buscarCNPJ() {
    const d = limparDocumento(cRef.current.cnpjBusca);
    if (!cnpjValido(d)) { marcarErro('cnpjBusca', d ? DOCUMENTO_INVALIDO.CNPJ : 'Informe o CNPJ.'); return; }
    if (!(await verificarDocumento(d))) return;
    try {
      const x = await consultarCNPJ(d);
      const n: Partial<Campos> = { nome: x.nome || cRef.current.nome, cnpj: fmtCNPJ(d) };
      if (x.natureza) n.natureza = x.natureza;
      if (x.nome_fantasia) n.fantasia = x.nome_fantasia;
      if (x.porte) n.porte = x.porte;
      if (x.abertura) n.abertura = fmtData(x.abertura);
      if (x.representantes) n.representantes = x.representantes;
      if (x.tipo_entidade) n.entidade = x.tipo_entidade;
      if (x.cep) n.cep = fmtCEP(x.cep);
      for (const k of ['logradouro', 'numero', 'complemento', 'bairro', 'municipio'] as const) if (x[k]) n[k] = x[k];
      if (x.uf) n.uf = x.uf;
      if (x.telefones.length) n.telefones = x.telefones.map(t => linha(t));
      if (x.emails.length) n.emails = x.emails.map(t => linha(t));
      mudar(n);
      setRetornoCNPJ({ tipo: 'ok', conteudo: <>Encontrado: <b>{x.nome}</b>{x.tipo_entidade ? ' · ' + x.tipo_entidade : ''}. Confira os dados nos próximos passos.</> });
    } catch (e) {
      setRetornoCNPJ({ tipo: 'erro', conteudo: (e as Error).message + ' Você pode preencher manualmente.' });
    }
  }

  async function buscarCEP() {
    try {
      const x = await consultarCEP(cRef.current.cep);
      const n: Partial<Campos> = {};
      for (const k of ['logradouro', 'bairro', 'municipio'] as const) if (x[k]) n[k] = x[k];
      if (x.uf) n.uf = x.uf;
      mudar(n);
      setRetornoCEP({ tipo: 'ok', conteudo: 'Endereço preenchido. Informe o número e o complemento, se houver.' });
      setTimeout(() => document.getElementById('numero')?.focus(), 0);
    } catch (e) { setRetornoCEP({ tipo: 'erro', conteudo: (e as Error).message }); }
  }

  // ---------- preencher (atualização) ----------
  // soVazios: ao atualizar um cadastro achado pelo CPF/CNPJ, o que já foi digitado nesta tela prevalece.
  function preencher(p: Pessoa, soVazios: boolean) {
    const a = cRef.current, n: Partial<Campos> = {};
    const poe = <K extends keyof Campos>(k: K, v: Campos[K] | null | undefined) => {
      if (v === null || v === undefined || v === '') return;
      if (!soVazios || !a[k]) n[k] = v;
    };
    if (!soVazios || !a.tipo) n.tipo = p.tipo;
    poe('nome', p.nome);
    if (p.tipo === 'pj' && p.documento) { poe('cnpjBusca', fmtCNPJ(p.documento)); poe('cnpj', fmtCNPJ(p.documento)); }
    if (p.tipo === 'pf' && p.documento) poe('cpf', fmtCPF(p.documento));
    poe('natureza', p.natureza);
    poe('genero', p.genero);
    if (p.nacionalidade && (!soVazios || !a.nac)) {
      const bra = /^brasileir/i.test(p.nacionalidade);
      n.nac = bra ? 'brasileira' : 'outra';
      if (!bra) n.nacOutra = p.nacionalidade;
    }
    poe('profissao', p.profissao); poe('ec', p.estado_civil); poe('rg', p.rg); poe('rgExp', fmtData(p.rg_expedicao));
    poe('mae', p.nome_mae); poe('pai', p.nome_pai); poe('nasc', fmtData(p.nascimento)); poe('nascMun', p.nascimento_municipio); poe('nascUf', p.nascimento_uf);
    poe('fantasia', p.nome_fantasia); poe('porte', p.porte); poe('abertura', fmtData(p.abertura)); poe('representantes', p.representantes);
    if (p.tipo_entidade && p.natureza) n.entidade = soVazios && a.entidade ? a.entidade : p.tipo_entidade;
    poe('cep', fmtCEP(p.cep)); poe('logradouro', p.logradouro); poe('numero', p.numero); poe('complemento', p.complemento);
    poe('bairro', p.bairro); poe('municipio', p.municipio); poe('uf', p.uf);
    const juntar = (atuais: Linha[], novos: string[], tel: boolean) => {
      const chave = (v: string) => tel ? telefoneNormal(v) : v.toLowerCase();
      const todos = soVazios ? atuais.map(x => x.v.trim()).filter(Boolean) : [];
      novos.forEach(v => { if (!todos.some(x => chave(x) === chave(v))) todos.push(tel ? fmtTelefone(v) : v); });
      return (todos.length ? todos : ['']).map(v => linha(v));
    };
    n.telefones = juntar(a.telefones, p.telefones || [], true);
    n.emails = juntar(a.emails, p.emails || [], false);
    if (p.lgpd_base && (!soVazios || a.lgpdBase === 'contrato')) n.lgpdBase = p.lgpd_base;
    poe('lgpdData', fmtData(p.lgpd_consentimento));
    n.resp = [...new Set([...(soVazios ? a.resp : []), ...(p.resp || []).map(r => r.perfil_id)])];
    mudar(n);
  }

  // No cartão, todas as etapas aparecem de uma vez: cada uma faz logo o ajuste que faria ao entrar (ex.: a linha do telefone).
  function prepararTodas() {
    for (const e of fluxo(cRef.current)) {
      const ajustes = ETAPAS[e].aoEntrar?.(cRef.current, { entidadeDoCadastro: alvoRef.current?.tipo_entidade, novaLinha: () => linha() });
      if (ajustes && Object.keys(ajustes).length) mudar(ajustes);
    }
  }

  async function entrarAtualizacao(id: string, mesclar: boolean) {
    const p = await SD.pessoaObter(id);
    if (!p) throw new Error('Cadastro não encontrado.');
    alvoRef.current = p;
    setAlvo(p);
    preencher(p, mesclar);
  }
  useEffect(() => {
    if (idAtualizar) entrarAtualizacao(idAtualizar, false).then(() => { if (edicao) prepararTodas(); }).catch(falha).finally(() => setPronto(true));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega o cadastro a atualizar uma vez só, ao abrir o formulário
  }, []);
  // Aberto por um cartão: o item de origem, antes de mostrar o formulário (a faixa diz onde a pessoa vai entrar).
  useEffect(() => {
    if (!origem) return;
    lerItemDeOrigem(origem).then(x => { itemDeOrigemRef.current = typeof x === 'string' ? null : x; setLeituraDaOrigem(x); })
      .catch(falha).finally(() => setPronto(true));
  }, [origem]);

  // ---------- coleta e envio ----------
  function coletar(): DadosPessoa {
    const a = cRef.current, t = a.tipo as TipoPessoa;
    const v = (s: string) => s.trim() || null, maius = (s: string) => s.trim().toUpperCase() || null;
    const d: DadosPessoa = { tipo: t, nome: maiusculas(a.nome) };
    const pf = { genero: null, nacionalidade: null, profissao: null, estado_civil: null, rg: null, rg_expedicao: null, nome_mae: null, nome_pai: null, nascimento: null, nascimento_municipio: null, nascimento_uf: null };
    const pj = { natureza: null, tipo_entidade: null, nome_fantasia: null, porte: null, abertura: null, representantes: null };
    if (t === 'pf') {
      Object.assign(d, pj, {
        genero: a.genero || null,
        nacionalidade: a.nac === 'brasileira' ? 'brasileira' : a.nac === 'outra' ? v(a.nacOutra) : null,
        profissao: v(a.profissao), estado_civil: a.ec || null, rg: v(a.rg), rg_expedicao: lerData(a.rgExp),
        nome_mae: maius(a.mae), nome_pai: maius(a.pai), nascimento: lerData(a.nasc),
        nascimento_municipio: v(a.nascMun), nascimento_uf: v(a.nascUf), documento: dig(a.cpf) || null
      });
    } else if (t === 'pj') {
      const nat = a.natureza || null;
      // MEI e empresário individual guardam o gênero do titular, para a concordância da qualificação.
      Object.assign(d, pf, {
        genero: ehIndividual(a.entidade) ? a.genero || null : null,
        natureza: nat, tipo_entidade: nat && ENTIDADES[nat]?.includes(a.entidade) ? a.entidade : null,
        nome_fantasia: maius(a.fantasia), porte: a.porte || null, abertura: lerData(a.abertura),
        representantes: maius(a.representantes), documento: limparDocumento(a.cnpj) || limparDocumento(a.cnpjBusca) || null
      });
    }
    if (t !== 'contato') Object.assign(d, {
      cep: dig(a.cep) || null, logradouro: v(a.logradouro), numero: v(a.numero), complemento: v(a.complemento),
      bairro: v(a.bairro), municipio: v(a.municipio), uf: v(a.uf)
    });
    d.telefones = [...new Set(a.telefones.map(x => fmtTelefone(x.v)).filter(x => dig(x)))];
    d.emails = [...new Set(a.emails.map(x => x.v.trim().toLowerCase()).filter(Boolean))];
    d.lgpd_base = a.lgpdBase || null;
    d.lgpd_consentimento = d.lgpd_base === 'consentimento' ? lerData(a.lgpdData) : null;
    return d;
  }

  async function salvar() {
    let dados: DadosPessoa;
    try { dados = coletar(); } catch (e) { falha(e); return; }
    const resp = cRef.current.resp, atual = alvoRef.current;
    setOcupado('salvando');
    try {
      if (atual) {
        if (atual.arquivado_em) { dados.arquivado_em = null; dados.arquivado_por = null; }
        // Para desfazer: os valores que esta gravação vai trocar e os responsáveis de antes.
        const registro = atual as unknown as Record<string, unknown>;
        const antes = Object.fromEntries(Object.keys(dados).map(k => [k, registro[k] ?? null])) as DadosPessoa;
        const respAntes = (atual.resp || []).map(x => x.perfil_id);
        const r = await SD.pessoaAtualizar(atual.id, dados, resp);
        feito('Cadastro atualizado.', 'atualização do cadastro', async () => {
          await SD.pessoaAtualizar(atual.id, antes, respAntes);
          return { tipo: 'pessoaAtualizada', id: atual.id };
        });
        saidaLiberada.current = true;
        const item = itemDeOrigemRef.current;
        if (edicao) edicao.aoTerminar(true);
        else if (item && origem) {
          // Aberto por um cartão: a pessoa atualizada vai para o item de origem, e a tela volta a ele.
          await ligarEAvisar(() => item.ligar(atual.id), { feito: existenteNaOrigem(origem.modulo, item.nome), oQue: 'ligação da pessoa', ja: jaEstavaNaOrigem(origem.modulo, item.nome) }, () => {});
          navegar(item.endereco, { replace: true });
        } else navegar('/pessoas/?id=' + r.id);
      } else {
        if (etapaInicial) { dados.etapa_id = etapaInicial; dados.etapa_ordem = ordemNoFim(); }
        const r = await SD.pessoaCriar(dados, resp);
        enviarParaPlanilhaAntiga(dados, resp, ctx); // PROVISORIO-219
        // Aberto por um cartão (#376): a pessoa já existe; se a ligação falhar, ela continua cadastrada, e a pessoa fica sabendo.
        const item = itemDeOrigemRef.current;
        let desfazerLigacao: Desfazer | null = null, naoLigou: string | null = null;
        if (item && origem) {
          try { desfazerLigacao = await item.ligar(r.id); }
          catch (e) { naoLigou = naoLigouNaOrigem(origem.modulo, item.nome, (e as Error).message); }
        }
        // Cadastrada direto em "Contrato fechado", ela ganha um contrato: desfazer o cadastro apaga o contrato também
        // (a pessoa com contrato não pode ser excluída). A ligação ao item de origem sai antes.
        let contratoNascido: string | null = null;
        feito(item && origem && !naoLigou ? cadastradaNaOrigem(origem.modulo, item.nome) : 'Pessoa cadastrada.', 'cadastro da pessoa', async () => {
          if (desfazerLigacao) await desfazerLigacao();
          if (contratoNascido) { await SD.contratosArquivar([contratoNascido], true); await SD.contratosExcluir([contratoNascido]); }
          await SD.pessoasArquivar([r.id], true);
          const x = await SD.pessoasExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          lembrarDeApagarNaPlanilha(ctx); // PROVISORIO-219
          return { tipo: 'pessoaCriada', id: r.id };
        });
        if (naoLigou) avisar(naoLigou, 'erro');
        saidaLiberada.current = true;
        // De volta ao cartão de origem, no lugar do cadastro: o Voltar do navegador não reabre o formulário.
        if (item) navegar(item.endereco, { replace: true }); else navegar('/pessoas/?id=' + r.id);
        // Cadastrada direto em "Contrato fechado": o contrato dela nasce também.
        if (etapaInicial) void SD.colunasListar('pessoas').then(colunas => contratoDaPessoaFechada({ id: r.id, nome: dados.nome ?? '' }, etapaInicial, colunas, navegar))
          .then(k => { if (k?.novo) contratoNascido = k.id; });
      }
    } catch (e) {
      falha(e);
      setOcupado(false);
    }
  }

  async function avancar() {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado('validando');
    const ok = await validar(fluxo(cRef.current)[passoRef.current]);
    setOcupado(false);
    ocupadoRef.current = false;
    if (!ok) return;
    if (passoRef.current === fluxo(cRef.current).length - 1 && cRef.current.tipo) return salvar();
    irPara(passoRef.current + 1);
  }

  // No cartão: confere todas as etapas, na ordem (a primeira com erro mostra o erro), e só então salva.
  async function salvarTudo() {
    if (ocupadoRef.current) return;
    ocupadoRef.current = true;
    setOcupado('validando');
    let ok = true;
    for (const e of fluxo(cRef.current)) if (!(ok = await validar(e))) break;
    setOcupado(false);
    ocupadoRef.current = false;
    if (ok) await salvar();
  }

  // Enter: vai para o próximo campo da etapa ou para a próxima etapa.
  function teclar(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target as HTMLElement;
    if (e.key !== 'Enter' || el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return;
    e.preventDefault();
    if (el.id === 'cep') { botaoCEP.current?.click(); return; }
    if (el.id === 'cnpjBusca') { botaoCNPJ.current?.click(); return; }
    const campos = [...document.querySelectorAll<HTMLElement>('.etapa.ativa input:not([type="radio"]):not([type="checkbox"]):not([hidden]), .etapa.ativa select')]
      .filter(x => x.offsetParent !== null);
    const i = campos.indexOf(el);
    if (i >= 0 && i < campos.length - 1) campos[i + 1].focus(); else botaoAvancar.current?.click();
  }

  // ---------- pedaços do formulário ----------
  const erroDe = (campo: string) => erros[campo];
  const texto = (campo: keyof Campos, props: OpcoesTexto = {}) =>
    <input type="text" {...propsDoCampo(campo, { dica: true, erro: erros[campo] })} className={props.maiusculas ? 'caixa-alta' : undefined} maxLength={props.maximo} placeholder={props.placeholder}
      inputMode={props.numerico ? 'numeric' : undefined} value={c[campo] as string}
      onChange={e => mudarTexto(campo, props.mascara ? MASCARAS[props.mascara](e.target.value) : e.target.value)}
      onBlur={() => { if (props.maiusculas) mudarTexto(campo, maiusculas(cRef.current[campo] as string)); props.aoSair?.(); }} />;
  // As datas do cadastro com o calendário pequeno (#357): a mesma máscara dd/mm/aaaa, e o texto continua a ser conferido ao seguir.
  const data = (campo: keyof Campos) => <CampoData {...propsDoCampo(campo, { dica: true, erro: erros[campo] })} valor={c[campo] as string} aoMudar={v => mudarTexto(campo, v)} />;
  const radios = (nome: keyof Campos, opcoes: [string, string][], aoEscolher?: (v: string) => void) => opcoes.map(([v, t]) =>
    <label key={v}><input type="radio" name={nome} value={v} checked={c[nome] === v} onChange={() => { mudarTexto(nome, v); aoEscolher?.(v); }} />{t}</label>);
  const ufs = (campo: keyof Campos) => <select id={campo} value={c[campo] as string} onChange={e => mudarTexto(campo, e.target.value)}>
    <option value="">—</option>{UFS.map(u => <option key={u}>{u}</option>)}
  </select>;
  // Cada linha aponta para a dica e o erro do grupo (os ids de idsDoCampoDeVarios, com o nome da lista como base):
  // voltando a uma linha depois do erro, o leitor de tela lê de novo a mensagem.
  const descricaoDaLinha = (campo: ListaDoContato, tel: boolean) => {
    const ids = idsDoCampoDeVarios(campo);
    return [tel ? ids.dica : '', erros[campo] ? ids.erro : ''].filter(Boolean).join(' ') || undefined;
  };
  const tirarDaLista = (campo: ListaDoContato, k: number) => {
    mudarLista(campo, cRef.current[campo].filter(y => y.k !== k));
    gruposDasListas[campo].focarNoGrupo();
  };
  const lista = (campo: ListaDoContato, tel: boolean) => <div className="lista-tel">
    {c[campo].map((x, i) => <div className="item-lista" key={x.k}>
      <div className="linha-campo">
        <input type={tel ? 'tel' : 'email'} className={tel ? 'tel' : 'email'} inputMode={tel ? 'tel' : undefined}
          aria-label={c[campo].length === 1 ? LINHA_DA_LISTA[campo].nome : `${LINHA_DA_LISTA[campo].nome} ${i + 1}`}
          aria-invalid={erros[campo] ? true : undefined} aria-describedby={descricaoDaLinha(campo, tel)}
          placeholder={tel ? '(00) 00000-0000' : 'email@exemplo.com'} value={x.v}
          onChange={e => mudarLista(campo, cRef.current[campo].map(y => y.k === x.k ? { ...y, v: tel ? MASCARAS.telefone(e.target.value) : e.target.value } : y))}
          onBlur={tel ? e => conferirTelefone(x.k, completarCelular(x.k, e.target.value)) : undefined} />
        {i > 0 && <button type="button" className="icone-btn" aria-label={`${LINHA_DA_LISTA[campo].tirar} ${i + 1}`} onClick={() => tirarDaLista(campo, x.k)}><Icone nome="fechar" tam={15} /></button>}
      </div>
      {tel && noveTel[x.k] && <div className="aviso-tel">Acrescentei o 9 do celular (estava {noveTel[x.k]}).</div>}
      {tel && (avisosTel[x.k]?.length ?? 0) > 0 && <div className="aviso-tel">Já existe cadastro com este telefone: {avisosTel[x.k].map((a, j) =>
        <Fragment key={a.id}>{j > 0 && ', '}<a href={'/pessoas/?id=' + a.id} target="_blank" rel="noopener">{a.nome}</a></Fragment>)}. Você pode seguir normalmente.</div>}
    </div>)}
  </div>;
  const acrescentar = (campo: ListaDoContato) => {
    mudarLista(campo, [...cRef.current[campo], linha()]);
    setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>(campo === 'telefones' ? '.lista-tel .tel' : '.lista-tel .email'); els[els.length - 1]?.focus(); }, 0);
  };
  const retorno = (r: Retorno) => r && <Aviso tipo={r.tipo} className="retorno">{r.conteudo}</Aviso>;

  const pj = c.tipo === 'pj';
  const voltarLista = idAtualizar ? '/pessoas/?id=' + idAtualizar : '/pessoas/';
  const formulario: Formulario = {
    c, cRef, pj, mudar, marcarErro, verificarDocumento, buscarCNPJ, buscarCEP, retornoCNPJ, retornoCEP, botaoCNPJ, botaoCEP, botaoAvancar,
    equipe: ctx.equipe, erroDe, texto, data, radios, ufs, lista, acrescentar, grupoDe: campo => gruposDasListas[campo].grupo, retorno, nivel: edicao ? 3 : 2
  };
  const Atual = ETAPAS[etapa].Componente;

  // No cartão (o lápis): todas as etapas de uma vez, com Cancelar e Salvar no pé.
  if (edicao) return !pronto ? <Carregando />
    : !alvo ? <Aviso tipo="erro">Não foi possível abrir para editar. Feche e tente de novo.</Aviso>
    : <form className="edicao-cartao" noValidate autoComplete="off" aria-label="Editar cadastro" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
      <FormularioCtx.Provider value={formulario}>{etapas.map(e => { const Componente = ETAPAS[e].Componente; return <Componente key={e} />; })}</FormularioCtx.Provider>
      <RodapeDaEdicao estado={{ c }} ocupado={!!ocupado} aoCancelar={() => edicao.aoTerminar(false)} aoSalvar={() => void salvarTudo()} />
    </form>;

  return <div className="passos">
    <AvisoAoSair estado={{ c }} liberada={saidaLiberada} ocupado={ocupado === 'salvando'} />
    <header>
      <p className="olho"><Link to={voltarLista}>Pessoas</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar cadastro' : 'Nova pessoa'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <Aviso tipo="info" className="faixa-atualizar">Você está atualizando o cadastro de <b>{alvo.nome}</b> ({alvo.codigo}). As informações anteriores ficam guardadas no histórico.</Aviso>}
    {origem && pronto && (typeof leituraDaOrigem === 'string'
      ? <Aviso tipo="erro" className="faixa-atualizar">{AVISO_SEM_ORIGEM[leituraDaOrigem]}</Aviso>
      : <Aviso tipo="info" className="faixa-atualizar">{faixaDaOrigem(origem.modulo, leituraDaOrigem.nome)}</Aviso>)}
    {!pronto ? <Carregando /> : <>
      <div className="passos-topo">
        <span>Passo {passo + 1} de {total}</span>
        <div className="progresso"><i style={{ width: Math.round(100 * passo / Math.max(1, total - 1)) + '%' }} /></div>
      </div>

      <form noValidate autoComplete="off" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
        <FormularioCtx.Provider value={formulario}><Atual key={etapa} /></FormularioCtx.Provider>

        <div className="navegar">
          <button type="button" className={estiloBotao()} style={{ visibility: passo === 0 ? 'hidden' : 'visible' }} onClick={() => irPara(passoRef.current - 1)}>Voltar</button>
          <button type="button" className={estiloBotao({ variante: 'principal' })} ref={botaoAvancar} disabled={!!ocupado} onClick={avancar}>
            {ocupado === 'salvando' ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar cadastro') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
