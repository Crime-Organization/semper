// Camada de dados do SEMPER: a única parte do site que conversa com o Supabase.
// As telas usam só o objeto SD (veja dados/index.ts); o contrato está em dados/tipos.ts.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { MARCA } from '../marca';
import { cnpjComLetrasNaBusca, telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { normal } from '../regras/texto';
import { traduzir } from './erros';
import { COMENTARIOS_DO_CARTAO, CONTRATOS_DA_PESSOA, DEMANDAS_LIGADAS, OBJETOS_SUGERIDOS, POR_COLUNA, POR_PAGINA, REGISTRO_DE_ACOES, TAREFAS_LIGADAS } from './limites';
import { papeisNoContrato } from '../regras/contrato';
import { papeisNaDemanda } from '../regras/demanda';
import { papeisNaTarefa } from '../regras/tarefa';
import { FUNCAO_INICIAL } from '../regras/equipe';
import type { Comentario, Contexto, Contrato, Dados, Demanda, DemandaLigada, ItemDaLista, ListaDaDemanda, ModeloDeLista, FiltroContratos, FiltroDemandas, FiltroPessoas, FiltroTarefas, Funcao, Ordem, ModuloComentado, Participacao, Pessoa, PessoaResumida, RepresentanteVinculado, Tarefa, TarefaLigada, Usuario } from './tipos';

// Só as duas partes do Supabase que o SEMPER usa (login e banco), montadas como o supabase-js faz:
// metade do peso do pacote completo. A chave da sessão é a mesma de sempre, então quem já está
// logado continua logado.
const URL_BASE = MARCA.supabaseUrl.replace(/\/+$/, '');
const CHAVE = MARCA.supabaseChave;
const auth = new AuthClient({
  url: URL_BASE + '/auth/v1',
  headers: { Authorization: `Bearer ${CHAVE}`, apikey: CHAVE },
  storageKey: `sb-${new URL(URL_BASE).hostname.split('.')[0]}-auth-token`,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  flowType: 'implicit'
});
// Cada consulta leva a chave do projeto e o token de quem está logado (sem sessão, vai a própria chave).
const comSessao: typeof fetch = async (entrada, init) => {
  const { data } = await auth.getSession();
  const cabecalhos = new Headers(init?.headers);
  if (!cabecalhos.has('apikey')) cabecalhos.set('apikey', CHAVE);
  if (!cabecalhos.has('Authorization')) cabecalhos.set('Authorization', `Bearer ${data.session?.access_token ?? CHAVE}`);
  return fetch(entrada, { ...init, headers: cabecalhos });
};
const db = new PostgrestClient(URL_BASE + '/rest/v1', { fetch: comSessao });
const sb = { auth, from: (tabela: string) => db.from(tabela), rpc: (nome: string, args?: Record<string, unknown>) => db.rpc(nome, args) };
let ctx: Contexto | null = null;

// Resposta do Supabase: devolve os dados ou lança o erro já traduzido. O banco responde em formato
// livre (any); daqui para fora valem os tipos de dados/tipos.ts.
type Livre = any;
type Resposta = { data: unknown; error: unknown; count?: number | null };
async function rodar(promessa: PromiseLike<Resposta>): Promise<{ data: Livre; count: number | null }> {
  let r: Resposta;
  try { r = await promessa; } catch (e) { throw traduzir(e); }
  if (r.error) throw traduzir(r.error);
  return { data: r.data, count: r.count ?? null };
}
const uid = () => ctx?.usuario?.id;

// ---------- pessoas ----------
const CAMPOS_LISTA = 'id, codigo, tipo, nome, nome_fantasia, documento, telefones, emails, municipio, uf, etapa_id, etapa_ordem, arquivado_em, criado_por, criado_em, atualizado_em, resp:pessoa_responsaveis(perfil_id)';

// Ordem das listas. O id no fim desempata, para a paginação não repetir nem pular ninguém.
function ordenar(q: Livre, ordem: Ordem) {
  if (ordem === 'manual') q = q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('nome');
  else if (ordem === 'nome_desc') q = q.order('nome', { ascending: false });
  else if (ordem === 'novos') q = q.order('criado_em', { ascending: false });
  else if (ordem === 'antigos') q = q.order('criado_em', { ascending: true });
  else if (ordem === 'recentes') q = q.order('atualizado_em', { ascending: false });
  else q = q.order('nome');
  return q.order('id');
}

// Texto de busca: só dígitos quando a pessoa digita CPF/telefone; sem acentos no resto.
function termoBusca(texto?: string) {
  const t = String(texto || '').trim();
  if (!t) return '';
  const cnpj = cnpjComLetrasNaBusca(t);
  if (cnpj) return cnpj;
  if (/\d/.test(t) && /^[\d\s.\-/()+]+$/.test(t)) return t.replace(/\D/g, '');
  return normal(t).replace(/[%_\\]/g, m => '\\' + m);
}
function filtrar(q: Livre, f: FiltroPessoas = {}) {
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.tipo) q = q.eq('tipo', f.tipo);
  if (f.responsavel) q = q.eq('filtro.perfil_id', f.responsavel);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
const selecao = (f: FiltroPessoas) => CAMPOS_LISTA + (f.responsavel ? ', filtro:pessoa_responsaveis!inner(perfil_id)' : '');

async function sincronizarResponsaveis(pessoaId: string, responsaveis?: string[]) {
  if (!Array.isArray(responsaveis)) return;
  const { data: atuais } = await rodar(sb.from('pessoa_responsaveis').select('perfil_id').eq('pessoa_id', pessoaId));
  const ja = new Set<string>(atuais.map((r: { perfil_id: string }) => r.perfil_id)), quer = new Set(responsaveis);
  const incluir = [...quer].filter(id => !ja.has(id)).map(perfil_id => ({ pessoa_id: pessoaId, perfil_id }));
  const tirar = [...ja].filter(id => !quer.has(id));
  if (incluir.length) await rodar(sb.from('pessoa_responsaveis').insert(incluir));
  if (tirar.length) await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).in('perfil_id', tirar));
}

