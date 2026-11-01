-- =====================================================================
-- Importar pessoas (tarefa #165)
--   Um administrador traz uma lista de pessoas de um arquivo CSV (Pessoas > ⋯ > Importar pessoas). A tela confere
--   tudo antes (regras puras em app/src/regras/importacao.ts) e grava lote a lote pelas funções abaixo.
--   - Cada importação fica numa tabela própria: quem fez, quando e quantas pessoas entraram.
--   - Pessoas ganham quatro colunas: de qual importação vieram, a referência de origem (para não duplicar ao
--     importar de novo), a observação e as pendências ("incompleto" = lista não vazia).
--   - A gravação roda com as regras de acesso de quem chama (security invoker): a inclusão passa pela regra
--     "incluir", a alteração só mexe nas colunas liberadas e os responsáveis passam pela regra deles. Os gatilhos
--     de código, carimbo, histórico e registro de ações continuam valendo.
--   - Cadastro que já existe só é COMPLETADO, com a mesma regra de completarVazios (regras/importacao.ts):
--     só campos vazios e do tipo do cadastro; o documento só se o cadastro não tem nenhum; o tipo de entidade só se
--     é da natureza do cadastro; o gênero só se o tipo permite; telefones e e-mails ACRESCENTADOS (os atuais
--     primeiro, sem repetir); a observação nova é acrescentada à que já existe; as pendências se juntam. Nunca troca
--     tipo, nome, nada preenchido, nem tira do arquivo (arquivado continua arquivado).
--   - O fim da importação grava uma linha-resumo no registro de ações (ação "importacao"), só com contagens (sem a
--     descrição, que é texto vindo do site).
--   Só acrescenta: uma tabela, quatro colunas, funções e a ação nova no registro de ações. A regra "incluir" de
--   pessoas fica mais exigente só para as colunas novas, que a versão anterior do site nunca envia; a regra das
--   ações do registro só fica mais larga. A versão anterior do site continua funcionando (lê com select('*') e
--   grava só as colunas que conhece).
-- =====================================================================

-- 1. Cada importação: quem fez, quando e quantas pessoas
create table public.importacoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  modulo        text not null default 'pessoas' check (modulo in ('pessoas')),
  descricao     text not null check (char_length(descricao) between 1 and 200),
  arquivo       text check (char_length(arquivo) <= 200),
  criadas       int not null default 0 check (criadas >= 0),
  completadas   int not null default 0 check (completadas >= 0),
  incompletas   int not null default 0 check (incompletas >= 0),
  feito_por     uuid default auth.uid() references auth.users on delete set null,
  iniciada_em   timestamptz not null default now(),
  concluida_em  timestamptz
);
create index importacoes_escritorio on public.importacoes (escritorio_id, iniciada_em desc);
alter table public.importacoes enable row level security;
-- Só as funções abaixo gravam aqui; os administradores do escritório leem.
revoke all on public.importacoes from anon, authenticated;
grant select on public.importacoes to authenticated;
create policy leitura on public.importacoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- 2. Pessoas: de qual importação veio, a referência de origem, a observação e as pendências.
--    Os tamanhos são os de app/src/dados/limites.ts (TAMANHO_REFERENCIA, TAMANHO_OBSERVACOES).
alter table public.pessoas
  add column importacao_id uuid references public.importacoes on delete set null,
  add column referencia    text check (char_length(referencia) <= 100),
  add column observacoes   text check (char_length(observacoes) <= 4000),
  add column pendencias    text[] not null default '{}'
    check (pendencias <@ array['documento_invalido', 'conferir']::text[]);
create unique index pessoas_referencia_unica on public.pessoas (escritorio_id, referencia) where referencia is not null;
create index pessoas_importacao on public.pessoas (importacao_id) where importacao_id is not null;
create index pessoas_pendentes  on public.pessoas (escritorio_id) where pendencias <> '{}';
-- A equipe corrige a observação e marca como conferido. importacao_id e referencia não são liberados para alteração.
grant update (observacoes, pendencias) on public.pessoas to authenticated;

