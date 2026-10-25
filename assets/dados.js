// Camada de dados do SEMPER: a única parte do site que conversa com o Supabase.
// As páginas usam só window.SD. Depende de supabase-js (CDN) e de assets/marca.js.
(function () {
  const M = window.MARCA;
  const sb = window.supabase.createClient(M.supabaseUrl, M.supabaseChave);
  let ctx = null;

  // ---------- erros em português ----------
  function traduzir(e) {
    const msg = String(e?.message || e || '');
    const cod = e?.code || '';
    const t = texto => { const err = new Error(texto); err.original = e; return err; };
    if (cod === '23505' || /duplicate key/.test(msg)) {
      if (/pessoas_documento_unico/.test(msg)) return t('Já existe um cadastro com este CPF/CNPJ.');
      if (/quadro_colunas_nome_unico/.test(msg)) return t('Já existe uma coluna com esse nome neste quadro.');
      if (/convites_email_pendente/.test(msg)) return t('Este e-mail já tem um convite pendente.');
      return t('Esse registro já existe.');
    }
    if (cod === '23503' && /perfis_pessoa_fkey/.test(msg)) return t('Esta pessoa é usuária do sistema e não pode ser excluída.');
    if (cod === '23514') return t('Algum campo está em formato inválido. Confira os dados e tente de novo.');
    if (cod === '42501' || /permission denied|row-level security/i.test(msg)) return t('Você não tem permissão para fazer isso.');
    if (cod === 'P0001') return t(msg);
    if (/Invalid login credentials/i.test(msg)) return t('E-mail ou senha incorretos.');
    if (/Email not confirmed/i.test(msg)) return t('Confirme seu e-mail pelo link que enviamos antes de entrar.');
    if (/already registered|already been registered/i.test(msg)) return t('Este e-mail já tem conta. Use "Entrar" ou recupere a senha.');
    if (/Database error saving new user/i.test(msg)) return t('Não encontramos convite para este e-mail. Peça ao administrador do escritório para convidar você.');
    if (/Password should be/i.test(msg)) return t('A senha precisa ter pelo menos 8 caracteres.');
    if (/rate limit|security purposes/i.test(msg)) return t('O limite de envio de e-mails foi atingido. Aguarde cerca de uma hora e tente de novo.');
    if (/Failed to fetch|NetworkError|Load failed/i.test(msg)) return t('Sem conexão com o servidor. Verifique a internet e tente de novo.');
    if (/JWT expired|invalid JWT/i.test(msg)) return t('Sua sessão expirou. Entre de novo.');
    return t('Não foi possível concluir agora. Tente de novo.');
  }
  async function rodar(promessa) {
    let r;
    try { r = await promessa; } catch (e) { throw traduzir(e); }
    if (r.error) throw traduzir(r.error);
    return r;
  }
  const uid = () => ctx?.usuario?.id;

  // ---------- sessão ----------
  async function sessao() { const { data } = await sb.auth.getSession(); return data.session; }
  async function entrar(email, senha) { await rodar(sb.auth.signInWithPassword({ email: email.trim(), password: senha })); ctx = null; }
  async function primeiroAcesso(email, senha, voltarPara) {
    const { data } = await rodar(sb.auth.signUp({ email: email.trim().toLowerCase(), password: senha, options: { emailRedirectTo: voltarPara } }));
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error('Este e-mail já tem conta. Use "Entrar" ou recupere a senha.');
    }
    return { entrou: !!data.session };
  }
  async function recuperarSenha(email, voltarPara) { await rodar(sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: voltarPara })); }
  async function novaSenha(senha) { await rodar(sb.auth.updateUser({ password: senha })); }
  async function sair() { ctx = null; await sb.auth.signOut(); }
  const aoMudarSessao = cb => sb.auth.onAuthStateChange((evento, s) => cb(evento, s));

  // Quem está logado: perfil, escritório e equipe. null se não houver sessão.
  async function contexto(forcar = false) {
    if (ctx && !forcar) return ctx;
    const s = await sessao();
    if (!s) return null;
    const { data: perfil } = await rodar(sb.from('perfis')
      .select('id, escritorio_id, pessoa_id, nome, usuario, papel, ativo, cor, oab, preferencias').eq('id', s.user.id).maybeSingle());
    if (!perfil) return { usuario: s.user, perfil: null };
    const [{ data: escritorio }, { data: equipe }] = await Promise.all([
      rodar(sb.from('escritorios').select('id, nome, slug, modulos').eq('id', perfil.escritorio_id).maybeSingle()),
      rodar(sb.from('perfis').select('id, nome, usuario, papel, ativo, cor, pessoa_id').order('nome'))
    ]);
    ctx = { usuario: s.user, perfil, escritorio, equipe: equipe || [],
      ehAdmin: ['master', 'admin'].includes(perfil.papel), ehMaster: perfil.papel === 'master' };
    return ctx;
  }

  async function salvarPerfil(campos) {
    await rodar(sb.from('perfis').update(campos).eq('id', uid()));
    Object.assign(ctx.perfil, campos);
  }
  async function salvarPreferencia(chave, valor) {
    const preferencias = { ...(ctx.perfil.preferencias || {}), [chave]: valor };
    ctx.perfil.preferencias = preferencias;
    try { await sb.from('perfis').update({ preferencias }).eq('id', uid()); } catch (e) { /* preferência não é crítica */ }
  }

  // ---------- pessoas ----------
  const CAMPOS_LISTA = 'id, codigo, tipo, nome, nome_fantasia, documento, telefones, emails, municipio, uf, etapa_id, etapa_ordem, arquivado_em, criado_por, atualizado_em, resp:pessoa_responsaveis(perfil_id)';

  // Texto de busca: só dígitos quando a pessoa digita CPF/telefone; sem acentos no resto.
  function termoBusca(t) {
    t = String(t || '').trim();
    if (!t) return '';
    if (/\d/.test(t) && /^[\d\s.\-/()+]+$/.test(t)) return t.replace(/\D/g, '');
    return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[%_\\]/g, m => '\\' + m);
  }
  function filtrar(q, f = {}) {
    q = f.situacao === 'arquivadas' ? q.not('arquivado_em', 'is', null) : q.is('arquivado_em', null);
    if (f.tipo) q = q.eq('tipo', f.tipo);
    if (f.responsavel) q = q.eq('filtro.perfil_id', f.responsavel);
    const t = termoBusca(f.termo);
    if (t) q = q.ilike('busca', `%${t}%`);
    return q;
  }
  const selecao = f => CAMPOS_LISTA + (f.responsavel ? ', filtro:pessoa_responsaveis!inner(perfil_id)' : '');

  async function pessoasListar(f = {}) {
    const por = f.porPagina || 50, de = (f.pagina || 0) * por;
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = f.ordem === 'recentes' ? q.order('atualizado_em', { ascending: false }) : q.order('nome');
    const { data, count } = await rodar(q.range(de, de + por - 1));
    return { linhas: data, total: count || 0 };
  }

  // Cartões de uma coluna do kanban (etapaId null = "Sem etapa").
  async function pessoasDaEtapa(etapaId, f = {}, deslocamento = 0, limite = 30) {
    let q = filtrar(sb.from('pessoas').select(selecao(f), { count: 'exact' }), f);
    q = etapaId ? q.eq('etapa_id', etapaId) : q.is('etapa_id', null);
    q = q.order('etapa_ordem', { ascending: true, nullsFirst: false }).order('nome');
    const { data, count } = await rodar(q.range(deslocamento, deslocamento + limite - 1));
    return { linhas: data, total: count || 0 };
  }

  async function pessoaObter(id) {
    const { data } = await rodar(sb.from('pessoas').select('*, resp:pessoa_responsaveis(perfil_id)').eq('id', id).maybeSingle());
    return data;
  }
  async function pessoaPorDocumento(documento, excetoId) {
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, arquivado_em').eq('documento', documento);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q.maybeSingle());
    return data;
  }
  async function pessoasPorTelefones(telefones, excetoId) {
    const tels = [...new Set((telefones || []).map(window.PES.telefoneNormal).filter(t => t.length >= 8))];
    if (!tels.length) return [];
    let q = sb.from('pessoas').select('id, codigo, nome, tipo, telefones').overlaps('telefones_normais', tels).limit(5);
    if (excetoId) q = q.neq('id', excetoId);
    const { data } = await rodar(q);
    return data;
  }

  async function sincronizarResponsaveis(pessoaId, responsaveis) {
    if (!Array.isArray(responsaveis)) return;
    const { data: atuais } = await rodar(sb.from('pessoa_responsaveis').select('perfil_id').eq('pessoa_id', pessoaId));
    const ja = new Set(atuais.map(r => r.perfil_id)), quer = new Set(responsaveis);
    const incluir = [...quer].filter(id => !ja.has(id)).map(perfil_id => ({ pessoa_id: pessoaId, perfil_id }));
    const tirar = [...ja].filter(id => !quer.has(id));
    if (incluir.length) await rodar(sb.from('pessoa_responsaveis').insert(incluir));
    if (tirar.length) await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).in('perfil_id', tirar));
  }
  async function pessoaCriar(dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').insert({ ...dados, criado_por: uid() }).select('id, codigo').single());
    await sincronizarResponsaveis(data.id, responsaveis);
    return data;
  }
  async function pessoaAtualizar(id, dados, responsaveis) {
    const { data } = await rodar(sb.from('pessoas').update(dados).eq('id', id).select('id, codigo').single());
    await sincronizarResponsaveis(id, responsaveis);
    return data;
  }
  async function pessoasArquivar(ids, arquivar = true) {
    const { data } = await rodar(sb.from('pessoas')
      .update({ arquivado_em: arquivar ? new Date().toISOString() : null, arquivado_por: arquivar ? uid() : null })
      .in('id', ids).select('id'));
    return data.length;
  }
  // Exclui uma a uma: se alguma não puder (ex.: é usuária do sistema), as outras seguem.
  async function pessoasExcluir(ids) {
    const r = await Promise.allSettled(ids.map(id => rodar(sb.from('pessoas').delete().eq('id', id).select('id'))));
    const excluidas = r.filter(x => x.status === 'fulfilled' && x.value.data.length).length;
    const falha = r.find(x => x.status === 'rejected');
    return { excluidas, naoExcluidas: ids.length - excluidas, motivo: falha ? falha.reason.message : '' };
  }
  async function pessoaMover(id, etapaId, ordem) {
    await rodar(sb.from('pessoas').update({ etapa_id: etapaId, etapa_ordem: ordem }).eq('id', id));
  }
  async function pessoaHistorico(id) {
    const { data } = await rodar(sb.from('pessoa_historico').select('id, alteracoes, feito_por, em')
      .eq('pessoa_id', id).order('em', { ascending: false }).limit(100));
    return data;
  }
  async function responsavelIncluir(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').insert({ pessoa_id: pessoaId, perfil_id: perfilId })); }
  async function responsavelRemover(pessoaId, perfilId) { await rodar(sb.from('pessoa_responsaveis').delete().eq('pessoa_id', pessoaId).eq('perfil_id', perfilId)); }

  async function pessoasResumo() {
    const conta = q => rodar(q).then(r => r.count || 0);
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
  }

  // ---------- informações sigilosas ----------
  const rpc = (nome, args) => rodar(sb.rpc(nome, args)).then(r => r.data);
  const sigilosListar = pessoaId => rpc('sigilos_listar', { p_pessoa: pessoaId });
  const sigiloSalvar = (pessoaId, texto, id = null) => rpc('sigilo_salvar', { p_pessoa: pessoaId, p_texto: texto, p_id: id });
  const sigiloApagar = id => rpc('sigilo_apagar', { p_id: id });
  const sigiloAcessos = pessoaId => rpc('sigilo_acessos', { p_pessoa: pessoaId });
  const sigiloConceder = (pessoaId, perfilId, conceder = true) => rpc('sigilo_conceder', { p_pessoa: pessoaId, p_perfil: perfilId, p_conceder: conceder });

  // ---------- quadros (kanban) ----------
  async function colunasListar(modulo) {
    const [{ data: colunas }, { data: ocultas }] = await Promise.all([
      rodar(sb.from('quadro_colunas').select('id, nome, ordem, criado_por').eq('modulo', modulo).order('ordem')),
      rodar(sb.from('quadro_colunas_ocultas').select('coluna_id'))
    ]);
    const o = new Set(ocultas.map(x => x.coluna_id));
    return colunas.map(c => ({ ...c, oculta: o.has(c.id) }));
  }
  async function sugestoesListar(modulo) {
    const { data } = await rodar(sb.from('quadro_sugestoes').select('nome').eq('modulo', modulo).order('ordem'));
    return data.map(x => x.nome);
  }
  async function colunaCriar(modulo, nome, ordem) {
    const { data } = await rodar(sb.from('quadro_colunas').insert({ modulo, nome: nome.trim(), ordem, criado_por: uid() })
      .select('id, nome, ordem, criado_por').single());
    return { ...data, oculta: false };
  }
  async function colunaOcultar(id, ocultar) {
    if (ocultar) await rodar(sb.from('quadro_colunas_ocultas').insert({ coluna_id: id, perfil_id: uid() }));
    else await rodar(sb.from('quadro_colunas_ocultas').delete().eq('coluna_id', id).eq('perfil_id', uid()));
  }
  async function colunaRenomear(id, nome) { await rodar(sb.from('quadro_colunas').update({ nome: nome.trim() }).eq('id', id)); }
  async function colunaOrdenar(id, ordem) { await rodar(sb.from('quadro_colunas').update({ ordem }).eq('id', id)); }
  async function colunaExcluir(id) {
    const { data } = await rodar(sb.from('quadro_colunas').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só administradores excluem colunas.');
  }

  // ---------- equipe e administração ----------
  const equipeListar = () => rpc('equipe_listar');
  const conviteCriar = (pessoaId, email, papel) => rpc('convite_criar', { p_pessoa: pessoaId, p_email: email, p_papel: papel });
  const equipeDefinirPapel = (perfilId, papel) => rpc('equipe_definir_papel', { p_perfil: perfilId, p_papel: papel });
  const equipeDefinirAtivo = (perfilId, ativo) => rpc('equipe_definir_ativo', { p_perfil: perfilId, p_ativo: ativo });
  async function convitesListar() {
    const { data } = await rodar(sb.from('convites').select('id, email, nome, papel, pessoa_id, criado_em')
      .is('usado_em', null).order('criado_em', { ascending: false }));
    return data;
  }
  async function conviteCancelar(id) {
    const { data } = await rodar(sb.from('convites').delete().eq('id', id).select('id'));
    if (!data.length) throw new Error('Só o master cancela convites de administradores.');
  }
  async function auditoriaListar(limite = 50) {
    const { data } = await rodar(sb.from('auditoria').select('id, tabela, registro_id, acao, resumo, feito_por, em')
      .order('em', { ascending: false }).limit(limite));
    return data;
  }

  window.SD = {
    sessao, entrar, primeiroAcesso, recuperarSenha, novaSenha, sair, aoMudarSessao, contexto, salvarPerfil, salvarPreferencia,
    pessoasListar, pessoasDaEtapa, pessoaObter, pessoaPorDocumento, pessoasPorTelefones, pessoaCriar, pessoaAtualizar,
    pessoasArquivar, pessoasExcluir, pessoaMover, pessoaHistorico, responsavelIncluir, responsavelRemover, pessoasResumo,
    sigilosListar, sigiloSalvar, sigiloApagar, sigiloAcessos, sigiloConceder,
    colunasListar, sugestoesListar, colunaCriar, colunaOcultar, colunaRenomear, colunaOrdenar, colunaExcluir,
    equipeListar, conviteCriar, equipeDefinirPapel, equipeDefinirAtivo, convitesListar, conviteCancelar, auditoriaListar
  };
})();