const rpc = (nome: string, args?: Record<string, unknown>) => rodar(sb.rpc(nome, args)).then(r => r.data);

// ---------- comentários ----------
const CAMPOS_COMENTARIO = 'id, autor_id, texto, mencoes, criado_em, editado_em';
/** A coluna da tabela comentarios que diz de qual cartão é o comentário, em cada módulo. */
const CARTAO_DO_COMENTARIO: Record<ModuloComentado, string> = { pessoas: 'pessoa_id', contratos: 'contrato_id', demandas: 'demanda_id', tarefas: 'tarefa_id' };

// ---------- contratos ----------
const PESSOA_RESUMIDA = 'id, codigo, nome, tipo, arquivado_em';
const CAMPOS_CONTRATO_LISTA = 'id, codigo, codigo_antigo, servico, categoria, valor, responsavel_id, etapa_id, etapa_ordem, arquivado_em, '
  + 'criado_por, criado_em, atualizado_em, cliente_nome';
const CAMPOS_CONTRATO = 'id, codigo, numero, sigla, ano, codigo_antigo, cliente_id, cliente_nome, responsavel_id, objetos, servico, categoria, valor, entrada, parcelas, '
  + 'descontos, assinado_em, primeiro_pagamento, percentual_escritorio, indicador_id, indicador_percentual, '
  + 'documento_url, observacoes, etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `indicador:pessoas!contratos_indicador_id_fkey(${PESSOA_RESUMIDA}), clientela:contrato_clientes(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), `
  + `participacoes:contrato_participantes(percentual, ordem, pessoa:pessoas(${PESSOA_RESUMIDA}))`;
/** Clientes e participantes do contrato na ordem do cadastro (o banco os copia das listas gravadas no contrato). */
type ContratoLido = Omit<Contrato, 'clientes' | 'participantes'> & {
  clientela: { ordem: number; pessoa: PessoaResumida }[]; participacoes: (Participacao & { ordem: number })[];
};
const comParticipantes = ({ clientela, participacoes, ...k }: ContratoLido): Contrato => ({ ...k,
  clientes: clientela.toSorted((a, b) => a.ordem - b.ordem).map(c => c.pessoa),
  participantes: participacoes.toSorted((a, b) => a.ordem - b.ordem).map(({ pessoa, percentual }) => ({ pessoa, percentual })) });
