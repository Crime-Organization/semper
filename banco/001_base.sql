-- =====================================================================
-- 001 · Base do SEMPER
--   escritórios (instituições isoladas), donos da plataforma, perfis,
--   convites, pessoas, responsáveis, histórico, informações sigilosas,
--   quadros (kanban) e auditoria.
--
-- Isolamento: toda linha tem escritorio_id. As regras de acesso (RLS)
-- só mostram linhas do escritório de quem está logado. Funções auxiliares
-- ficam no esquema "privado"; as chamadas pelo site ficam em "public".
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

-- ---------------------------------------------------------------------
-- 1. FUNÇÕES DE TEXTO (imutáveis: usadas em índices e colunas geradas)
-- ---------------------------------------------------------------------
create function privado.sem_acento(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')))
$$;

create function privado.digitos(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select nullif(regexp_replace(coalesce(t, ''), '\D', '', 'g'), '')
$$;

-- Telefone só com dígitos, sem o código do país (+55).
create function privado.telefone_normal(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select case when length(d) in (12, 13) and left(d, 2) = '55' then substr(d, 3) else d end
  from (select privado.digitos(t) as d) x
$$;

create function privado.telefones_normais(t text[]) returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array_agg(n) filter (where n is not null), '{}')
  from (select privado.telefone_normal(x) as n from unnest(coalesce(t, '{}')) x) s
$$;

create function privado.juntar(t text[]) returns text
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array_to_string(t, ' '), '')
$$;

-- ---------------------------------------------------------------------
-- 2. ESCRITÓRIOS, DONOS DA PLATAFORMA E PERFIS
-- ---------------------------------------------------------------------
create table public.escritorios (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  slug      text not null unique check (slug ~ '^[a-z0-9-]+$'),
  modulos   jsonb not null default '{"pessoas": true}',   -- só o dono da plataforma liga e desliga
  criado_em timestamptz not null default now()
);

-- Quem administra a plataforma (o dono do SaaS). Não pertence a escritório.
create table public.plataforma_donos (
  email      text primary key check (email = lower(btrim(email))),
  usuario_id uuid unique references auth.users on delete set null
);

create table public.perfis (
  id            uuid primary key references auth.users on delete cascade,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  pessoa_id     uuid unique,                     -- a pessoa (cadastro) deste usuário
  nome          text not null,
  usuario       text not null check (usuario ~ '^[a-z0-9._-]{2,40}$'),   -- @usuario nas menções
  papel         text not null default 'usuario' check (papel in ('master', 'admin', 'usuario')),
  ativo         boolean not null default true,
  cor           text check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  oab           text,
  preferencias  jsonb not null default '{}',
  criado_em     timestamptz not null default now(),
  unique (escritorio_id, usuario)
);

create function privado.meu_escritorio() returns uuid
language sql stable security definer set search_path = '' as $$
  select escritorio_id from public.perfis where id = auth.uid() and ativo
$$;
create function privado.sou_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel in ('master', 'admin') from public.perfis where id = auth.uid() and ativo), false)
$$;
create function privado.sou_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select papel = 'master' from public.perfis where id = auth.uid() and ativo), false)
$$;
create function privado.sou_dono() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.plataforma_donos where usuario_id = auth.uid())
$$;
revoke execute on function privado.meu_escritorio(), privado.sou_admin(), privado.sou_master(), privado.sou_dono() from public, anon;
grant execute on function privado.meu_escritorio(), privado.sou_admin(), privado.sou_master(), privado.sou_dono() to authenticated;

-- ---------------------------------------------------------------------
-- 3. GATILHOS COMUNS: código curto, carimbo de alteração
-- ---------------------------------------------------------------------
-- Código curto e único por escritório (ex.: 49FC4ADA), para citar o item em e-mails.
create function privado.gerar_codigo() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v text; existe boolean;
begin
  loop
    v := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    execute format('select exists (select 1 from %I.%I where escritorio_id = $1 and codigo = $2)', tg_table_schema, tg_table_name)
      into existe using new.escritorio_id, v;
    exit when not existe;
  end loop;
  new.codigo := v;
  return new;
end $$;

