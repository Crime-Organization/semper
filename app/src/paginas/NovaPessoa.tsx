// Cadastro de pessoa em etapas (também usado para atualizar: /pessoas/nova/?id=...), com busca de CNPJ e CEP,
// controle de duplicidade por CPF/CNPJ (oferece atualizar o cadastro existente) e aviso de telefone repetido.
import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { SD, type DadosPessoa, type Pessoa, type PessoaResumida, type TipoPessoa } from '../dados';
import { ordemNoFim } from '../ui/quadro/posicao';
import {
  cnpjValido, cpfValido, dig, ehIndividual, emailValido, ENTIDADES, ESTADO_CIVIL, faltaNoveCelular, fmtCEP, fmtCNPJ,
  fmtCPF, fmtData, fmtTelefone, lerData, LGPD, MASCARAS, NATUREZAS, PORTES, telefoneNormal, UFS, variantesTelefone
} from '../regras/pessoa';
import { consultarCEP, consultarCNPJ } from '../dados/consultas';
import { falha, feito } from '../ui/avisos';
import { Botao } from '../ui/Botoes';
import { Icone } from '../ui/Icone';
import { janela } from '../ui/janela';
import { useCtx } from '../ui/sessao';
import { useTitulo } from '../ui/util';
import './NovaPessoa.css';

type Etapa = 's-tipo' | 's-ident' | 's-pf' | 's-entidade' | 's-empresa' | 's-endereco' | 's-contato';
interface Linha { k: number; v: string }
interface Campos {
  tipo: '' | TipoPessoa;
  nome: string; cnpjBusca: string; natureza: string;
  genero: string; nac: '' | 'brasileira' | 'outra'; nacOutra: string; profissao: string; ec: string; cpf: string;
  rg: string; rgExp: string; mae: string; pai: string; nasc: string; nascMun: string; nascUf: string;
  entidade: string; fantasia: string; porte: string; cnpj: string; abertura: string; representantes: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; municipio: string; uf: string;
  telefones: Linha[]; emails: Linha[]; resp: string[]; lgpdBase: string; lgpdData: string;
}
type Retorno = { tipo: 'ok' | 'erro'; conteudo: ReactNode } | null;

const MSG: Record<string, string> = {
  tipo: 'Selecione o tipo de cadastro.', nome: 'Informe o nome.', cnpjBusca: 'Informe um CNPJ válido.',
  genero: 'Selecione o gênero (usado na concordância da qualificação).', cpf: 'Informe um CPF válido.', rgExp: 'Data inválida.',
  nasc: 'Data inválida.', cnpj: 'Informe um CNPJ válido.', abertura: 'Data inválida.', cep: 'O CEP tem 8 dígitos.',
  telefones: 'Informe pelo menos um telefone com DDD.', emails: 'Confira o formato do e-mail.', lgpdData: 'Data inválida.'
};

let seq = 0;
const linha = (v = ''): Linha => ({ k: ++seq, v });
const maiusculas = (v: string) => v.toUpperCase().replace(/\s+/g, ' ').trim();

function fluxo(c: Campos): Etapa[] {
  if (c.tipo === 'pf') return ['s-tipo', 's-ident', 's-pf', 's-endereco', 's-contato'];
  if (c.tipo === 'pj') return ['s-tipo', 's-ident', ...(c.natureza ? ['s-entidade' as const] : []), 's-empresa', 's-endereco', 's-contato'];
  if (c.tipo === 'contato') return ['s-tipo', 's-ident', 's-contato'];
  return ['s-tipo'];
}