-- 3. Só uma importação aberta, do próprio administrador, pode marcar pessoas como importadas
create function privado.importacao_aberta(p_importacao uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_importacao is null or exists (
    select 1 from public.importacoes i
    where i.id = p_importacao and i.escritorio_id = privado.meu_escritorio()
      and i.feito_por = auth.uid() and i.concluida_em is null and privado.sou_admin())
$$;

-- A mesma regra de 20261024000002_desempenho.sql, mais a importação. O site anterior nunca manda essas colunas.
alter policy incluir on public.pessoas
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'pessoas')
              and privado.importacao_aberta(importacao_id)
              and (referencia is null or importacao_id is not null));

-- 4. Registro de ações: aceita a ação "importacao" (só amplia, como em 20261026000005_exportacoes.sql)
alter table public.auditoria drop constraint auditoria_acao_check;
alter table public.auditoria add constraint auditoria_acao_check
  check (acao in ('inclusao', 'alteracao', 'exclusao', 'leitura', 'exportacao', 'importacao'));

-- 5. A regra de completar um cadastro existente, peça por peça (as mesmas de regras/pessoa.ts e regras/importacao.ts)

-- Um campo vazio recebe o valor novo, se o campo vale para o tipo do cadastro ("vale"); preenchido, nunca muda.
create function privado.completar(p_atual text, p_novo text, p_vale boolean) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when p_vale and nullif(p_atual, '') is null and nullif(p_novo, '') is not null then p_novo else p_atual end
$$;
create function privado.completar(p_atual date, p_novo date, p_vale boolean) returns date
language sql immutable parallel safe set search_path = '' as $$
  select case when p_vale and p_atual is null and p_novo is not null then p_novo else p_atual end
$$;