create function privado.carimbar() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 4. QUADROS (KANBAN): colunas comuns ao escritório, ocultas por usuário
-- ---------------------------------------------------------------------
create table public.quadro_colunas (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  modulo        text not null check (modulo in ('pessoas', 'contratos', 'demandas', 'tarefas', 'processos', 'compromissos', 'anotacoes', 'financeiro')),
  nome          text not null check (btrim(nome) <> ''),
  ordem         double precision not null default 0,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
-- Não pode haver duas colunas com o mesmo nome no mesmo quadro (ignora maiúsculas e acentos).
create unique index quadro_colunas_nome_unico on public.quadro_colunas (escritorio_id, modulo, privado.sem_acento(btrim(nome)));

create table public.quadro_colunas_ocultas (
  perfil_id uuid not null default auth.uid() references public.perfis on delete cascade,
  coluna_id uuid not null references public.quadro_colunas on delete cascade,
  primary key (perfil_id, coluna_id)
);

-- Nomes sugeridos ao criar colunas (da plataforma, para todos os escritórios).
create table public.quadro_sugestoes (
  modulo text not null,
  nome   text not null,
  ordem  int not null default 0,
  primary key (modulo, nome)
);

-- ---------------------------------------------------------------------
-- 5. PESSOAS (base comum a todos os usuários do escritório)
-- ---------------------------------------------------------------------
create table public.pessoas (
  id                   uuid primary key default gen_random_uuid(),
  escritorio_id        uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo               text not null,
  tipo                 text not null check (tipo in ('pf', 'pj', 'contato')),
  nome                 text not null check (btrim(nome) <> ''),
  -- pessoa física
  genero               text check (genero in ('m', 'f')),
  nacionalidade        text,
  profissao            text,
  estado_civil         text check (estado_civil in ('solteiro', 'uniao_estavel', 'casado', 'separado', 'divorciado', 'viuvo')),
  rg                   text,
  rg_expedicao         date,
  nome_mae             text,
  nome_pai             text,
  nascimento           date,
  nascimento_municipio text,
  nascimento_uf        text check (nascimento_uf ~ '^[A-Z]{2}$'),
  -- pessoa jurídica
  natureza             text check (natureza in ('empresarial', 'publica', 'sem_fins')),
  tipo_entidade        text,
  nome_fantasia        text,
  porte                text check (porte in ('me', 'epp', 'medio', 'grande')),
  abertura             date,
  representantes       text,
  -- CPF (11 dígitos) ou CNPJ (14 dígitos), só números
  documento            text check (documento ~ '^(\d{11}|\d{14})$'),
  -- endereço
  cep                  text check (cep ~ '^\d{8}$'),
  logradouro           text,
  numero               text,
  complemento          text,
  bairro               text,
  municipio            text,
  uf                   text check (uf ~ '^[A-Z]{2}$'),
  -- contato
  telefones            text[] not null default '{}',
  emails               text[] not null default '{}',
  telefones_normais    text[] generated always as (privado.telefones_normais(telefones)) stored,
  -- LGPD: base legal do tratamento e data do consentimento, quando houver
  lgpd_base            text check (lgpd_base in ('contrato', 'processo', 'consentimento', 'obrigacao_legal', 'legitimo_interesse')),
  lgpd_consentimento   date,
  -- kanban de atendimento (CRM)
  etapa_id             uuid references public.quadro_colunas on delete set null,
  etapa_ordem          double precision,
  -- arquivo: só itens arquivados podem ser excluídos
  arquivado_em         timestamptz,
  arquivado_por        uuid references auth.users on delete set null,
  criado_por           uuid default auth.uid() references auth.users on delete set null,
  criado_em            timestamptz not null default now(),
  atualizado_por       uuid references auth.users on delete set null,
  atualizado_em        timestamptz not null default now(),
  busca                text generated always as (privado.sem_acento(
                         nome || ' ' || coalesce(nome_fantasia, '') || ' ' || coalesce(documento, '') || ' ' || codigo || ' ' ||
                         privado.juntar(privado.telefones_normais(telefones)) || ' ' || privado.juntar(emails) || ' ' || coalesce(municipio, ''))) stored,
  unique (escritorio_id, codigo)
);
create unique index pessoas_documento_unico on public.pessoas (escritorio_id, documento) where documento is not null;
create index pessoas_busca on public.pessoas using gin (busca extensions.gin_trgm_ops);
create index pessoas_telefones on public.pessoas using gin (telefones_normais);
create index pessoas_etapa on public.pessoas (escritorio_id, etapa_id, etapa_ordem);
create index pessoas_recentes on public.pessoas (escritorio_id, atualizado_em desc);

alter table public.perfis add constraint perfis_pessoa_fkey foreign key (pessoa_id) references public.pessoas on delete restrict;

create trigger codigo before insert on public.pessoas for each row execute function privado.gerar_codigo();
create trigger carimbo before update on public.pessoas for each row execute function privado.carimbar();

-- Profissionais responsáveis (as "carinhas" no cartão).
create table public.pessoa_responsaveis (
  pessoa_id     uuid not null references public.pessoas on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  incluido_em   timestamptz not null default now(),
  primary key (pessoa_id, perfil_id)
);
create index pessoa_responsaveis_perfil on public.pessoa_responsaveis (perfil_id);

-- Histórico de alterações: guarda endereços, telefones e demais dados anteriores.
create table public.pessoa_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  pessoa_id     uuid not null references public.pessoas on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index pessoa_historico_pessoa on public.pessoa_historico (pessoa_id, em desc);

create function privado.historico_pessoa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em',
                        'busca', 'telefones_normais', 'etapa_ordem', 'arquivado_por');
    if vo -> k is distinct from vn -> k then
      if k = 'etapa_id' then
        a := a || jsonb_build_object('etapa', jsonb_build_object(
               'de', (select nome from public.quadro_colunas where id = old.etapa_id),
               'para', (select nome from public.quadro_colunas where id = new.etapa_id)));
      else
        a := a || jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k));
      end if;
    end if;
  end loop;
  if a <> '{}' then
    insert into public.pessoa_historico (escritorio_id, pessoa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.pessoas for each row execute function privado.historico_pessoa();

-- Informações sigilosas: lidas e gravadas só pelas funções abaixo (cada leitura fica registrada).
create table public.pessoa_sigilos (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  pessoa_id     uuid not null references public.pessoas on delete cascade,
  texto         text not null check (btrim(texto) <> ''),
  criado_por    uuid references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index pessoa_sigilos_pessoa on public.pessoa_sigilos (pessoa_id);

create table public.pessoa_sigilo_acessos (
  pessoa_id     uuid not null references public.pessoas on delete cascade,
  perfil_id     uuid not null references public.perfis on delete cascade,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  concedido_por uuid references auth.users on delete set null,
  concedido_em  timestamptz not null default now(),
  primary key (pessoa_id, perfil_id)
);

-- ---------------------------------------------------------------------
-- 6. CONVITES (o cadastro no SEMPER é só por convite)
-- ---------------------------------------------------------------------
create table public.convites (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  email         text not null check (email = lower(btrim(email)) and email like '%_@_%'),
  nome          text not null,
  papel         text not null default 'usuario' check (papel in ('master', 'admin', 'usuario')),
  pessoa_id     uuid references public.pessoas on delete cascade,
  criado_por    uuid default auth.uid() references auth.users on delete set null,
  criado_em     timestamptz not null default now(),
  usado_em      timestamptz,
  usado_por     uuid references auth.users on delete set null
);
create unique index convites_email_pendente on public.convites (email) where usado_em is null;

-- Ao criar a conta: exige convite, cria o perfil e liga à pessoa do cadastro.
create function privado.ao_cadastrar_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare c public.convites; v_pessoa uuid; v_base text; v_usuario text; n int := 1; partes text[];
begin
  select * into c from public.convites where email = lower(new.email) and usado_em is null limit 1;
  if c.id is null then
    raise exception 'SEMPER: cadastro permitido apenas por convite';
  end if;

  v_pessoa := c.pessoa_id;
  if v_pessoa is null then
    insert into public.pessoas (escritorio_id, tipo, nome, emails, criado_por)
    values (c.escritorio_id, 'contato', upper(c.nome), array[lower(new.email)], new.id)
    returning id into v_pessoa;
  end if;

  -- @usuario: primeiro e último nome, sem acentos (mateus.goncalves); repete com número se já existir.
  partes := regexp_split_to_array(regexp_replace(privado.sem_acento(btrim(c.nome)), '[^a-z ]', '', 'g'), '\s+');
  v_base := left(coalesce(nullif(partes[1], ''), 'usuario') || case when array_length(partes, 1) > 1 then '.' || partes[array_length(partes, 1)] else '' end, 36);
  v_usuario := v_base;
  while exists (select 1 from public.perfis where escritorio_id = c.escritorio_id and usuario = v_usuario) loop
    n := n + 1; v_usuario := v_base || n;
  end loop;

  insert into public.perfis (id, escritorio_id, pessoa_id, nome, usuario, papel)
  values (new.id, c.escritorio_id, v_pessoa, initcap(lower(c.nome)), v_usuario, c.papel);
  insert into public.pessoa_responsaveis (pessoa_id, perfil_id, escritorio_id)
  values (v_pessoa, new.id, c.escritorio_id) on conflict do nothing;

  update public.convites set usado_em = now(), usado_por = new.id where id = c.id;
  update public.plataforma_donos set usuario_id = new.id where email = lower(new.email);
  return new;
end $$;
create trigger ao_cadastrar_usuario after insert on auth.users for each row execute function privado.ao_cadastrar_usuario();

-- ---------------------------------------------------------------------
-- 7. AUDITORIA (LGPD: quem incluiu, alterou, excluiu ou leu)
-- ---------------------------------------------------------------------
create table public.auditoria (
  id            bigint generated always as identity primary key,
  escritorio_id uuid references public.escritorios on delete cascade,
  tabela        text not null,
  registro_id   text,
  acao          text not null check (acao in ('inclusao', 'alteracao', 'exclusao', 'leitura')),
  resumo        jsonb,
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index auditoria_escritorio on public.auditoria (escritorio_id, em desc);

create function privado.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare j jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
begin
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, resumo, feito_por)
  values ((j ->> 'escritorio_id')::uuid, tg_table_name, coalesce(j ->> 'id', j ->> 'pessoa_id'),
          case tg_op when 'INSERT' then 'inclusao' when 'UPDATE' then 'alteracao' else 'exclusao' end,
          jsonb_strip_nulls(jsonb_build_object('codigo', j ->> 'codigo', 'nome', j ->> 'nome', 'perfil', j ->> 'perfil_id',
                                               'papel', j ->> 'papel', 'email', j ->> 'email')),
          auth.uid());
  return null;
end $$;
create trigger auditoria after insert or update or delete on public.pessoas for each row execute function privado.auditar();
create trigger auditoria after insert or delete on public.pessoa_responsaveis for each row execute function privado.auditar();
create trigger auditoria after insert or update or delete on public.pessoa_sigilos for each row execute function privado.auditar();
create trigger auditoria after insert or delete on public.pessoa_sigilo_acessos for each row execute function privado.auditar();
create trigger auditoria after insert or update of papel, ativo or delete on public.perfis for each row execute function privado.auditar();
create trigger auditoria after insert or delete on public.convites for each row execute function privado.auditar();

create function privado.registrar_leitura(p_escritorio uuid, p_tabela text, p_registro text) returns void
language sql security definer set search_path = '' as $$
  insert into public.auditoria (escritorio_id, tabela, registro_id, acao, feito_por)
  values (p_escritorio, p_tabela, p_registro, 'leitura', auth.uid())
$$;
revoke execute on function privado.registrar_leitura(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. REGRAS DE ACESSO (RLS)
-- ---------------------------------------------------------------------
alter table public.escritorios            enable row level security;
alter table public.plataforma_donos       enable row level security;
alter table public.perfis                 enable row level security;
alter table public.quadro_colunas         enable row level security;
alter table public.quadro_colunas_ocultas enable row level security;
alter table public.quadro_sugestoes       enable row level security;
alter table public.pessoas                enable row level security;
alter table public.pessoa_responsaveis    enable row level security;
alter table public.pessoa_historico       enable row level security;
alter table public.pessoa_sigilos         enable row level security;
alter table public.pessoa_sigilo_acessos  enable row level security;
alter table public.convites               enable row level security;
alter table public.auditoria              enable row level security;

-- Visitantes sem login não acessam nada; usuários logados, só pelo que as regras permitem.
revoke all on all tables in schema public from anon;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon;
revoke all on public.plataforma_donos, public.pessoa_sigilos, public.pessoa_sigilo_acessos from authenticated;
revoke insert, update, delete on public.escritorios, public.perfis, public.convites, public.auditoria,
  public.pessoa_historico, public.quadro_sugestoes from authenticated;

-- escritórios: cada um vê o seu; o dono da plataforma vê e altera todos (módulos ligados).
create policy leitura on public.escritorios for select to authenticated
  using (id = (select privado.meu_escritorio()) or (select privado.sou_dono()));
grant update (nome, modulos) on public.escritorios to authenticated;
create policy alterar on public.escritorios for update to authenticated
  using ((select privado.sou_dono())) with check ((select privado.sou_dono()));

-- perfis: todos veem a equipe do escritório; cada um altera só nome, @usuario, cor e preferências.
create policy leitura on public.perfis for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
grant update (nome, usuario, cor, preferencias) on public.perfis to authenticated;
create policy alterar on public.perfis for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- quadros: colunas aparecem para todos; renomeia quem criou ou administrador; exclui só administrador.
create policy leitura on public.quadro_colunas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.quadro_colunas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = auth.uid());
create policy alterar on public.quadro_colunas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and ((select privado.sou_admin()) or criado_por = auth.uid()))
  with check (escritorio_id = (select privado.meu_escritorio()));
create policy apagar on public.quadro_colunas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
revoke update on public.quadro_colunas from authenticated;
grant update (nome, ordem) on public.quadro_colunas to authenticated;

create policy proprias on public.quadro_colunas_ocultas for all to authenticated
  using (perfil_id = auth.uid())
  with check (perfil_id = auth.uid() and exists (
    select 1 from public.quadro_colunas c where c.id = coluna_id and c.escritorio_id = (select privado.meu_escritorio())));

create policy leitura on public.quadro_sugestoes for select to authenticated using (true);

-- pessoas: base comum do escritório. Excluir só o que estiver arquivado (quem criou ou administrador).
create policy leitura on public.pessoas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create function privado.etapa_valida(p_etapa uuid, p_modulo text) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_etapa is null or exists (
    select 1 from public.quadro_colunas c
    where c.id = p_etapa and c.modulo = p_modulo and c.escritorio_id = privado.meu_escritorio())
$$;
revoke execute on function privado.etapa_valida(uuid, text) from public, anon;
grant execute on function privado.etapa_valida(uuid, text) to authenticated;

create policy incluir on public.pessoas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = auth.uid()
              and privado.etapa_valida(etapa_id, 'pessoas'));