export default function NovaPessoa() {
  const ctx = useCtx();
  const navegar = useNavigate();
  const [params] = useSearchParams();
  const idAtualizar = params.get('id');
  const etapaInicial = params.get('etapa');
  const membros = ctx.equipe.filter(m => m.ativo);

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
  const [pronto, setPronto] = useState(!idAtualizar);
  const botaoAvancar = useRef<HTMLButtonElement>(null);
  const botaoCNPJ = useRef<HTMLButtonElement>(null);
  const botaoCEP = useRef<HTMLButtonElement>(null);
  const verificacao = useRef<{ doc: string | null; promessa: Promise<boolean> | null }>({ doc: null, promessa: null });
  useTitulo(alvo ? 'Atualizar cadastro' : 'Cadastro de pessoa');

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
    const a = cRef.current;
    if (f[novo] === 's-entidade') {
      const lista = ENTIDADES[a.natureza] || [];
      const t = alvoRef.current?.tipo_entidade;
      if (!lista.includes(a.entidade)) mudar({ entidade: t && lista.includes(t) ? t : '' });
    }
    if (f[novo] === 's-contato') {
      if (!a.telefones.length) mudar({ telefones: [linha()] });
      if (!cRef.current.emails.length) mudar({ emails: [linha()] });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLElement>('.etapa.ativa input:not([type="radio"]):not([type="checkbox"]), .etapa.ativa select')
      ?.focus({ preventScroll: true }), 50);
    return () => clearTimeout(t);
  }, [passo, pronto]);

  // ---------- validação ----------
  function dataOk(valor: string, campo: string, novos: Record<string, string>) {
    try { lerData(valor); return true; }
    catch (e) { novos[campo] = (e as Error).message; return false; }
  }

  async function validar(e: Etapa) {
    const novos: Record<string, string> = {}, conferidos: string[] = ['rgExp', 'nasc', 'abertura', 'lgpdData'];
    let ok = true;
    const marcar = (campo: string, cond: boolean, texto?: string) => { conferidos.push(campo); if (!cond) { novos[campo] = texto || MSG[campo]; ok = false; } };
    let a = cRef.current;
    if (e === 's-tipo') marcar('tipo', !!a.tipo);
    if (e === 's-ident') {
      mudar({ nome: maiusculas(a.nome) });
      a = cRef.current;
      marcar('nome', !!a.nome);
      if (a.tipo === 'pj') {
        const d = dig(a.cnpjBusca);
        marcar('cnpjBusca', cnpjValido(d), d ? 'CNPJ inválido: confira os números.' : 'Informe o CNPJ.');
        if (ok) { if (!a.cnpj) mudar({ cnpj: fmtCNPJ(d) }); ok = await verificarDocumento(d); }
      }
    }
    if (e === 's-pf') {
      marcar('genero', !!a.genero);
      const d = dig(a.cpf);
      marcar('cpf', cpfValido(d), d ? 'CPF inválido: confira os números.' : 'Informe o CPF.');
      ok = dataOk(a.rgExp, 'rgExp', novos) && ok;
      ok = dataOk(a.nasc, 'nasc', novos) && ok;
      if (ok) ok = await verificarDocumento(d);
    }
    if (e === 's-empresa') {
      if (ehIndividual(a.entidade)) marcar('genero', !!a.genero, 'Selecione o gênero do(a) titular (usado na concordância da qualificação).');
      const d = dig(a.cnpj);
      marcar('cnpj', cnpjValido(d), d ? 'CNPJ inválido: confira os números.' : 'Informe o CNPJ.');
      ok = dataOk(a.abertura, 'abertura', novos) && ok;
      if (ok) ok = await verificarDocumento(d);
    }
    if (e === 's-endereco') { const cep = dig(a.cep); marcar('cep', !cep || cep.length === 8); }
    if (e === 's-contato') {
      const tels = a.telefones.map(t => dig(t.v)).filter(Boolean);
      marcar('telefones', tels.length > 0 && tels.every(t => t.length >= 10 && t.length <= 13), tels.length ? 'Confira os telefones: use DDD + número.' : undefined);
      marcar('emails', a.emails.map(x => x.v.trim()).filter(Boolean).every(emailValido));
      if (a.lgpdBase === 'consentimento') ok = dataOk(a.lgpdData, 'lgpdData', novos) && ok;
    }
    // Os campos conferidos agora ficam só com o erro novo (ou sem erro).
    setErros(x => ({ ...Object.fromEntries(Object.entries(x).filter(([k]) => !conferidos.includes(k))), ...novos }));
    if (Object.keys(novos).length) {
      ok = false;
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
      if (v === 'ver') navegar('/pessoas/?id=' + ex.id);
      return false;
    }
    const escolha = await janela({
      titulo: 'Cadastro já existente',
      corpo: <>
        <p>Já existe um cadastro com este {rotulo}: <b>{ex.nome}</b> ({ex.codigo}){ex.arquivado_em ? ', que está arquivado' : ''}.</p>
        <p>Deseja atualizar as informações dessa pessoa com os dados desta tela? O que ela já tem e você não preencher aqui é mantido, e os dados anteriores ficam no histórico.{ex.arquivado_em ? ' O cadastro volta para as ativas.' : ''}</p>
      </>,
      acoes: [{ rotulo: 'Ver cadastro existente', valor: 'ver' }, { rotulo: 'Cancelar', valor: null }, { rotulo: 'Atualizar este cadastro', valor: 'atualizar', tipo: 'pri' }]
    });
    if (escolha === 'ver') { navegar('/pessoas/?id=' + ex.id); return false; }
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
    const d = dig(cRef.current.cnpjBusca);
    if (!cnpjValido(d)) { marcarErro('cnpjBusca', d ? 'CNPJ inválido: confira os números.' : 'Informe o CNPJ.'); return; }
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
      setRetornoCNPJ({ tipo: 'ok', conteudo: <>Encontrado: <b>{x.nome}</b>{x.tipo_entidade ? ' · ' + x.tipo_entidade : ''}. Confira os dados nas próximas etapas.</> });
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

  async function entrarAtualizacao(id: string, mesclar: boolean) {
    const p = await SD.pessoaObter(id);
    if (!p) throw new Error('Cadastro não encontrado.');
    alvoRef.current = p;
    setAlvo(p);
    preencher(p, mesclar);
  }
  useEffect(() => {
    if (idAtualizar) entrarAtualizacao(idAtualizar, false).catch(falha).finally(() => setPronto(true));
  // oxlint-disable-next-line react/exhaustive-deps -- carrega o cadastro a atualizar uma vez só, ao abrir o formulário
  }, []);

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
        representantes: maius(a.representantes), documento: dig(a.cnpj) || dig(a.cnpjBusca) || null
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
        navegar('/pessoas/?id=' + r.id);
      } else {
        if (etapaInicial) { dados.etapa_id = etapaInicial; dados.etapa_ordem = ordemNoFim(); }
        const r = await SD.pessoaCriar(dados, resp);
        feito('Pessoa cadastrada.', 'cadastro da pessoa', async () => {
          await SD.pessoasArquivar([r.id], true);
          const x = await SD.pessoasExcluir([r.id]);
          if (!x.excluidas) throw new Error(x.motivo || 'Não foi possível desfazer o cadastro.');
          return { tipo: 'pessoaCriada', id: r.id };
        });
        navegar('/pessoas/?id=' + r.id);
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
  const pc = (campo: string, extra = '') => 'pergunta' + (erros[campo] ? ' erro' : '') + (extra ? ' ' + extra : '');
  const erro = (campo: string) => <span className="msg-erro">{erros[campo] || MSG[campo]}</span>;
  const texto = (campo: keyof Campos, props: { maximo?: number; maiusculas?: boolean; mascara?: keyof typeof MASCARAS; placeholder?: string; numerico?: boolean; aoSair?: () => void } = {}) =>
    <input type="text" id={campo} className={props.maiusculas ? 'caixa-alta' : undefined} maxLength={props.maximo} placeholder={props.placeholder}
      inputMode={props.numerico ? 'numeric' : undefined} value={c[campo] as string}
      onChange={e => mudarTexto(campo, props.mascara ? MASCARAS[props.mascara](e.target.value) : e.target.value)}
      onBlur={() => { if (props.maiusculas) mudarTexto(campo, maiusculas(cRef.current[campo] as string)); props.aoSair?.(); }} />;
  const data = (campo: keyof Campos) => texto(campo, { mascara: 'data', placeholder: 'DD/MM/AAAA', numerico: true });
  const radios = (nome: keyof Campos, opcoes: [string, string][], aoEscolher?: (v: string) => void) => opcoes.map(([v, t]) =>
    <label key={v}><input type="radio" name={nome} value={v} checked={c[nome] === v} onChange={() => { mudarTexto(nome, v); aoEscolher?.(v); }} />{t}</label>);
  const ufs = (campo: keyof Campos) => <select id={campo} value={c[campo] as string} onChange={e => mudarTexto(campo, e.target.value)}>
    <option value="">—</option>{UFS.map(u => <option key={u}>{u}</option>)}
  </select>;
  const lista = (campo: 'telefones' | 'emails', tel: boolean) => <div className="lista-tel">
    {c[campo].map((x, i) => <div className="item-lista" key={x.k}>
      <div className="linha-campo">
        <input type={tel ? 'tel' : 'email'} className={tel ? 'tel' : 'email'} inputMode={tel ? 'tel' : undefined} aria-label={tel ? 'Telefone' : 'E-mail'}
          placeholder={tel ? '(00) 00000-0000' : 'email@exemplo.com'} value={x.v}
          onChange={e => mudarLista(campo, cRef.current[campo].map(y => y.k === x.k ? { ...y, v: tel ? MASCARAS.telefone(e.target.value) : e.target.value } : y))}
          onBlur={tel ? e => conferirTelefone(x.k, completarCelular(x.k, e.target.value)) : undefined} />
        {i > 0 && <button type="button" className="icone-btn" aria-label="Remover" onClick={() => mudarLista(campo, cRef.current[campo].filter(y => y.k !== x.k))}><Icone nome="fechar" tam={15} /></button>}
      </div>
      {tel && noveTel[x.k] && <div className="aviso-tel">Acrescentei o 9 do celular (estava {noveTel[x.k]}).</div>}
      {tel && (avisosTel[x.k]?.length ?? 0) > 0 && <div className="aviso-tel">Já existe cadastro com este telefone: {avisosTel[x.k].map((a, j) =>
        <Fragment key={a.id}>{j > 0 && ', '}<a href={'/pessoas/?id=' + a.id} target="_blank" rel="noopener">{a.nome}</a></Fragment>)}. Você pode seguir normalmente.</div>}
    </div>)}
  </div>;
  const acrescentar = (campo: 'telefones' | 'emails') => {
    mudarLista(campo, [...cRef.current[campo], linha()]);
    setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>(campo === 'telefones' ? '.lista-tel .tel' : '.lista-tel .email'); els[els.length - 1]?.focus(); }, 0);
  };
  const retorno = (r: Retorno) => r && <div className={'retorno aviso ' + r.tipo}>{r.conteudo}</div>;

  const pj = c.tipo === 'pj';
  // Quem pode ser responsável: a equipe ativa e quem já é responsável (mesmo desativado, para não sair sem querer).
  const opcoesResp = [...membros, ...ctx.equipe.filter(m => !m.ativo && c.resp.includes(m.id))];
  const voltarLista = idAtualizar ? '/pessoas/?id=' + idAtualizar : '/pessoas/';

  return <div className="passos">
    <header>
      <p className="olho"><Link to={voltarLista}>Pessoas</Link></p>
      <h1 className="titulo">{alvo ? 'Atualizar cadastro' : 'Nova pessoa'}<span className="ponto">.</span></h1>
    </header>
    {alvo && <div className="aviso info faixa-atualizar">Você está atualizando o cadastro de <b>{alvo.nome}</b> ({alvo.codigo}). As informações anteriores ficam guardadas no histórico.</div>}
    {!pronto ? <p className="carregando">Carregando…</p> : <>
      <div className="passos-topo">
        <span>Etapa {passo + 1} de {total}</span>
        <div className="progresso"><i style={{ width: Math.round(100 * passo / Math.max(1, total - 1)) + '%' }} /></div>
      </div>

      <form noValidate autoComplete="off" onKeyDown={teclar} onSubmit={e => e.preventDefault()}>
        {etapa === 's-tipo' && <section className="etapa ativa" key={etapa}>
          <header><h2>Qual é o tipo de cadastro?</h2></header>
          <div className={pc('tipo')}>
            <span className="rot">Selecione uma opção<span className="req">*</span></span>
            <div className="escolhas">{radios('tipo', [['pf', 'Pessoa física'], ['pj', 'Pessoa jurídica'], ['contato', 'Somente informações de contato']],
              () => setTimeout(() => botaoAvancar.current?.click(), 200))}</div>
            {erro('tipo')}
          </div>
        </section>}

        {etapa === 's-ident' && <section className="etapa ativa" key={etapa}>
          <header><h2>{pj ? 'Dados da empresa' : c.tipo === 'pf' ? 'Dados pessoais' : 'Identificação'}</h2></header>
          <div className={pc('nome')}>
            <label htmlFor="nome">Nome<span className="req">*</span></label>
            <p className="dica">{pj ? 'Razão social, em letras maiúsculas.' : 'Nome completo, em letras maiúsculas.'}</p>
            {texto('nome', { maximo: 200, maiusculas: true })}
            {erro('nome')}
          </div>
          {pj && <>
            <div className={pc('cnpjBusca')}>
              <label htmlFor="cnpjBusca">CNPJ<span className="req">*</span></label>
              <p className="dica">Clique em Buscar para trazer os dados da Receita, ou siga e preencha manualmente.</p>
              <div className="linha-campo">
                {texto('cnpjBusca', { mascara: 'cnpj', placeholder: '00.000.000/0000-00', numerico: true })}
                <Botao className="btn esc" ref={botaoCNPJ} ocupadoTexto="Buscando…" onClick={buscarCNPJ}>Buscar</Botao>
              </div>
              {erro('cnpjBusca')}
              {retorno(retornoCNPJ)}
            </div>
            <div className="pergunta">
              <label htmlFor="natureza">Natureza jurídica</label>
              <select id="natureza" value={c.natureza} onChange={e => {
                const natureza = e.target.value;
                mudar(c.entidade && !ENTIDADES[natureza]?.includes(c.entidade) ? { natureza, entidade: '' } : { natureza });
              }}>
                <option value="">Selecione</option>
                {Object.entries(NATUREZAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </>}
        </section>}

        {etapa === 's-pf' && <section className="etapa ativa" key={etapa}>
          <header><h2>Pessoa física</h2><p>Dados pessoais para a qualificação.</p></header>
          <div className={pc('genero')}>
            <span className="rot">Gênero<span className="req">*</span></span>
            <div className="escolhas">{radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}</div>
            {erro('genero')}
          </div>
          <div className="pergunta">
            <span className="rot">Nacionalidade</span>
            <div className="escolhas">{radios('nac', [['brasileira', 'Brasileira'], ['outra', 'Outra']],
              v => { if (v === 'outra') setTimeout(() => document.getElementById('nacOutra')?.focus(), 0); })}</div>
            {c.nac === 'outra' && texto('nacOutra', { maximo: 60, placeholder: 'Ex.: portuguesa' })}
          </div>
          <div className="pergunta"><label htmlFor="profissao">Profissão</label>{texto('profissao', { maximo: 120 })}</div>
          <div className="pergunta">
            <span className="rot">Estado civil</span>
            <div className="escolhas">{radios('ec', Object.entries(ESTADO_CIVIL).map(([k, v]) => [k, v[2]] as [string, string]))}</div>
          </div>
          <div className={pc('cpf')}>
            <label htmlFor="cpf">CPF<span className="req">*</span></label>
            {texto('cpf', { mascara: 'cpf', placeholder: '000.000.000-00', numerico: true, aoSair: () => {
              const d = dig(cRef.current.cpf);
              if (cpfValido(d)) void verificarDocumento(d); else if (d) marcarErro('cpf', 'CPF inválido: confira os números.');
            } })}
            {erro('cpf')}
          </div>
          <div className="grade-campos">
            <div className="pergunta"><label htmlFor="rg">RG</label><p className="dica">Número, órgão e estado. Ex.: MG 12.345.678 SSP/MG</p>{texto('rg', { maximo: 60 })}</div>
            <div className={pc('rgExp')}><label htmlFor="rgExp">Data de expedição</label><p className="dica">DD/MM/AAAA</p>{data('rgExp')}{erro('rgExp')}</div>
          </div>
          <div className="pergunta"><label htmlFor="mae">Nome da mãe</label>{texto('mae', { maximo: 200, maiusculas: true })}</div>
          <div className="pergunta"><label htmlFor="pai">Nome do pai</label>{texto('pai', { maximo: 200, maiusculas: true })}</div>
          <div className="grade-campos">
            <div className={pc('nasc')}><label htmlFor="nasc">Data de nascimento</label>{data('nasc')}{erro('nasc')}</div>
            <div className="pergunta"><label htmlFor="nascMun">Município de nascimento</label>{texto('nascMun', { maximo: 120 })}</div>
            <div className="pergunta"><label htmlFor="nascUf">UF de nascimento</label>{ufs('nascUf')}</div>
          </div>
        </section>}

        {etapa === 's-entidade' && <section className="etapa ativa" key={etapa}>
          <header><h2>{NATUREZAS[c.natureza] || 'Tipo de entidade'}</h2><p>Em qual tipo a pessoa jurídica se enquadra?</p></header>
          <div className="pergunta"><div className="escolhas coluna-unica">{radios('entidade', (ENTIDADES[c.natureza] || []).map(t => [t, t] as [string, string]))}</div></div>
        </section>}

        {etapa === 's-empresa' && <section className="etapa ativa" key={etapa}>
          <header><h2>Pessoa jurídica</h2><p>Dados da empresa ou entidade.</p></header>
          {ehIndividual(c.entidade) && <div className={pc('genero')}>
            <span className="rot">Gênero do(a) titular<span className="req">*</span></span>
            <p className="dica">No MEI e no empresário individual, a empresa é a própria pessoa: a qualificação concorda com ela (empresário ou empresária, inscrito ou inscrita).</p>
            <div className="escolhas">{radios('genero', [['m', 'Masculino'], ['f', 'Feminino']])}</div>
            {erro('genero')}
          </div>}
          <div className="pergunta"><label htmlFor="fantasia">Nome fantasia</label>{texto('fantasia', { maximo: 200, maiusculas: true })}</div>
          <div className="pergunta">
            <span className="rot">Porte</span>
            <p className="dica">Nos casos de MEI, não é preciso marcar.</p>
            <div className="escolhas">{radios('porte', Object.entries(PORTES))}</div>
          </div>
          <div className="grade-campos">
            <div className={pc('cnpj')}>
              <label htmlFor="cnpj">CNPJ<span className="req">*</span></label>
              {texto('cnpj', { mascara: 'cnpj', placeholder: '00.000.000/0000-00', numerico: true, aoSair: () => {
                const d = dig(cRef.current.cnpj);
                if (cnpjValido(d)) void verificarDocumento(d); else if (d) marcarErro('cnpj', 'CNPJ inválido: confira os números.');
              } })}
              {erro('cnpj')}
            </div>
            <div className={pc('abertura')}><label htmlFor="abertura">Data de abertura</label>{data('abertura')}{erro('abertura')}</div>
          </div>
          <div className="pergunta"><label htmlFor="representantes">Representante(s) legal(is)</label>
            <p className="dica">Nome completo. Havendo mais de um, separe com "e/ou". Em MEI ou empresário individual, deixe em branco.</p>
            {texto('representantes', { maximo: 400, maiusculas: true })}</div>
        </section>}

        {etapa === 's-endereco' && <section className="etapa ativa" key={etapa}>
          <header><h2>Endereço</h2></header>
          <div className={pc('cep')}>
            <label htmlFor="cep">CEP</label>
            <p className="dica">Clique em Buscar para preencher o endereço.</p>
            <div className="linha-campo">
              {texto('cep', { mascara: 'cep', placeholder: '00000-000', numerico: true })}
              <Botao className="btn esc" ref={botaoCEP} ocupadoTexto="Buscando…" onClick={buscarCEP}>Buscar</Botao>
            </div>
            {erro('cep')}
            {retorno(retornoCEP)}
          </div>
          <div className="pergunta"><label htmlFor="logradouro">Logradouro</label><p className="dica">Rua, avenida, fazenda etc.</p>{texto('logradouro', { maximo: 200 })}</div>
          <div className="grade-campos">
            <div className="pergunta"><label htmlFor="numero">Número</label><p className="dica">Sem número: S/N</p>{texto('numero', { maximo: 20 })}</div>
            <div className="pergunta"><label htmlFor="complemento">Complemento</label><p className="dica">Apto, sala, bloco…</p>{texto('complemento', { maximo: 120 })}</div>
          </div>
          <div className="pergunta"><label htmlFor="bairro">Bairro</label>{texto('bairro', { maximo: 120 })}</div>
          <div className="grade-campos">
            <div className="pergunta"><label htmlFor="municipio">Município</label>{texto('municipio', { maximo: 120 })}</div>
            <div className="pergunta"><label htmlFor="uf">UF</label>{ufs('uf')}</div>
          </div>
        </section>}

        {etapa === 's-contato' && <section className="etapa ativa" key={etapa}>
          <header><h2>Contato</h2></header>
          <div className={pc('telefones')}>
            <span className="rot">Telefone<span className="req">*</span></span>
            <p className="dica">Com DDD. Ex.: (38) 99999-0000</p>
            {lista('telefones', true)}
            <div><button type="button" className="link" onClick={() => acrescentar('telefones')}>+ Adicionar outro telefone</button></div>
            {erro('telefones')}
          </div>
          <div className={pc('emails')}>
            <span className="rot">E-mail</span>
            {lista('emails', false)}
            <div><button type="button" className="link" onClick={() => acrescentar('emails')}>+ Adicionar outro e-mail</button></div>
            {erro('emails')}
          </div>
          <div className="pergunta">
            <span className="rot">Profissionais responsáveis</span>
            <p className="dica">Eles aparecem no cartão da pessoa.</p>
            <div className="escolhas multipla">{opcoesResp.map(m => <label key={m.id}>
              <input type="checkbox" name="resp" value={m.id} checked={c.resp.includes(m.id)}
                onChange={e => mudar({ resp: e.target.checked ? [...cRef.current.resp, m.id] : cRef.current.resp.filter(x => x !== m.id) })} />
              {m.nome}{m.ativo ? '' : ' (desativado)'}
            </label>)}</div>
          </div>
          <div className="pergunta">
            <label htmlFor="lgpdBase">Base legal para o tratamento dos dados (LGPD)</label>
            <select id="lgpdBase" value={c.lgpdBase} onChange={e => mudar({ lgpdBase: e.target.value })}>
              {Object.entries(LGPD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {c.lgpdBase === 'consentimento' && <div className={pc('lgpdData')}>
            <label htmlFor="lgpdData">Data do consentimento</label>
            {data('lgpdData')}
            {erro('lgpdData')}
          </div>}
        </section>}

        <div className="navegar">
          <button type="button" className="btn" style={{ visibility: passo === 0 ? 'hidden' : 'visible' }} onClick={() => irPara(passoRef.current - 1)}>Voltar</button>
          <button type="button" className="btn pri" ref={botaoAvancar} disabled={!!ocupado} onClick={avancar}>
            {ocupado === 'salvando' ? 'Salvando…' : ultimo ? (alvo ? 'Salvar alterações' : 'Salvar cadastro') : 'Próxima'}
          </button>
        </div>
      </form>
    </>}
  </div>;
}
