// Camada de dados do SEMPER: a única parte do site que conversa com o Supabase.
// As telas usam só o objeto SD (veja dados/index.ts); o contrato está em dados/tipos.ts.
import { AuthClient } from '@supabase/auth-js';
import { PostgrestClient } from '@supabase/postgrest-js';
import { MARCA } from '../marca';
import { telefoneNormal, TIPO_REPRESENTANTE } from '../regras/pessoa';
import { normal } from '../regras/texto';
import { traduzir } from './erros';
import type { Contexto, Dados, FiltroPessoas, Ordem, Pessoa, RepresentanteVinculado } from './tipos';

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
      .select('id, escritorio_id, pessoa_id, nome, usuario, papel, ativo, cor, oab, preferencias').eq('id', s.user.id).maybeSingle());
    if (!perfil) return { usuario: s.user, perfil: null, equipe: [], ehAdmin: false, ehMaster: false };
    const [{ data: escritorio }, { data: equipe }] = await Promise.all([
      rodar(sb.from('escritorios').select('id, slug, modulos, nome, logo, cnpj, oab_registro, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone, email, site')
        .eq('id', perfil.escritorio_id).maybeSingle()),
      rodar(sb.from('perfis').select('id, nome, usuario, papel, ativo, cor, pessoa_id').order('nome'))
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
    const por = f.porPagina || 50, de = (f.pagina || 0) * por;
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
  async pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = 30) {
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

  // ---------- quadros (kanban) ----------
  async colunasListar(modulo) {
    const [{ data: colunas }, { data: ocultas }] = await Promise.all([
      rodar(sb.from('quadro_colunas').select('id, nome, ordem, criado_por').eq('modulo', modulo).order('ordem')),
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
    if (!data.length) throw new Error('Só administradores excluem colunas.');
  },

  // ---------- equipe e administração ----------
  equipeListar: () => rpc('equipe_listar'),
  conviteCriar: (pessoaId, email, papel) => rpc('convite_criar', { p_pessoa: pessoaId, p_email: email, p_papel: papel }),
  conviteNovoLink: id => rpc('convite_novo_link', { p_id: id }),
  equipeDefinirPapel: (perfilId, papel) => rpc('equipe_definir_papel', { p_perfil: perfilId, p_papel: papel }),
  equipeDefinirAtivo: (perfilId, ativo) => rpc('equipe_definir_ativo', { p_perfil: perfilId, p_ativo: ativo }),
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
  async auditoriaListar(limite = 50) {
    const { data } = await rodar(sb.from('auditoria').select('id, tabela, registro_id, acao, resumo, feito_por, em')
      .order('em', { ascending: false }).limit(limite));
    return data;
  }
};