create policy alterar on public.pessoas for update to authenticated
  using (escritorio_id = (select privado.meu_escritorio()))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_valida(etapa_id, 'pessoas'));
create policy apagar on public.pessoas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = auth.uid() or (select privado.sou_admin())));
revoke update on public.pessoas from authenticated;
grant update (tipo, nome, genero, nacionalidade, profissao, estado_civil, rg, rg_expedicao, nome_mae, nome_pai,
  nascimento, nascimento_municipio, nascimento_uf, natureza, tipo_entidade, nome_fantasia, porte, abertura,
  representantes, documento, cep, logradouro, numero, complemento, bairro, municipio, uf, telefones, emails,
  lgpd_base, lgpd_consentimento, etapa_id, etapa_ordem, arquivado_em, arquivado_por) on public.pessoas to authenticated;

create policy leitura on public.pessoa_responsaveis for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
create policy incluir on public.pessoa_responsaveis for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio())
    and exists (select 1 from public.pessoas p where p.id = pessoa_id and p.escritorio_id = (select privado.meu_escritorio()))
    and exists (select 1 from public.perfis f where f.id = perfil_id and f.escritorio_id = (select privado.meu_escritorio())));
create policy apagar on public.pessoa_responsaveis for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));
revoke update on public.pessoa_responsaveis from authenticated;