-- O telefone para comparar (celularCompleto em regras/pessoa.ts): só dígitos, sem o +55 e sem o 0 antes do DDD,
-- e o celular antigo de 8 dígitos ganha o 9 da frente. (38) 8201-0240 e +55 38 98201-0240 são o mesmo número.
create function privado.celular_completo(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when length(d) = 10 and substr(d, 3, 1) ~ '[6-9]' then left(d, 2) || '9' || substr(d, 3) else d end
  from (select case when s = g and length(s) in (11, 12) and left(s, 1) = '0' then substr(s, 2) else s end as d
        from (select g, case when length(g) in (12, 13) and left(g, 2) = '55' then substr(g, 3) else g end as s
              from (select regexp_replace(coalesce(t, ''), '\D', '', 'g') as g) a) b) c
$$;

-- A lista atual com os itens novos no fim, sem repetir: telefone comparado por celular_completo, e-mail sem
-- espaços nas pontas e em minúsculas (como uniao() em regras/importacao.ts). Nada é tirado nem trocado.
create function privado.chave_da_lista(p_item text, p_telefone boolean) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when p_telefone then privado.celular_completo(p_item)
              else lower(regexp_replace(coalesce(p_item, ''), '^\s+|\s+$', '', 'g')) end
$$;
create function privado.unir_lista(p_atuais text[], p_novos text[], p_telefones boolean) returns text[]
language plpgsql immutable parallel safe set search_path = '' as $$
declare
  v_lista  text[] := coalesce(p_atuais, '{}');
  v_vistos text[] := array(select privado.chave_da_lista(a, p_telefones) from unnest(coalesce(p_atuais, '{}')) a);
  x text; k text;
begin
  -- Os atuais ficam todos, como estão; cada novo entra se a chave dele ainda não apareceu.
  foreach x in array coalesce(p_novos, '{}') loop
    k := privado.chave_da_lista(x, p_telefones);
    if k = any(v_vistos) then continue; end if;
    v_vistos := v_vistos || k;
    v_lista := v_lista || x;
  end loop;
  return v_lista;
end $$;

-- Gênero só em pessoa física e em empresa individual (MEI, empresário individual), como generoPermitido.
create function privado.genero_permitido(p_tipo text, p_tipo_entidade text) returns boolean
language sql immutable parallel safe set search_path = '' as $$
  select p_tipo = 'pf' or (p_tipo = 'pj' and btrim(regexp_replace(coalesce(p_tipo_entidade, ''), '\s+', ' ', 'g'))
    ~* '^(Microempreendedor\(a\) Individual \(MEI\)|Empresári[oa](\(a\))? Individual)$')
$$;

-- A natureza jurídica de um tipo de entidade (naturezaDaEntidade em regras/pessoa.ts): pelo nome exato da lista
-- ENTIDADES ou pelo nome que a Receita usa (ALIAS_NATUREZA); fora da lista, null. A lista é a mesma de pessoa.ts, e o
-- teste regras/importacao.test.ts confere que as duas não se separam.
create function privado.natureza_da_entidade(p_tipo_entidade text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select n.natureza from (values
    ('empresarial', array['Clube/Fundo de Investimento', 'Consórcio de Empregadores', 'Consórcio de Sociedades',
      'Consórcio Simples', 'Cooperativa', 'Cooperativas de Consumo', 'Empresa Binacional',
      'Empresa Domiciliada no Exterior', 'Empresa Individual de Responsabilidade Limitada (de Natureza Empresária)',
      'Empresa Individual de Responsabilidade Limitada (de Natureza Simples)', 'Empresa Pública',
      'Empresa Simples de Inovação', 'Empresário(a) Individual',
      'Estabelecimento, no Brasil, de Empresa Binacional Argentino-Brasileira',
      'Estabelecimento, no Brasil, de Sociedade Estrangeira', 'Grupo de Sociedades',
      'Microempreendedor(a) Individual (MEI)', 'Investidor Não Residente', 'Sociedade Anônima Aberta',
      'Sociedade Anônima Fechada', 'Sociedade de Economia Mista', 'Sociedade em Conta de Participação',
      'Sociedade Empresária em Comandita por Ações', 'Sociedade Empresária em Comandita Simples',
      'Sociedade Empresária em Nome Coletivo', 'Sociedade Empresária Limitada',
      'Sociedade Simples em Comandita Simples', 'Sociedade Simples em Nome Coletivo', 'Sociedade Simples Limitada',
      'Sociedade Simples Pura', 'Sociedade Unipessoal de Advogados', 'Empresário (Individual)',
      'Empresa Simples de Inovação - Inova Simples']),
    ('publica', array['Autarquia Estadual ou do Distrito Federal', 'Autarquia Federal', 'Autarquia Municipal',
      'Comissão Polinacional', 'Consórcio Público de Direito Privado',
      'Consórcio Público de Direito Público (Associação Pública)', 'Estado ou Distrito Federal',
      'Fundação Pública de Direito Privado Estadual ou do Distrito Federal',
      'Fundação Pública de Direito Privado Federal', 'Fundação Pública de Direito Privado Municipal',
      'Fundação Pública de Direito Público Estadual ou do Distrito Federal',
      'Fundação Pública de Direito Público Federal', 'Fundação Pública de Direito Público Municipal',
      'Fundo Público da Administração Direta Estadual ou do Distrito Federal',
      'Fundo Público da Administração Direta Federal', 'Fundo Público da Administração Direta Municipal',
      'Fundo Público da Administração Indireta Estadual ou do Distrito Federal',
      'Fundo Público da Administração Indireta Federal', 'Fundo Público da Administração Indireta Municipal',
      'Município', 'Órgão Público Autônomo Estadual ou do Distrito Federal', 'Órgão Público Autônomo Federal',
      'Órgão Público Autônomo Municipal', 'Órgão Público do Poder Executivo Estadual ou do Distrito Federal',
      'Órgão Público do Poder Executivo Federal', 'Órgão Público do Poder Executivo Municipal',
      'Órgão Público do Poder Judiciário Estadual', 'Órgão Público do Poder Judiciário Federal',
      'Órgão Público do Poder Legislativo Estadual ou do Distrito Federal',
      'Órgão Público do Poder Legislativo Federal', 'Órgão Público do Poder Legislativo Municipal', 'União']),
    ('sem_fins', array['Associação Privada', 'Comissão de Conciliação Prévia', 'Comitê Financeiro de Partido Político',
      'Comunidade Indígena', 'Condomínio Edilício', 'Demais Condomínios', 'Entidade de Mediação e Arbitragem',
      'Entidade Sindical', 'Estabelecimento, no Brasil, de Fundação ou Associação Estrangeiras',
      'Frente Plebiscitária ou Referendária', 'Fundação ou Associação Domiciliada no Exterior', 'Fundação Privada',
      'Fundo Privado', 'Organização Religiosa', 'Organização Social (OS)',
      'Órgão de Direção Local de Partido Político', 'Órgão de Direção Nacional de Partido Político',
      'Órgão de Direção Regional de Partido Político', 'Plano de Benefícios de Previdência Complementar Fechada',
      'Serviço Notarial e Registral (Cartório)', 'Serviço Social Autônomo', 'Candidato a Cargo Político Eletivo'])
  ) n(natureza, nomes)
  where regexp_replace(coalesce(p_tipo_entidade, ''), '^\s+|\s+$', '', 'g') = any(n.nomes)
$$;

-- O tipo de entidade que o cadastro passa a ter: só em pessoa jurídica com o campo vazio, e só se o tipo novo é da
-- natureza do cadastro (a que ele tem ou passa a ter), como completarVazios. Fora da lista, só se o cadastro
-- também não tem natureza.
create function privado.completar_entidade(p_tipo text, p_natureza text, p_natureza_nova text, p_atual text, p_nova text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select privado.completar(p_atual, p_nova, p_tipo = 'pj' and privado.natureza_da_entidade(p_nova)
    is not distinct from coalesce(p_natureza, privado.completar(p_natureza, p_natureza_nova, true)))
$$;

-- A observação que já existe com a nova acrescentada no fim, numa linha nova; a nova não entra de novo se já
-- está lá (juntarObservacoes em regras/importacao.ts).
create function privado.juntar_observacoes(p_atual text, p_nova text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when coalesce(p_nova, '') = '' or strpos(coalesce(p_atual, ''), p_nova) > 0 then nullif(p_atual, '')
              when coalesce(p_atual, '') = '' then p_nova
              else p_atual || E'\n' || p_nova end
$$;

-- As pendências juntas, sem repetir, em ordem.
create function privado.juntar_pendencias(p_atuais text[], p_novas text[]) returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select array(select distinct x from unnest(coalesce(p_atuais, '{}') || coalesce(p_novas, '{}')) x order by x)
$$;

-- O erro de uma linha do lote, sem nenhum valor da pessoa (só o número da linha e o nome da regra que barrou).
create function privado.erro_da_linha(p_linha text, p_estado text, p_restricao text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select 'Linha ' || coalesce(p_linha, '?') || ': ' || case
    when p_estado = '23505' then 'já existe um cadastro com este CPF/CNPJ ou esta referência.'
    when p_estado = '23514' and p_restricao = 'pessoas_observacoes_check' then 'a observação passaria de 4.000 caracteres.'
    when p_estado = '23514' then 'algum campo está em formato inválido (' || coalesce(nullif(p_restricao, ''), 'regra do cadastro') || ').'
    when p_estado = '42501' then 'sem permissão para gravar esta linha (confira os responsáveis).'
    when p_estado like '22%' then 'algum valor está em formato inválido.'
    else 'não foi possível gravar (código ' || coalesce(p_estado, '?') || ').' end
$$;

-- 6a. Abrir a importação (só administradores)
create function public.importacao_iniciar(p_descricao text, p_arquivo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores importam pessoas'; end if;
  insert into public.importacoes (escritorio_id, descricao, arquivo, feito_por)
  values (privado.meu_escritorio(), left(coalesce(nullif(btrim(p_descricao), ''), 'Importação de pessoas'), 200),
          left(nullif(btrim(p_arquivo), ''), 200), auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- 6b. Os cadastros que o arquivo já tem no SEMPER (inclusive arquivados), pelo CPF/CNPJ ou pela referência.
--     Roda com as regras de acesso de quem chama: só acha do próprio escritório. O site pede os responsáveis
--     junto (resp:pessoa_responsaveis). É chamada por POST, então a lista não vai no endereço.
create function public.pessoas_para_importar(p_documentos text[], p_referencias text[]) returns setof public.pessoas
language sql stable security invoker set search_path = '' as $$
  select p.* from public.pessoas p
  where p.escritorio_id = privado.meu_escritorio()
    and (p.documento = any(coalesce(p_documentos, '{}')) or p.referencia = any(coalesce(p_referencias, '{}')))
$$;

-- 6c. Gravar um lote: roda COM AS REGRAS DE ACESSO de quem chama (security invoker). Um lote é uma transação:
--     se uma linha falha, nada do lote entra, e o erro diz só o número da linha e o motivo.
create function public.pessoas_importar(p_importacao uuid, p_lote jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_item jsonb; r public.pessoas; v_id uuid; v_existente uuid; v_pend text[]; v_obs text; v_criado timestamptz; v_linha text;
  v_estado text; v_restricao text;
  v_criadas int := 0; v_completadas int := 0; v_ids jsonb := '[]';
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores importam pessoas'; end if;
  if p_importacao is null or not privado.importacao_aberta(p_importacao) then
    raise exception 'Importação não encontrada ou já concluída';
  end if;
  -- 500 = maior lote aceito (LOTE_MAXIMO_DA_IMPORTACAO em app/src/dados/limites.ts)
  if coalesce(jsonb_typeof(p_lote), '') <> 'array' or jsonb_array_length(p_lote) > 500 then raise exception 'Lote inválido'; end if;

  for v_item in select * from jsonb_array_elements(p_lote) loop
    v_linha := v_item ->> 'linha';
    v_id := null;
    begin
      r := jsonb_populate_record(null::public.pessoas, v_item -> 'dados');   -- converte datas e listas
      v_pend := privado.juntar_pendencias('{}', array(select jsonb_array_elements_text(coalesce(v_item -> 'pendencias', '[]'))));
      v_obs := nullif(v_item ->> 'observacoes', '');
      v_existente := (v_item ->> 'existente_id')::uuid;
      if v_existente is null then
        -- Data antiga de cadastro: no futuro vira agora; antes de 1900 foi digitada errado e também vira agora.
        v_criado := least(coalesce((v_item ->> 'criado_em')::timestamptz, now()), now());
        if v_criado < timestamptz '1900-01-01 00:00:00+00' then v_criado := now(); end if;
        insert into public.pessoas (tipo, nome, genero, nacionalidade, profissao, estado_civil, rg, rg_expedicao,
          nome_mae, nome_pai, nascimento, nascimento_municipio, nascimento_uf, natureza, tipo_entidade, nome_fantasia,
          porte, abertura, representantes, documento, cep, logradouro, numero, complemento, bairro, municipio, uf,
          telefones, emails, lgpd_base, lgpd_consentimento,
          criado_por, criado_em, importacao_id, referencia, observacoes, pendencias)
        values (r.tipo, r.nome, r.genero, r.nacionalidade, r.profissao, r.estado_civil, r.rg, r.rg_expedicao,
          r.nome_mae, r.nome_pai, r.nascimento, r.nascimento_municipio, r.nascimento_uf, r.natureza, r.tipo_entidade,
          r.nome_fantasia, r.porte, r.abertura, r.representantes, r.documento, r.cep, r.logradouro, r.numero,
          r.complemento, r.bairro, r.municipio, r.uf, coalesce(r.telefones, '{}'), coalesce(r.emails, '{}'),
          r.lgpd_base, r.lgpd_consentimento,
          auth.uid(), v_criado, p_importacao, nullif(v_item ->> 'referencia', ''), v_obs, v_pend)
        returning id into v_id;
        v_criadas := v_criadas + 1;
      else
        -- Só o que está vazio, e só os campos do tipo do cadastro: pessoa física, pessoa jurídica; somente contato
        -- não tem endereço. Nunca troca tipo, nome nem nada preenchido. A mesma regra de completarVazios.
        update public.pessoas p set
          documento            = coalesce(p.documento, nullif(r.documento, '')),
          nacionalidade        = privado.completar(p.nacionalidade, r.nacionalidade, p.tipo = 'pf'),
          profissao            = privado.completar(p.profissao, r.profissao, p.tipo = 'pf'),
          estado_civil         = privado.completar(p.estado_civil, r.estado_civil, p.tipo = 'pf'),
          rg                   = privado.completar(p.rg, r.rg, p.tipo = 'pf'),
          rg_expedicao         = privado.completar(p.rg_expedicao, r.rg_expedicao, p.tipo = 'pf'),
          nome_mae             = privado.completar(p.nome_mae, r.nome_mae, p.tipo = 'pf'),
          nome_pai             = privado.completar(p.nome_pai, r.nome_pai, p.tipo = 'pf'),
          nascimento           = privado.completar(p.nascimento, r.nascimento, p.tipo = 'pf'),
          nascimento_municipio = privado.completar(p.nascimento_municipio, r.nascimento_municipio, p.tipo = 'pf'),
          nascimento_uf        = privado.completar(p.nascimento_uf, r.nascimento_uf, p.tipo = 'pf'),
          natureza             = privado.completar(p.natureza, r.natureza, p.tipo = 'pj'),
          -- Só da natureza do cadastro (a que ele tem ou passa a ter).
          tipo_entidade        = privado.completar_entidade(p.tipo, p.natureza, r.natureza, p.tipo_entidade, r.tipo_entidade),
          nome_fantasia        = privado.completar(p.nome_fantasia, r.nome_fantasia, p.tipo = 'pj'),
          porte                = privado.completar(p.porte, r.porte, p.tipo = 'pj'),
          abertura             = privado.completar(p.abertura, r.abertura, p.tipo = 'pj'),
          representantes       = privado.completar(p.representantes, r.representantes, p.tipo = 'pj'),
          cep                  = privado.completar(p.cep, r.cep, p.tipo <> 'contato'),
          logradouro           = privado.completar(p.logradouro, r.logradouro, p.tipo <> 'contato'),
          numero               = privado.completar(p.numero, r.numero, p.tipo <> 'contato'),
          complemento          = privado.completar(p.complemento, r.complemento, p.tipo <> 'contato'),
          bairro               = privado.completar(p.bairro, r.bairro, p.tipo <> 'contato'),
          municipio            = privado.completar(p.municipio, r.municipio, p.tipo <> 'contato'),
          uf                   = privado.completar(p.uf, r.uf, p.tipo <> 'contato'),
          -- Gênero vazio só se o tipo permite (com o tipo de entidade que o cadastro tem ou passa a ter).
          genero               = case when p.genero is null and r.genero is not null
                                       and privado.genero_permitido(p.tipo, coalesce(p.tipo_entidade,
                                             privado.completar_entidade(p.tipo, p.natureza, r.natureza, p.tipo_entidade, r.tipo_entidade)))
                                      then r.genero else p.genero end,
          telefones            = privado.unir_lista(p.telefones, r.telefones, true),
          emails               = privado.unir_lista(p.emails, r.emails, false),
          -- A base legal só se estiver vazia (com a data do consentimento, se vier).
          lgpd_consentimento   = case when nullif(p.lgpd_base, '') is null and nullif(r.lgpd_base, '') is not null
                                       and r.lgpd_consentimento is not null then r.lgpd_consentimento else p.lgpd_consentimento end,
          lgpd_base            = privado.completar(p.lgpd_base, r.lgpd_base, true),
          observacoes          = privado.juntar_observacoes(p.observacoes, v_obs),
          pendencias           = privado.juntar_pendencias(p.pendencias, v_pend)
        where p.id = v_existente
        returning p.id into v_id;
        if v_id is not null then v_completadas := v_completadas + 1; end if;
      end if;
      -- Responsáveis: acrescenta, sem duplicar e sem remover ninguém.
      if v_id is not null then
        insert into public.pessoa_responsaveis (pessoa_id, perfil_id)
        select v_id, x::uuid from jsonb_array_elements_text(coalesce(v_item -> 'responsaveis', '[]')) x
        on conflict (pessoa_id, perfil_id) do nothing;
      end if;
    exception when others then
      -- Sem a mensagem do banco, que pode repetir o valor da linha (dado pessoal): só a regra que barrou.
      get stacked diagnostics v_estado = returned_sqlstate, v_restricao = constraint_name;
      raise exception '%', privado.erro_da_linha(v_linha, v_estado, v_restricao);
    end;
    -- Cadastro de outro escritório (a regra de acesso esconde) ou que não existe mais.
    if v_id is null then raise exception 'Linha %: cadastro não encontrado.', coalesce(v_linha, '?'); end if;
    v_ids := v_ids || jsonb_build_object('linha', v_item -> 'linha', 'id', v_id);
  end loop;
  return jsonb_build_object('criadas', v_criadas, 'completadas', v_completadas, 'ids', v_ids);
end $$;

-- 6d. Concluir: grava a linha-resumo no registro de ações, uma vez só. Criadas e incompletas o banco conta; as
--     completadas são as que o site somou dos lotes (o banco não guarda qual cadastro cada importação completou).
--     O resumo leva só os números, contados ou somados: o texto da descrição, que vem do site, fica só na tabela
--     importacoes e não entra no registro de ações (que não é limpo quando uma pessoa pede para ser esquecida).
create function public.importacao_concluir(p_importacao uuid, p_completadas int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v public.importacoes;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores importam pessoas'; end if;
  update public.importacoes i set concluida_em = now(),
    criadas     = (select count(*) from public.pessoas p where p.importacao_id = i.id),
    incompletas = (select count(*) from public.pessoas p where p.importacao_id = i.id and p.pendencias <> '{}'),
    completadas = greatest(coalesce(p_completadas, 0), 0)
  where i.id = p_importacao and i.escritorio_id = privado.meu_escritorio()
    and i.feito_por = auth.uid() and i.concluida_em is null
  returning * into v;
  if v.id is null then raise exception 'Importação não encontrada ou já concluída'; end if;
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v.escritorio_id, 'pessoas', v.id::text, 'importacao',
          jsonb_build_object('quantidade', v.criadas, 'completadas', v.completadas, 'incompletas', v.incompletas), auth.uid());
  return to_jsonb(v);
end $$;

-- Acesso às funções: só usuários logados.
revoke execute on function privado.importacao_aberta(uuid), privado.completar(text, text, boolean),
  privado.completar(date, date, boolean), privado.celular_completo(text), privado.chave_da_lista(text, boolean), privado.unir_lista(text[], text[], boolean),
  privado.genero_permitido(text, text), privado.natureza_da_entidade(text), privado.completar_entidade(text, text, text, text, text),
  privado.juntar_observacoes(text, text), privado.juntar_pendencias(text[], text[]),
  privado.erro_da_linha(text, text, text) from public, anon;
grant execute on function privado.importacao_aberta(uuid), privado.completar(text, text, boolean),
  privado.completar(date, date, boolean), privado.celular_completo(text), privado.chave_da_lista(text, boolean), privado.unir_lista(text[], text[], boolean),
  privado.genero_permitido(text, text), privado.natureza_da_entidade(text), privado.completar_entidade(text, text, text, text, text),
  privado.juntar_observacoes(text, text), privado.juntar_pendencias(text[], text[]),
  privado.erro_da_linha(text, text, text) to authenticated;
revoke execute on function public.importacao_iniciar(text, text), public.pessoas_para_importar(text[], text[]),
  public.pessoas_importar(uuid, jsonb), public.importacao_concluir(uuid, int) from public, anon;
grant execute on function public.importacao_iniciar(text, text), public.pessoas_para_importar(text[], text[]),
  public.pessoas_importar(uuid, jsonb), public.importacao_concluir(uuid, int) to authenticated;