// Ordem dos contratos ("nome" é o do cliente, copiado no contrato pelo banco). O id no fim desempata a paginação.
const ORDENS_CONTRATO: Record<Ordem, (q: Livre) => Livre> = {
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('numero', { ascending: false }),
  nome: q => q.order('cliente_nome').order('numero', { ascending: false }),
  nome_desc: q => q.order('cliente_nome', { ascending: false }).order('numero', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarContratos = (q: Livre, ordem: Ordem) => ORDENS_CONTRATO[ordem](q).order('id');
function filtrarContratos(q: Livre, f: FiltroContratos = {}) {
  q = f.situacao === 'arquivados' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.responsavel) q = q.eq('responsavel_id', f.responsavel);
  if (f.categoria) q = q.eq('categoria', f.categoria);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}

// ---------- demandas ----------
const CAMPOS_DEMANDA_LISTA = 'id, codigo, titulo, prazo, responsavel_id, colaboradores, cliente_nome, contrato_codigo, etapa_id, etapa_ordem, '
  + 'arquivado_em, criado_por, criado_em, atualizado_em';
// O contrato vem pela regra de leitura dos contratos: quem não pode abri-lo recebe null (e fica só o número).
const CAMPOS_DEMANDA = 'id, codigo, titulo, descricao, prazo, responsavel_id, colaboradores, cliente_nome, contrato_id, contrato_codigo, objeto, '
  + 'etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `clientela:demanda_clientes(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), contrato:contratos(id, codigo, servico)`;
type DemandaLida = Omit<Demanda, 'clientes'> & { clientela: { ordem: number; pessoa: PessoaResumida }[] };
const comClientes = ({ clientela, ...d }: DemandaLida): Demanda => ({ ...d, clientes: clientela.toSorted((a, b) => a.ordem - b.ordem).map(c => c.pessoa) });
// Ordem das demandas e das tarefas ("nome" é o título). O id no fim desempata a paginação.
const ORDENS_PELO_TITULO: Record<Ordem, (q: Livre) => Livre> = {
  manual: q => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em', { ascending: false }),
  nome: q => q.order('titulo'),
  nome_desc: q => q.order('titulo', { ascending: false }),
  novos: q => q.order('criado_em', { ascending: false }),
  antigos: q => q.order('criado_em', { ascending: true }),
  recentes: q => q.order('atualizado_em', { ascending: false })
};
const ordenarPeloTitulo = (q: Livre, ordem: Ordem) => ORDENS_PELO_TITULO[ordem](q).order('id');
function filtrarDemandas(q: Livre, f: FiltroDemandas = {}) {
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},colaboradores.cs.{${f.pessoa}}`);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
// ---------- tarefas ----------
const CAMPOS_TAREFA_LISTA = 'id, codigo, titulo, prazo, responsavel_id, participantes, pessoa_nome, demanda_codigo, contrato_codigo, '
  + 'etapa_id, etapa_ordem, arquivado_em, criado_por, criado_em, atualizado_em';
// A demanda e o contrato vêm pelas regras de leitura deles: quem não pode abri-los recebe null (e fica só o código).
const CAMPOS_TAREFA = 'id, codigo, titulo, descricao, prazo, responsavel_id, participantes, pessoa_nome, demanda_id, demanda_codigo, '
  + 'contrato_id, contrato_codigo, etapa_id, etapa_ordem, arquivado_em, arquivado_por, criado_por, criado_em, atualizado_por, atualizado_em, '
  + `ligadas:tarefa_pessoas(ordem, pessoa:pessoas(${PESSOA_RESUMIDA})), `
  + 'demanda:demandas(id, codigo, titulo, etapa_id, criado_por, responsavel_id, colaboradores), contrato:contratos(id, codigo, servico)';
type TarefaLida = Omit<Tarefa, 'pessoas'> & { ligadas: { ordem: number; pessoa: PessoaResumida }[] };
const comPessoas = ({ ligadas, ...t }: TarefaLida): Tarefa => ({ ...t, pessoas: ligadas.toSorted((a, b) => a.ordem - b.ordem).map(l => l.pessoa) });
function filtrarTarefas(q: Livre, f: FiltroTarefas = {}) {
  q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
  if (f.pessoa) q = q.or(`responsavel_id.eq.${f.pessoa},participantes.cs.{${f.pessoa}}`);
  const t = termoBusca(f.termo);
  if (t) q = q.ilike('busca', `%${t}%`);
  return q;
}
type TarefaParaLigar = Pick<Tarefa, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'responsavel_id' | 'participantes'>
  & { pessoas: string[] };
const CAMPOS_TAREFA_LIGADA = 'id, codigo, titulo, prazo, etapa_id, arquivado_em, criado_em, responsavel_id, participantes, pessoas';
const tarefaLigada = (pessoaId: string, perfilId: string | null) => ({ pessoas, responsavel_id, participantes, ...t }: TarefaParaLigar): TarefaLigada =>
  ({ ...t, papeis: pessoaId ? papeisNaTarefa({ pessoas, responsavel_id, participantes }, pessoaId, perfilId) : [] });
// Na ordem do quadro (como as demandas do contrato).
const naOrdemDoQuadro = (q: Livre) => q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em').limit(TAREFAS_LIGADAS);

const CAMPOS_MODELO = 'id, nome, itens, criado_por, atualizado_em';
const CAMPOS_LISTA_DEMANDA = 'id, nome, ordem', CAMPOS_ITEM_LISTA = 'id, texto, prazo, feito_em, feito_por, ordem';
type DemandaParaLigar = Pick<Demanda, 'id' | 'codigo' | 'titulo' | 'prazo' | 'etapa_id' | 'arquivado_em' | 'criado_em' | 'responsavel_id' | 'colaboradores'>
  & { clientes: string[] };
const CAMPOS_DEMANDA_LIGADA = 'id, codigo, titulo, prazo, etapa_id, arquivado_em, criado_em, responsavel_id, colaboradores, clientes';
const ligada = (pessoaId: string, perfilId: string | null) => ({ clientes, responsavel_id, colaboradores, ...d }: DemandaParaLigar): DemandaLigada =>
  ({ ...d, papeis: papeisNaDemanda({ clientes, responsavel_id, colaboradores }, pessoaId, perfilId) });

export const SD: Dados = {
  // ---------- sessão ----------
  async sessao() { const { data } = await sb.auth.getSession(); return data.session; },
  async entrar(email, senha) { await rodar(sb.auth.signInWithPassword({ email: email.trim(), password: senha })); ctx = null; },
  // O código do convite vai nos dados do cadastro; o banco só cria a conta se ele bater com o do convite.
  async primeiroAcesso(email, senha, voltarPara, codigo) {
    const { data } = await rodar(sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { emailRedirectTo: voltarPara, data: { convite: codigo } } }));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Este e-mail já tem conta. Use "Entrar" ou recupere a senha.');
    }
    return { entrou: !!data.session };
  },
  async recuperarSenha(email, voltarPara) { await rodar(sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: voltarPara })); },
  // Os e-mails trazem só um código de uso único (token_hash), não a chave de acesso: ele é trocado aqui pela sessão.
  async confirmarLink(codigo, tipo) { await rodar(sb.auth.verifyOtp({ token_hash: codigo, type: tipo })); ctx = null; },
  async novaSenha(senha) { await rodar(sb.auth.updateUser({ password: senha })); },
  async sair() { ctx = null; await sb.auth.signOut(); },
  aoMudarSessao(cb) {
    const { data } = sb.auth.onAuthStateChange(evento => cb(evento));
    return () => data.subscription.unsubscribe();
  },

  // ---------- verificação em duas etapas (aplicativo autenticador, TOTP) ----------
  async duasEtapasFatores() {
    const { data } = await rodar(sb.auth.mfa.listFactors());
    return (data.all || []).filter((f: Livre) => f.factor_type === 'totp')
      .map((f: Livre) => ({ id: f.id, ativo: f.status === 'verified', criado_em: f.created_at }));
  },
  async duasEtapasIniciar() {
    // Uma ativação começada e não confirmada impediria a nova: sai antes.
    const { data: l } = await rodar(sb.auth.mfa.listFactors());
    for (const f of (l.all || []).filter((x: Livre) => x.factor_type === 'totp' && x.status !== 'verified')) {
      await rodar(sb.auth.mfa.unenroll({ factorId: f.id }));
    }
    const { data } = await rodar(sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'SEMPER ' + new Date().toISOString().slice(0, 16) }));
    return { id: data.id, qr: data.totp.qr_code, segredo: data.totp.secret };
  },
  async duasEtapasConfirmar(id, codigo) { await rodar(sb.auth.mfa.challengeAndVerify({ factorId: id, code: codigo })); ctx = null; },
  async duasEtapasDesativar(id) { await rodar(sb.auth.mfa.unenroll({ factorId: id })); ctx = null; },
  async duasEtapasPendente() {
    try {
      const { data } = await rodar(sb.auth.mfa.getAuthenticatorAssuranceLevel());
      return data.currentLevel === 'aal1' && data.nextLevel === 'aal2';
    } catch { return false; }
  },
  async duasEtapasEntrar(codigo) {
    const { data } = await rodar(sb.auth.mfa.listFactors());
    const f = (data.totp || [])[0];
    if (!f) throw new Error('Nenhum aplicativo autenticador ativo nesta conta.');
    await rodar(sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: codigo }));
    ctx = null;
  },

  // Quem está logado: perfil, escritório e equipe. null se não houver sessão.
  async contexto(forcar = false) {
    if (ctx && !forcar) return ctx;
    const s = await SD.sessao();
    if (!s) return null;
    const { data: perfil } = await rodar(sb.from('perfis')
      .select('id, escritorio_id, pessoa_id, nome, usuario, papel, funcao, ativo, cor, oab, preferencias').eq('id', s.user.id).maybeSingle());
    if (!perfil) return { usuario: s.user, perfil: null, equipe: [], ehAdmin: false, ehMaster: false };
    const [{ data: escritorio }, { data: equipe }] = await Promise.all([
      rodar(sb.from('escritorios').select('id, slug, modulos, nome, logo, cnpj, oab_registro, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email, site')
        .eq('id', perfil.escritorio_id).maybeSingle()),
      rodar(sb.from('perfis').select('id, nome, usuario, papel, funcao, ativo, cor, pessoa_id').order('nome'))
    ]);
    ctx = {
      usuario: s.user, perfil, escritorio, equipe: equipe || [],
      ehAdmin: ['master', 'admin'].includes(perfil.papel), ehMaster: perfil.papel === 'master'
    };
    return ctx;
  },

  async salvarPerfil(campos) {
    await rodar(sb.from('perfis').update(campos).eq('id', uid()));
    if (ctx?.perfil) Object.assign(ctx.perfil, campos);
  },
  async salvarPreferencia(chave, valor) {
    if (!ctx?.perfil) return;
    const preferencias = { ...ctx.perfil.preferencias, [chave]: valor };
    ctx.perfil.preferencias = preferencias;
    try { await sb.from('perfis').update({ preferencias }).eq('id', uid()); } catch { /* preferência não é crítica */ }
  },

  // ---------- pessoas ----------
  async pessoasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = ordenar(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'nome');
    const { data, count } = await rodar(q.range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },

  // Exportação: todas as pessoas do filtro, com o cadastro completo, em lotes de 1.000 (o máximo de uma consulta).
  async pessoasExportar(f = {}) {
    const lote = 1000, todas: Pessoa[] = [];
    for (let de = 0; ; de += lote) {
      const q = filtrar(sb.from('pessoas').select('*, resp:pessoa_responsaveis(perfil_id)' + (f.responsavel ? ', filtro:pessoa_responsaveis!inner(perfil_id)' : '')), f);
      const { data } = await rodar(ordenar(q, 'nome').range(de, de + lote - 1));
      todas.push(...data);
      if (data.length < lote) return todas;
    }
  },

  // Cartões de uma coluna do kanban (etapaId null = "Sem etapa").
  async pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    q = ordenar(q, f.ordem || 'manual');
    const { data, count } = await rodar(q.range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },

  async pessoaObter(id) {
    const { data } = await rodar(sb.from('pessoas').select('*, resp:pessoa_responsaveis(perfil_id)').eq('id', id).maybeSingle());
    return data;
  },
  async pessoaPorDocumento(documento, excetoId) {
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, arquivado_em').eq('documento', documento);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q.maybeSingle());
    return data;
  },
  async pessoasPorTelefones(telefones, excetoId) {
    const tels = [...new Set((telefones || []).map(telefoneNormal).filter(t => t.length >= 8))];
    if (!tels.length) return [];
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, telefones').overlaps('telefones_normais', tels).limit(5);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q);
    return data;
  },

  async pessoaCriar(dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    await sincronizarResponsaveis(data.id, responsaveis);
    return data;
  },
  async pessoaAtualizar(id, dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').update(dados).eq('id', id).select('id, codigo').single());
    await sincronizarResponsaveis(id, responsaveis);
    return data;
  },
  async pessoasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('pessoas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  // Exclui uma a uma: se alguma não puder (ex.: é usuária do sistema), as outras seguem.
  async pessoasExcluir(ids) {
    const r = await Promise.allSettled(ids.map(id => rodar(sb.from('pessoas').delete().eq('id', id).select('id'))));
    const excluidas = r.filter(x => x.status === 'fulfilled' && x.value.data.length).length;
    const falha = r.find(x => x.status === 'rejected') as PromiseRejectedResult | undefined;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: falha ? (falha.reason as Error).message : '' };
  },
  async pessoaMover(id, etapaId, ordem) {
    await rodar(sb.from('pessoas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async pessoaHistorico(id) {
    const { data } = await rodar(sb.from('pessoa_historico').select('id, alteracoes, feito_por, em')
      .eq('pessoa_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  async responsavelIncluir(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').insert({ pessoa_id: pessoaId, perfil_id: perfilId })); },
  async responsavelRemover(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).eq('perfil_id', perfilId)); },

  async pessoasResumo() {
    const conta = (q: PromiseLike<Resposta>) => rodar(q).then(r => r.count || 0);
    const base = () => sb.from('pessoas').select('id', { count: 'exact', head: true });
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const [total, minhas, mes, arquivadas, { data: recentes }] = await Promise.all([
      conta(base().is('arquivado_em', null)),
      conta(sb.from('pessoas').select('id, filtro:pessoa_responsaveis!inner(perfil_id)', { count: 'exact', head: true })
        .is('arquivado_em', null).eq('filtro.perfil_id', uid())),
      conta(base().is('arquivado_em', null).gte('criado_em', inicioMes.toISOString())),
      conta(base().not('arquivado_em', 'is', null)),
      rodar(sb.from('pessoas').select(CAMPOS_LISTA).is('arquivado_em', null).order('atualizado_em', { ascending: false }).limit(6))
    ]);
    return { total, minhas, mes, arquivadas, recentes };
  },

  // ---------- informações sigilosas (só por funções do banco, que registram cada leitura) ----------
  sigilosListar: pessoaId => rpc('sigilos_listar', { p_pessoa: pessoaId }),
  sigiloSalvar: (pessoaId, texto, id = null) => rpc('sigilo_salvar', { p_pessoa: pessoaId, p_texto: texto, p_id: id }),
  sigiloApagar: id => rpc('sigilo_apagar', { p_id: id }),
  sigiloAcessos: pessoaId => rpc('sigilo_acessos', { p_pessoa: pessoaId }),
  sigiloConceder: (pessoaId, perfilId, conceder = true) => rpc('sigilo_conceder', { p_pessoa: pessoaId, p_perfil: perfilId, p_conceder: conceder }),

  // ---------- vínculos entre pessoas ----------
  async vinculoTiposListar() {
    const { data } = await rodar(sb.from('vinculo_tipos').select('id, escritorio_id, nome, inverso, ordem').order('ordem').order('nome'));
    return data;
  },
  async vinculoTipoCriar(nome, inverso) {
    const { data } = await rodar(sb.from('vinculo_tipos').insert({ nome: nome.trim(), inverso: (inverso || nome).trim(), criado_por: uid() })
      .select('id, escritorio_id, nome, inverso, ordem').single());
    return data;
  },
  async vinculosListar(pessoaId) {
    const pessoa = 'id, codigo, nome, tipo, arquivado_em';
    const { data } = await rodar(sb.from('pessoa_vinculos')
      .select(`id, pessoa_de, pessoa_para, tipo_id, descricao, criado_por, criado_em,
        de:pessoas!pessoa_vinculos_pessoa_de_fkey(${pessoa}), para:pessoas!pessoa_vinculos_pessoa_para_fkey(${pessoa}),
        tipo:vinculo_tipos!pessoa_vinculos_tipo_id_fkey(id, nome, inverso)`)
      .or(`pessoa_de.eq.${pessoaId},pessoa_para.eq.${pessoaId}`).order('criado_em'));
    return data;
  },
  async vinculoCriar(de, para, tipoId, descricao = null) {
    const { data } = await rodar(sb.from('pessoa_vinculos')
      .insert({ pessoa_de: de, pessoa_para: para, tipo_id: tipoId, descricao: descricao?.trim() || null, criado_por: uid() }).select('id').single());
    return data.id;
  },
  async vinculoApagar(id) { await rodar(sb.from('pessoa_vinculos').delete().eq('id', id)); },
  // Quem representa cada pessoa jurídica: vínculos do tipo "Representante legal de", com o cadastro completo do
  // representante (lado "de"). Em lotes de 150, para a consulta não ficar longa demais.
  async representantesVinculados(pjIds) {
    const ids = [...new Set(pjIds)];
    if (!ids.length) return [];
    const { data: tipos } = await rodar(sb.from('vinculo_tipos').select('id').eq('nome', TIPO_REPRESENTANTE));
    if (!tipos.length) return [];
    const saida: RepresentanteVinculado[] = [];
    for (let i = 0; i < ids.length; i += 150) {
      const { data } = await rodar(sb.from('pessoa_vinculos')
        .select('pessoa_para, descricao, de:pessoas!pessoa_vinculos_pessoa_de_fkey(*)')
        .in('tipo_id', tipos.map((t: { id: string }) => t.id)).in('pessoa_para', ids.slice(i, i + 150)).order('criado_em'));
      for (const v of data) if (v.de) saida.push({ pj_id: v.pessoa_para, pessoa: v.de, funcao: v.descricao });
    }
    return saida;
  },

  // ---------- contratos ----------
  async contratosListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarContratos(sb.from('contratos').select(CAMPOS_CONTRATO_LISTA, { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarContratos(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async contratosDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarContratos(sb.from('contratos').select(CAMPOS_CONTRATO_LISTA, { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarContratos(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async contratoObter(id) {
    const { data } = await rodar(sb.from('contratos').select(CAMPOS_CONTRATO).eq('id', id).maybeSingle());
    return data ? comParticipantes(data) : null;
  },
  // O número (sigla, sequencial e ano) é dado pelo banco ao gravar.
  async contratoCriar(dados) {
    const { data } = await rodar(sb.from('contratos').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async contratoAtualizar(id, dados) {
    const { data } = await rodar(sb.from('contratos').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async contratosArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('contratos')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async contratosExcluir(ids) {
    const { data } = await rodar(sb.from('contratos').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só contratos arquivados podem ser excluídos, por quem os criou ou por um administrador.' : '' };
  },
  async contratoMover(id, etapaId, ordem) {
    await rodar(sb.from('contratos').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async contratoHistorico(id) {
    const { data } = await rodar(sb.from('contrato_historico').select('id, alteracoes, feito_por, em')
      .eq('contrato_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Os contratos em que a pessoa aparece: os do indicador e do responsável numa consulta; os de cliente e de
  // participante vêm de contrato_clientes e contrato_participantes (um contrato pode ter vários), e os que faltam são
  // lidos à parte.
  async contratosDaPessoa(pessoaId, perfilId = null) {
    type Linha = { id: string; codigo: string; servico: string; etapa_id: string | null; arquivado_em: string | null; criado_em: string;
      clientes: string[]; responsavel_id: string; indicador_id: string | null; participacoes: { pessoa_id: string }[] };
    const campos = 'id, codigo, servico, etapa_id, arquivado_em, criado_em, clientes, responsavel_id, indicador_id, participacoes:contrato_participantes(pessoa_id)';
    const filtros = [`indicador_id.eq.${pessoaId}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`] : [])];
    const ligados = (tabela: string) => rodar(sb.from(tabela).select('contrato_id').eq('pessoa_id', pessoaId).limit(CONTRATOS_DA_PESSOA));
    const [diretos, cliente, participa] = await Promise.all([
      rodar(sb.from('contratos').select(campos).or(filtros.join(',')).order('criado_em', { ascending: false }).limit(CONTRATOS_DA_PESSOA)),
      ligados('contrato_clientes'), ligados('contrato_participantes')
    ]);
    const lidos: Linha[] = diretos.data;
    const faltam = [...new Set([...cliente.data, ...participa.data].map((x: { contrato_id: string }) => x.contrato_id))].filter(id => !lidos.some(k => k.id === id));
    const outros: Linha[] = faltam.length ? (await rodar(sb.from('contratos').select(campos).in('id', faltam))).data : [];
    return [...lidos, ...outros]
      .toSorted((a, b) => b.criado_em.localeCompare(a.criado_em))
      .map(({ participacoes, clientes, responsavel_id, indicador_id, ...k }) => ({ ...k,
        papeis: papeisNoContrato({ clientes, responsavel_id, indicador_id, participantes: participacoes.map(p => p.pessoa_id) }, pessoaId, perfilId) }));
  },
  // O banco guarda cada objeto salvo num contrato na lista do escritório (banco/010_contrato_objetos.sql).
  async objetosSugeridos() {
    const { data } = await rodar(sb.from('objeto_sugestoes').select('descricao').order('descricao').limit(OBJETOS_SUGERIDOS));
    return data.map((x: { descricao: string }) => x.descricao);
  },

  // ---------- demandas ----------
  async demandasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarDemandas(sb.from('demandas').select(CAMPOS_DEMANDA_LISTA, { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async demandasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarDemandas(sb.from('demandas').select(CAMPOS_DEMANDA_LISTA, { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async demandaObter(id) {
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA).eq('id', id).maybeSingle());
    return data ? comClientes(data) : null;
  },
  // O código é dado pelo banco ao gravar.
  async demandaCriar(dados) {
    const { data } = await rodar(sb.from('demandas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async demandaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('demandas').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async demandasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('demandas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async demandasExcluir(ids) {
    const { data } = await rodar(sb.from('demandas').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só demandas arquivadas podem ser excluídas, por quem as criou ou por um administrador.' : '' };
  },
  async demandaMover(id, etapaId, ordem) {
    await rodar(sb.from('demandas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async demandaHistorico(id) {
    const { data } = await rodar(sb.from('demanda_historico').select('id, alteracoes, feito_por, em')
      .eq('demanda_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Responsável e colaborador numa consulta (pelo usuário); cliente pela lista de clientes (vem de demanda_clientes).
  async demandasDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`clientes.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `colaboradores.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA_LIGADA).or(filtros.join(','))
      .order('criado_em', { ascending: false }).limit(DEMANDAS_LIGADAS));
    return (data as DemandaParaLigar[]).map(ligada(pessoaId, perfilId));
  },
  async demandasDoContrato(contratoId) {
    const { data } = await rodar(sb.from('demandas').select(CAMPOS_DEMANDA_LIGADA).eq('contrato_id', contratoId)
      .order('etapa_ordem', { ascending: true, nullsFirst: false }).order('criado_em').limit(DEMANDAS_LIGADAS));
    return (data as DemandaParaLigar[]).map(({ clientes: _c, responsavel_id: _r, colaboradores: _o, ...d }) => ({ ...d, papeis: [] }));
  },

  // ---------- tarefas ----------
  async tarefasListar(f = {}) {
    const por = f.porPagina || POR_PAGINA, de = (f.pagina || 0) * por;
    const q = filtrarTarefas(sb.from('tarefas').select(CAMPOS_TAREFA_LISTA, { count: 'exact' }), f);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem && f.ordem !== 'manual' ? f.ordem : 'novos').range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  },
  async tarefasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = POR_COLUNA) {
    let q = filtrarTarefas(sb.from('tarefas').select(CAMPOS_TAREFA_LISTA, { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    const { data, count } = await rodar(ordenarPeloTitulo(q, f.ordem || 'manual').range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  },
  async tarefaObter(id) {
    const { data } = await rodar(sb.from('tarefas').select(CAMPOS_TAREFA).eq('id', id).maybeSingle());
    return data ? comPessoas(data) : null;
  },
  // O código é dado pelo banco ao gravar.
  async tarefaCriar(dados) {
    const { data } = await rodar(sb.from('tarefas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    return data;
  },
  async tarefaAtualizar(id, dados) {
    const { data } = await rodar(sb.from('tarefas').update(dados).eq('id', id).select('id, codigo').single());
    return data;
  },
  async tarefasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('tarefas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  },
  async tarefasExcluir(ids) {
    const { data } = await rodar(sb.from('tarefas').delete().in('id', ids).select('id'));
    const excluidas = data.length;
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: excluidas < ids.length ? 'Só tarefas arquivadas podem ser excluídas, por quem as criou ou por um administrador.' : '' };
  },
  async tarefaMover(id, etapaId, ordem) {
    await rodar(sb.from('tarefas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  },
  async tarefaHistorico(id) {
    const { data } = await rodar(sb.from('tarefa_historico').select('id, alteracoes, feito_por, em')
      .eq('tarefa_id', id).order('em', { ascending: false }).limit(100));
    return data;
  },
  // Responsável e participante numa consulta (pelo usuário); pessoa ligada pela lista de pessoas (vem de tarefa_pessoas).
  async tarefasDaPessoa(pessoaId, perfilId = null) {
    const filtros = [`pessoas.cs.{${pessoaId}}`, ...(perfilId ? [`responsavel_id.eq.${perfilId}`, `participantes.cs.{${perfilId}}`] : [])];
    const { data } = await rodar(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).or(filtros.join(','))
      .order('criado_em', { ascending: false }).limit(TAREFAS_LIGADAS));
    return (data as TarefaParaLigar[]).map(tarefaLigada(pessoaId, perfilId));
  },
  async tarefasDaDemanda(demandaId) {
    const { data } = await rodar(naOrdemDoQuadro(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).eq('demanda_id', demandaId)));
    return (data as TarefaParaLigar[]).map(tarefaLigada('', null));
  },
  async tarefasDoContrato(contratoId) {
    const { data } = await rodar(naOrdemDoQuadro(sb.from('tarefas').select(CAMPOS_TAREFA_LIGADA).eq('contrato_id', contratoId)));
    return (data as TarefaParaLigar[]).map(tarefaLigada('', null));
  },

  // ---------- listas das demandas ----------
  async listasDaDemanda(demandaId) {
    const { data } = await rodar(sb.from('demanda_listas').select(`${CAMPOS_LISTA_DEMANDA}, itens:demanda_lista_itens(${CAMPOS_ITEM_LISTA})`)
      .eq('demanda_id', demandaId).order('ordem').order('criado_em'));
    return (data as ListaDaDemanda[]).map(l => ({ ...l, itens: l.itens.toSorted((a, b) => a.ordem - b.ordem) }));
  },
  // No fim da demanda: depois da maior posição que já existe. Os itens vêm na ordem dada.
  async listaCriar(demandaId, nome, itens = []) {
    const { data: ultima } = await rodar(sb.from('demanda_listas').select('ordem').eq('demanda_id', demandaId).order('ordem', { ascending: false }).limit(1));
    const { data: lista } = await rodar(sb.from('demanda_listas').insert({ demanda_id: demandaId, nome, ordem: (ultima[0]?.ordem ?? 0) + 1 })
      .select(CAMPOS_LISTA_DEMANDA).single());
    const { data: criados } = itens.length
      ? await rodar(sb.from('demanda_lista_itens').insert(itens.map((texto, i) => ({ lista_id: lista.id, texto, ordem: i + 1 }))).select(CAMPOS_ITEM_LISTA))
      : { data: [] };
    return { ...lista, itens: (criados as ItemDaLista[]).toSorted((a, b) => a.ordem - b.ordem) };
  },
  async listaAtualizar(id, campos) { await rodar(sb.from('demanda_listas').update(campos).eq('id', id)); },
  async listaExcluir(id) { await rodar(sb.from('demanda_listas').delete().eq('id', id)); },
  async itemCriar(listaId, texto) {
    const { data: ultimo } = await rodar(sb.from('demanda_lista_itens').select('ordem').eq('lista_id', listaId).order('ordem', { ascending: false }).limit(1));
    const { data } = await rodar(sb.from('demanda_lista_itens').insert({ lista_id: listaId, texto, ordem: (ultimo[0]?.ordem ?? 0) + 1 })
      .select(CAMPOS_ITEM_LISTA).single());
    return data;
  },
  // Marcar manda a hora daqui, mas quem vale é o banco (ele anota a hora dele e quem marcou).
  async itemAtualizar(id, { feito, ...campos }) {
    const mudar = feito === undefined ? campos : { ...campos, feito_em: feito ? new Date().toISOString() : null };
    const { data } = await rodar(sb.from('demanda_lista_itens').update(mudar).eq('id', id).select(CAMPOS_ITEM_LISTA).single());
    return data;
  },
  async itemExcluir(id) { await rodar(sb.from('demanda_lista_itens').delete().eq('id', id)); },

  // ---------- modelos de lista ----------
  async modelosListar() {
    const { data } = await rodar(sb.from('lista_modelos').select(CAMPOS_MODELO).order('nome'));
    return data as ModeloDeLista[];
  },
  async modeloCriar(nome, itens) {
    const { data } = await rodar(sb.from('lista_modelos').insert({ nome, itens, criado_por: uid() }).select(CAMPOS_MODELO).single());
    return data as ModeloDeLista;
  },
  async modeloAtualizar(id, campos) { await rodar(sb.from('lista_modelos').update(campos).eq('id', id)); },
  async modeloExcluir(id) {
    const { data } = await rodar(sb.from('lista_modelos').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só quem criou o modelo ou um administrador pode excluí-lo.');
  },

  // ---------- quadros (kanban) ----------
  async colunasListar(modulo) {
    const [{ data: colunas }, { data: ocultas }] = await Promise.all([
      rodar(sb.from('quadro_colunas').select('id, nome, ordem, criado_por, marco').eq('modulo', modulo).order('ordem')),
      rodar(sb.from('quadro_colunas_ocultas').select('coluna_id'))
    ]);
    const o = new Set(ocultas.map((x: { coluna_id: string }) => x.coluna_id));
    return colunas.map((c: { id: string }) => ({ ...c, oculta: o.has(c.id) }));
  },
  async sugestoesListar(modulo) {
    const { data } = await rodar(sb.from('quadro_sugestoes').select('nome').eq('modulo', modulo).order('ordem'));
    return data.map((x: { nome: string }) => x.nome);
  },
  async colunaCriar(modulo, nome, ordem) {
    const { data } = await rodar(sb.from('quadro_colunas').insert({ modulo, nome: nome.trim(), ordem, criado_por: uid() })
      .select('id, nome, ordem, criado_por').single());
    return { ...data, oculta: false };
  },
  async colunaOcultar(id, ocultar) {
    if (ocultar) await rodar(sb.from('quadro_colunas_ocultas').insert({ coluna_id: id, perfil_id: uid() }));
    else await rodar(sb.from('quadro_colunas_ocultas').delete().eq('coluna_id', id).eq('perfil_id', uid()));
  },
  async colunaRenomear(id, nome) { await rodar(sb.from('quadro_colunas').update({ nome: nome.trim() }).eq('id', id)); },
  async colunaOrdenar(id, ordem) { await rodar(sb.from('quadro_colunas').update({ ordem }).eq('id', id)); },
  async colunaExcluir(id) {
    const { data } = await rodar(sb.from('quadro_colunas').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só administradores excluem colunas, e a coluna-marco não pode ser excluída.');
  },

  // ---------- comentários ----------
  async comentariosListar(modulo, cartaoId) {
    const { data } = await rodar(sb.from('comentarios').select(CAMPOS_COMENTARIO).eq(CARTAO_DO_COMENTARIO[modulo], cartaoId)
      .order('criado_em', { ascending: false }).limit(COMENTARIOS_DO_CARTAO));
    return data as Comentario[];
  },
  async comentarioCriar(modulo, cartaoId, texto) {
    const { data } = await rodar(sb.from('comentarios').insert({ [CARTAO_DO_COMENTARIO[modulo]]: cartaoId, texto }).select(CAMPOS_COMENTARIO).single());
    return data as Comentario;
  },
  async comentarioEditar(id, texto) {
    const { data } = await rodar(sb.from('comentarios').update({ texto }).eq('id', id).select(CAMPOS_COMENTARIO));
    if (!data.length) throw new Error('Só quem escreveu o comentário pode editá-lo.');
    return data[0] as Comentario;
  },
  async comentarioExcluir(id) {
    const { data } = await rodar(sb.from('comentarios').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só quem escreveu o comentário ou um administrador pode apagá-lo.');
  },

  // ---------- equipe e administração ----------
  // A lista do banco é de antes da função (banco/015): a função de cada um vem dos perfis.
  async equipeListar() {
    const [usuarios, { data: funcoes }] = await Promise.all([rpc('equipe_listar'), rodar(sb.from('perfis').select('id, funcao'))]);
    const funcaoDe = new Map<string, Funcao>(funcoes.map((f: { id: string; funcao: Funcao }) => [f.id, f.funcao]));
    return usuarios.map((u: Usuario) => ({ ...u, funcao: funcaoDe.get(u.id) ?? FUNCAO_INICIAL }));
  },
  conviteCriar: (pessoaId, email, papel) => rpc('convite_criar', { p_pessoa: pessoaId, p_email: email, p_papel: papel }),
  conviteNovoLink: id => rpc('convite_novo_link', { p_id: id }),
  equipeDefinirPapel: (perfilId, papel) => rpc('equipe_definir_papel', { p_perfil: perfilId, p_papel: papel }),
  equipeDefinirAtivo: (perfilId, ativo) => rpc('equipe_definir_ativo', { p_perfil: perfilId, p_ativo: ativo }),
  equipeDefinirFuncao: (perfilId, funcao) => rpc('equipe_definir_funcao', { p_perfil: perfilId, p_funcao: funcao }),
  async convitesListar() {
    const { data } = await rodar(sb.from('convites').select('id, email, nome, papel, pessoa_id, criado_em')
      .is('usado_em', null).order('criado_em', { ascending: false }));
    return data;
  },
  async conviteCancelar(id) {
    const { data } = await rodar(sb.from('convites').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só o master cancela convites de administradores.');
  },
  async exportacaoRegistrar(tabela, descricao, quantidade) {
    await rpc('exportacao_registrar', { p_tabela: tabela, p_descricao: descricao, p_quantidade: quantidade });
  },

  async escritorioSalvar(dados) {
    await rpc('escritorio_salvar', { p: dados });
    ctx = null;   // a barra lateral e os convites passam a usar os dados novos
  },
  async auditoriaListar(limite = REGISTRO_DE_ACOES) {
    const { data } = await rodar(sb.from('auditoria').select('id, tabela, registro_id, acao, resumo, feito_por, em')
      .order('em', { ascending: false }).limit(limite));
    return data;
  }
};