create policy leitura on public.pessoa_historico for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

create policy leitura on public.convites for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));
grant delete on public.convites to authenticated;
create policy apagar on public.convites for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()) and usado_em is null
         and (papel = 'usuario' or (select privado.sou_master())));

create policy leitura on public.auditoria for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and (select privado.sou_admin()));

-- ---------------------------------------------------------------------
-- 9. FUNÇÕES CHAMADAS PELO SITE
-- ---------------------------------------------------------------------
-- Equipe (só administradores): perfis com e-mail, confirmação e último acesso.
create function public.equipe_listar()
returns table (id uuid, nome text, usuario text, papel text, ativo boolean, pessoa_id uuid, email text,
               criado_em timestamptz, ultimo_acesso timestamptz, confirmado boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  return query
    select p.id, p.nome, p.usuario, p.papel, p.ativo, p.pessoa_id, u.email::text, p.criado_em,
           u.last_sign_in_at, u.email_confirmed_at is not null
    from public.perfis p join auth.users u on u.id = p.id
    where p.escritorio_id = privado.meu_escritorio()
    order by case p.papel when 'master' then 0 when 'admin' then 1 else 2 end, p.nome;
end $$;

-- Convidar uma pessoa já cadastrada para ser usuária do sistema.
create function public.convite_criar(p_pessoa uuid, p_email text, p_papel text default 'usuario')
returns public.convites
language plpgsql security definer set search_path = '' as $$
declare v_pessoa public.pessoas; v_email text := lower(btrim(p_email)); c public.convites;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores convidam usuários'; end if;
  if p_papel not in ('admin', 'usuario') and not (p_papel = 'master' and privado.sou_master()) then
    raise exception 'Papel inválido';
  end if;
  if p_papel = 'admin' and not privado.sou_master() then raise exception 'Só o master convida administradores'; end if;
  select * into v_pessoa from public.pessoas where id = p_pessoa and escritorio_id = privado.meu_escritorio();
  if v_pessoa.id is null then raise exception 'Pessoa não encontrada'; end if;
  if exists (select 1 from public.perfis where pessoa_id = p_pessoa) then raise exception 'Esta pessoa já é usuária do sistema'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'E-mail inválido'; end if;
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Este e-mail já tem conta no SEMPER'; end if;
  delete from public.convites where email = v_email and usado_em is null and escritorio_id = privado.meu_escritorio();
  if exists (select 1 from public.convites where email = v_email and usado_em is null) then
    raise exception 'Este e-mail já tem um convite pendente';
  end if;
  insert into public.convites (escritorio_id, email, nome, papel, pessoa_id, criado_por)
  values (privado.meu_escritorio(), v_email, v_pessoa.nome, p_papel, p_pessoa, auth.uid())
  returning * into c;
  return c;
end $$;

create function public.equipe_definir_papel(p_perfil uuid, p_papel text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atual text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  if p_papel not in ('admin', 'usuario') then raise exception 'Papel inválido'; end if;
  if p_perfil = auth.uid() then raise exception 'Você não pode alterar o próprio papel'; end if;
  select papel into v_atual from public.perfis where id = p_perfil and escritorio_id = privado.meu_escritorio();
  if v_atual is null then raise exception 'Usuário não encontrado'; end if;
  if v_atual = 'master' then raise exception 'O usuário master não pode ser alterado'; end if;
  if (v_atual = 'admin' or p_papel = 'admin') and not privado.sou_master() then
    raise exception 'Só o master gerencia administradores';
  end if;
  update public.perfis set papel = p_papel where id = p_perfil;
end $$;

-- Desativar tira o acesso aos dados na hora, sem apagar nada do que a pessoa fez.
create function public.equipe_definir_ativo(p_perfil uuid, p_ativo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare v_atual text;
begin
  if not privado.sou_admin() then raise exception 'Apenas administradores'; end if;
  if p_perfil = auth.uid() then raise exception 'Você não pode desativar a própria conta'; end if;
  select papel into v_atual from public.perfis where id = p_perfil and escritorio_id = privado.meu_escritorio();
  if v_atual is null then raise exception 'Usuário não encontrado'; end if;
  if v_atual = 'master' then raise exception 'O usuário master não pode ser desativado'; end if;
  if v_atual = 'admin' and not privado.sou_master() then raise exception 'Só o master gerencia administradores'; end if;
  update public.perfis set ativo = p_ativo where id = p_perfil;
end $$;

-- Informações sigilosas -------------------------------------------------
-- Veem: quem cadastrou a pessoa, o master e quem recebeu acesso. O autor vê o que escreveu.
create function privado.pode_ver_sigilos(p_pessoa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pessoas x
    where x.id = p_pessoa and x.escritorio_id = privado.meu_escritorio()
      and (privado.sou_master() or x.criado_por = auth.uid()
           or exists (select 1 from public.pessoa_sigilo_acessos a where a.pessoa_id = p_pessoa and a.perfil_id = auth.uid())))
$$;
-- Concedem acesso: o master, quem cadastrou a pessoa e quem escreveu alguma informação sigilosa dela.
create function privado.pode_conceder_sigilos(p_pessoa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pessoas x
    where x.id = p_pessoa and x.escritorio_id = privado.meu_escritorio()
      and (privado.sou_master() or x.criado_por = auth.uid()
           or exists (select 1 from public.pessoa_sigilos s where s.pessoa_id = p_pessoa and s.criado_por = auth.uid())))
$$;

create function public.sigilos_listar(p_pessoa uuid)
returns table (id uuid, texto text, criado_por uuid, autor text, criado_em timestamptz, atualizado_em timestamptz, pode_editar boolean)
language plpgsql security definer set search_path = '' as $$
declare v_todos boolean := privado.pode_ver_sigilos(p_pessoa); v_escritorio uuid := privado.meu_escritorio();
begin
  if v_escritorio is null then raise exception 'Sem acesso'; end if;
  return query
    select s.id, s.texto, s.criado_por, f.nome, s.criado_em, s.atualizado_em,
           (s.criado_por = auth.uid() or privado.sou_master())
    from public.pessoa_sigilos s left join public.perfis f on f.id = s.criado_por
    where s.pessoa_id = p_pessoa and s.escritorio_id = v_escritorio and (v_todos or s.criado_por = auth.uid())
    order by s.criado_em;
  if found then perform privado.registrar_leitura(v_escritorio, 'pessoa_sigilos', p_pessoa::text); end if;
end $$;

create function public.sigilo_salvar(p_pessoa uuid, p_texto text, p_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_escritorio uuid := privado.meu_escritorio();
begin
  if v_escritorio is null then raise exception 'Sem acesso'; end if;
  if btrim(coalesce(p_texto, '')) = '' then raise exception 'Escreva a informação sigilosa'; end if;
  if p_id is null then
    if not exists (select 1 from public.pessoas where id = p_pessoa and escritorio_id = v_escritorio) then
      raise exception 'Pessoa não encontrada';
    end if;
    insert into public.pessoa_sigilos (escritorio_id, pessoa_id, texto, criado_por)
    values (v_escritorio, p_pessoa, btrim(p_texto), auth.uid()) returning id into v_id;
  else
    update public.pessoa_sigilos set texto = btrim(p_texto), atualizado_em = now()
    where id = p_id and pessoa_id = p_pessoa and escritorio_id = v_escritorio
      and (criado_por = auth.uid() or privado.sou_master())
    returning id into v_id;
    if v_id is null then raise exception 'Só quem escreveu ou o master altera esta informação'; end if;
  end if;
  return v_id;
end $$;

create function public.sigilo_apagar(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.pessoa_sigilos
  where id = p_id and escritorio_id = privado.meu_escritorio() and (criado_por = auth.uid() or privado.sou_master());
  if not found then raise exception 'Só quem escreveu ou o master apaga esta informação'; end if;
end $$;

create function public.sigilo_acessos(p_pessoa uuid)
returns table (perfil_id uuid, nome text, concedido_em timestamptz, pode_conceder boolean)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not privado.pode_ver_sigilos(p_pessoa) and not privado.pode_conceder_sigilos(p_pessoa) then
    return;
  end if;
  return query
    select a.perfil_id, f.nome, a.concedido_em, privado.pode_conceder_sigilos(p_pessoa)
    from public.pessoa_sigilo_acessos a join public.perfis f on f.id = a.perfil_id
    where a.pessoa_id = p_pessoa
    order by f.nome;
end $$;

create function public.sigilo_conceder(p_pessoa uuid, p_perfil uuid, p_conceder boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
declare v_escritorio uuid := privado.meu_escritorio();
begin
  if not privado.pode_conceder_sigilos(p_pessoa) then
    raise exception 'Só o master, quem cadastrou a pessoa ou quem escreveu a informação concede acesso';
  end if;
  if not exists (select 1 from public.perfis where id = p_perfil and escritorio_id = v_escritorio) then
    raise exception 'Usuário não encontrado';
  end if;
  if p_conceder then
    insert into public.pessoa_sigilo_acessos (pessoa_id, perfil_id, escritorio_id, concedido_por)
    values (p_pessoa, p_perfil, v_escritorio, auth.uid()) on conflict do nothing;
  else
    delete from public.pessoa_sigilo_acessos where pessoa_id = p_pessoa and perfil_id = p_perfil;
  end if;
end $$;

-- Acesso às funções: só usuários logados.
revoke execute on function public.equipe_listar(), public.convite_criar(uuid, text, text),
  public.equipe_definir_papel(uuid, text), public.equipe_definir_ativo(uuid, boolean),
  public.sigilos_listar(uuid), public.sigilo_salvar(uuid, text, uuid), public.sigilo_apagar(uuid),
  public.sigilo_acessos(uuid), public.sigilo_conceder(uuid, uuid, boolean) from public, anon;
grant execute on function public.equipe_listar(), public.convite_criar(uuid, text, text),
  public.equipe_definir_papel(uuid, text), public.equipe_definir_ativo(uuid, boolean),
  public.sigilos_listar(uuid), public.sigilo_salvar(uuid, text, uuid), public.sigilo_apagar(uuid),
  public.sigilo_acessos(uuid), public.sigilo_conceder(uuid, uuid, boolean) to authenticated;
revoke execute on function privado.pode_ver_sigilos(uuid), privado.pode_conceder_sigilos(uuid) from public, anon;
grant execute on function privado.pode_ver_sigilos(uuid), privado.pode_conceder_sigilos(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 10. DADOS INICIAIS
-- ---------------------------------------------------------------------
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('pessoas', 'Lead', 1), ('pessoas', 'Entrar em contato', 2), ('pessoas', 'Retornar contato', 3),
  ('pessoas', 'Reunião/atendimento', 4), ('pessoas', 'Atendimento em andamento', 5),
  ('pessoas', 'Levantamento de informações', 6), ('pessoas', 'Orçamento solicitado', 7),
  ('pessoas', 'Orçamento em andamento', 8), ('pessoas', 'Orçamento enviado', 9),
  ('pessoas', 'Enviar carta proposta', 10), ('pessoas', 'Contrato em andamento', 11),
  ('pessoas', 'Confecção de documentos', 12), ('pessoas', 'Mensagem de boas-vindas', 13),
  ('pessoas', 'Efetuar cobrança', 14), ('pessoas', 'Pesquisa de satisfação', 15),
  ('pessoas', 'Pendência/observações', 16), ('pessoas', 'Pendente tratamento', 17), ('pessoas', 'Não conversão', 18);

insert into public.escritorios (nome, slug, modulos) values ('Braga Ferreira', 'braga-ferreira', '{"pessoas": true}');
insert into public.plataforma_donos (email) values ('mateusgonca@gmail.com');

-- Colunas do CRM tiradas do quadro "Contatos e compromissos" do Trello e das etapas de orçamento do INPI.
insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por)
select e.id, s.modulo, s.nome, s.ordem, null
from public.escritorios e cross join public.quadro_sugestoes s
where e.slug = 'braga-ferreira' and s.modulo = 'pessoas';

-- Primeiro acesso do master: ao criar a conta com este e-mail, ele entra como master da Braga Ferreira.
insert into public.convites (escritorio_id, email, nome, papel, criado_por)
select id, 'mateusgonca@gmail.com', 'MATEUS FREITAS GONÇALVES', 'master', null
from public.escritorios where slug = 'braga-ferreira';
