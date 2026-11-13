-- =====================================================================
-- Escritório novo pronto para usar (#295)
--   Para entregar o SEMPER a outra empresa, uma pessoa cria o escritório dela no SQL Editor do Supabase:
--     select privado.criar_escritorio('Nome do escritório', 'Nome de quem administra', 'email@do.administrador');
--   A função devolve o link de primeiro acesso do administrador (master do escritório novo), que vale 7 dias.
--   Se o link vencer antes do uso: select privado.escritorio_novo_link('email@do.administrador');
--   Se o e-mail saiu errado:       select privado.escritorio_novo_link('email@errado', 'email@certo');
--
--   Até aqui, um escritório novo ganhava só os quadros de Processos e da Agenda e duas colunas de Pessoas e de Contratos.
--   Faltavam o quadro de Pessoas (CRM), o de Contratos com a coluna do assinado e os de Demandas e Tarefas com as colunas
--   de início e de concluído. Sem elas, o contrato assinado não gera demandas nem parcelas, e nada conta como concluído.
--   Essas colunas-marco não podem ser criadas pela tela. Agora todo escritório novo nasce com elas.
--
--   Só acrescenta (funções e um gatilho). O escritório que já existe não muda: o preparo só monta o quadro que está vazio.
--   A versão anterior do site continua funcionando.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Os quadros de um escritório: monta cada quadro que ainda está vazio, com as colunas sugeridas e os marcos.
-- ---------------------------------------------------------------------
create function privado.preparar_quadros_do_escritorio(p_escritorio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  q record;
begin
  -- Coluna da sugestão (pelo nome) que vira cada marco; Pessoas não tem marco aqui ("Contrato fechado" vem de outro gatilho).
  for q in select * from (values
    ('pessoas',   null::text,                 null::text,     null::text),
    ('contratos', 'Assinado / em andamento',  'assinado',     null::text),
    ('demandas',  'Para fazer',               'inicio',       'Concluído'),
    ('tarefas',   'Para fazer',               'inicio',       'Concluída')
  ) as t(modulo, coluna_marco, marco, coluna_concluido) loop
    continue when exists (select 1 from public.quadro_colunas c where c.escritorio_id = p_escritorio and c.modulo = q.modulo);
    insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco)
    select p_escritorio, q.modulo, s.nome, s.ordem, null,
           case s.nome when q.coluna_marco then q.marco when q.coluna_concluido then 'concluido' end
    from public.quadro_sugestoes s
    where s.modulo = q.modulo;
    -- Se a lista sugerida mudou e perdeu a coluna de um marco, para aqui: um quadro sem marco quebra o módulo.
    if q.marco is not null and not exists (select 1 from public.quadro_colunas c
        where c.escritorio_id = p_escritorio and c.modulo = q.modulo and c.marco = q.marco) then
      raise exception 'SEMPER: o quadro de % ficou sem a coluna "%"', q.modulo, q.coluna_marco;
    end if;
    if q.coluna_concluido is not null and not exists (select 1 from public.quadro_colunas c
        where c.escritorio_id = p_escritorio and c.modulo = q.modulo and c.marco = 'concluido') then
      raise exception 'SEMPER: o quadro de % ficou sem a coluna "%"', q.modulo, q.coluna_concluido;
    end if;
  end loop;
end $$;
revoke execute on function privado.preparar_quadros_do_escritorio(uuid) from public, anon, authenticated;

-- Escritório novo já nasce com os quadros. O nome do gatilho vem antes, na ordem alfabética, de
-- "colunas_do_cliente_ao_contrato": o Postgres roda os gatilhos nessa ordem, e aquele aproveita a coluna
-- "Aguardando assinatura" que este cria, antes da do assinado.
create function privado.quadros_basicos_do_escritorio_novo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform privado.preparar_quadros_do_escritorio(new.id);
  return null;
end $$;
revoke execute on function privado.quadros_basicos_do_escritorio_novo() from public, anon, authenticated;
create trigger aa_quadros_basicos after insert on public.escritorios
  for each row execute function privado.quadros_basicos_do_escritorio_novo();

-- ---------------------------------------------------------------------
-- 2. Criar o escritório e o convite do primeiro administrador. Só pelo SQL Editor (fora do alcance do site).
-- ---------------------------------------------------------------------
-- Endereço do site, para montar o link de primeiro acesso (o mesmo da tela Equipe e acessos).
create function privado.endereco_do_site() returns text
language sql immutable set search_path = '' as $$ select 'https://semper.app.br' $$;
revoke execute on function privado.endereco_do_site() from public, anon, authenticated;

create function privado.link_do_primeiro_acesso(p_codigo text) returns text
language sql immutable set search_path = '' as $$
  select privado.endereco_do_site() || '/entrar/?primeiro-acesso#convite=' || p_codigo
$$;
revoke execute on function privado.link_do_primeiro_acesso(text) from public, anon, authenticated;

create function privado.criar_escritorio(p_nome text, p_nome_admin text, p_email_admin text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_admin text := regexp_replace(btrim(coalesce(p_nome_admin, '')), '\s+', ' ', 'g');
  v_email text := lower(btrim(coalesce(p_email_admin, '')));
  v_base text; v_slug text; n int := 1;
  v_escritorio uuid; v_convite uuid;
begin
  if v_nome = '' then raise exception 'SEMPER: falta o nome do escritório'; end if;
  if v_admin = '' then raise exception 'SEMPER: falta o nome de quem vai administrar o escritório'; end if;
  -- O @usuario do cadastro sai das letras do nome e precisa de pelo menos duas: um nome de uma letra faria o primeiro acesso falhar.
  if length(regexp_replace(privado.sem_acento(v_admin), '[^a-z]', '', 'g')) < 2 then
    raise exception 'SEMPER: o nome de quem vai administrar precisa ter pelo menos duas letras';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'SEMPER: e-mail inválido: %', v_email; end if;
  -- Cada e-mail entra em um escritório só, e só um convite pendente por e-mail.
  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception 'SEMPER: este e-mail já tem conta no SEMPER. Use outro e-mail para o administrador.';
  end if;
  if exists (select 1 from public.convites c where c.email = v_email and c.usado_em is null) then
    raise exception 'SEMPER: este e-mail já tem um convite pendente. Use outro e-mail ou apague o convite antes.';
  end if;
  if exists (select 1 from public.escritorios e where privado.sem_acento(e.nome) = privado.sem_acento(v_nome)) then
    raise exception 'SEMPER: já existe um escritório com o nome "%"', v_nome;
  end if;

  -- Endereço curto (slug): o nome sem acentos, em minúsculas, com hífens; repete com número se já existir.
  v_base := btrim(regexp_replace(privado.sem_acento(v_nome), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = '' then v_base := 'escritorio'; end if;
  v_slug := v_base;
  while exists (select 1 from public.escritorios e where e.slug = v_slug) loop
    n := n + 1; v_slug := v_base || '-' || n;
  end loop;

  -- Os módulos são os do padrão da tabela: o Financeiro fica desligado (as regras de divisão ainda são as de um escritório só).
  insert into public.escritorios (nome, slug) values (v_nome, v_slug) returning id into v_escritorio;

  insert into public.convites (escritorio_id, email, nome, papel, criado_por)
  values (v_escritorio, v_email, upper(v_admin), 'master', null)
  returning id into v_convite;

  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values (v_escritorio, 'escritorios', v_escritorio::text, 'inclusao', jsonb_build_object('nome', v_nome), null);

  return privado.link_do_primeiro_acesso(privado.novo_codigo_convite(v_convite));
end $$;
revoke execute on function privado.criar_escritorio(text, text, text) from public, anon, authenticated;

-- Link novo para o primeiro administrador de um escritório criado por criar_escritorio, se o anterior venceu (7 dias) ou se
-- perdeu; o anterior deixa de valer. Com p_email_novo, corrige também o e-mail do convite (digitado errado).
-- Só serve enquanto o escritório não tem ninguém na equipe: os convites de escritórios em uso são da tela Equipe e acessos.
create function privado.escritorio_novo_link(p_email_admin text, p_email_novo text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_convite uuid;
  v_novo text := lower(btrim(coalesce(p_email_novo, '')));
begin
  select c.id into v_convite from public.convites c
  where c.email = lower(btrim(coalesce(p_email_admin, ''))) and c.usado_em is null and c.papel = 'master' and c.criado_por is null
    and not exists (select 1 from public.perfis f where f.escritorio_id = c.escritorio_id);
  if v_convite is null then
    raise exception 'SEMPER: não há convite pendente do primeiro administrador de um escritório novo para este e-mail';
  end if;
  if v_novo <> '' then
    if v_novo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'SEMPER: e-mail inválido: %', v_novo; end if;
    if exists (select 1 from auth.users u where lower(u.email) = v_novo) then
      raise exception 'SEMPER: este e-mail já tem conta no SEMPER. Use outro e-mail para o administrador.';
    end if;
    if exists (select 1 from public.convites c where c.email = v_novo and c.usado_em is null and c.id <> v_convite) then
      raise exception 'SEMPER: este e-mail já tem um convite pendente. Use outro e-mail ou apague o convite antes.';
    end if;
    update public.convites set email = v_novo where id = v_convite;
  end if;
  return privado.link_do_primeiro_acesso(privado.novo_codigo_convite(v_convite));
end $$;
revoke execute on function privado.escritorio_novo_link(text, text) from public, anon, authenticated;
