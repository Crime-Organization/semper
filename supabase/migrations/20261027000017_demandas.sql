-- =====================================================================
-- 017 · Demandas
--   A demanda é uma etapa de um trabalho maior: na maioria das vezes, um
--   objeto do contrato (ex.: "Registro de marca"), com tarefas, e que
--   termina num protocolo que gera um processo.
--   - Código curto e aleatório, como o das pessoas (pode haver demanda sem
--     contrato).
--   - Um responsável (qualquer um da equipe), colaboradores (sempre da
--     equipe), clientes (do cadastro) e, se houver, o contrato de origem.
--   - Prazo opcional (vai para a agenda quando ela existir).
--   - Quadro: Para fazer, Fazendo, Aguardando retorno e Concluído. "Para
--     fazer" e "Concluído" são colunas-marco (inicio e concluido).
--   - Quem vê: quem não é administrador vê só as demandas que criou, de que
--     é responsável ou colaborador; os administradores veem todas.
--   - Demandas automáticas: quando um contrato vai para a coluna-marco
--     "assinado", nasce uma demanda para cada objeto, em "Para fazer", com o
--     contrato, os clientes e o responsável dele. Uma vez só por contrato,
--     e só para os contratos movidos depois deste script.
--   - Os comentários com @ valem também no cartão da demanda. Nela, só se
--     menciona quem vê a demanda.
--
--   Só acrescenta (tabelas, gatilhos e regras novos; a coluna demanda_id
--   nos comentários). A regra dos comentários que diz "um cartão só" é
--   trocada por outra que também aceita a demanda. A versão anterior do
--   site continua funcionando.
-- =====================================================================

create table public.demandas (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo         text not null,                  -- dado pelo gatilho codigo (curto e aleatório)
  titulo         text not null check (btrim(titulo) <> '' and length(titulo) <= 300),   -- TAMANHO_DEMANDA em limites.ts
  descricao      text check (descricao is null or length(descricao) <= 4000),
  prazo          date,
  responsavel_id uuid not null references public.perfis on delete restrict,
  colaboradores  uuid[] not null default '{}' check (cardinality(colaboradores) <= 20),   -- perfis da equipe
  clientes       uuid[] not null default '{}' check (cardinality(clientes) <= 10),        -- pessoas do cadastro
  cliente_nome   text not null default '',       -- os nomes dos clientes juntos ("A; B"), para a lista, a ordem e a busca
  contrato_id    uuid references public.contratos on delete set null,
  contrato_codigo text,                           -- o número do contrato, para mostrar mesmo a quem não pode abri-lo
  objeto         text,                            -- o objeto do contrato de que a demanda nasceu (automática)
  -- quadro
  etapa_id       uuid references public.quadro_colunas on delete set null,
  etapa_ordem    double precision,
  -- arquivo: só demandas arquivadas podem ser excluídas
  arquivado_em   timestamptz,
  arquivado_por  uuid references auth.users on delete set null,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  busca          text generated always as (privado.sem_acento(
                   codigo || ' ' || titulo || ' ' || coalesce(descricao, '') || ' ' || cliente_nome || ' ' || coalesce(contrato_codigo, ''))) stored,
  unique (escritorio_id, codigo)
);
create index demandas_etapa on public.demandas (escritorio_id, etapa_id, etapa_ordem);
create index demandas_responsavel on public.demandas (responsavel_id);
create index demandas_contrato on public.demandas (contrato_id) where contrato_id is not null;

create trigger codigo before insert on public.demandas for each row execute function privado.gerar_codigo();

-- Liga cada cliente à demanda: quem é cliente de uma demanda não pode ser excluído, e a demanda aparece no cartão dele.
create table public.demanda_clientes (
  demanda_id    uuid not null references public.demandas on delete cascade,
  pessoa_id     uuid not null constraint demanda_clientes_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  ordem         integer not null default 0,
  primary key (demanda_id, pessoa_id)
);
create index demanda_clientes_pessoa on public.demanda_clientes (pessoa_id);

-- Confere e arruma a demanda antes de gravar:
-- - clientes do escritório, sem repetir; os nomes juntos em cliente_nome;
-- - responsável da equipe do escritório;
-- - colaboradores da equipe, sem repetir e sem o responsável;
-- - o número do contrato copiado (para mostrar a quem não pode abrir o contrato).
create function privado.preparar_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  new.titulo := btrim(new.titulo);
  foreach x in array new.clientes loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Cliente não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.clientes := v;
  new.cliente_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.colaboradores loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    if not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O colaborador precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.colaboradores := v;

  if new.contrato_id is null then
    new.contrato_codigo := null;
  elsif tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id then
    select codigo into new.contrato_codigo from public.contratos where id = new.contrato_id and escritorio_id = new.escritorio_id;
    if new.contrato_codigo is null then raise exception 'Contrato não encontrado neste escritório.'; end if;
  end if;
  return new;
end $$;
create trigger preparar before insert or update of titulo, clientes, responsavel_id, colaboradores, contrato_id on public.demandas
  for each row execute function privado.preparar_demanda();
-- A cópia dos nomes dos clientes não conta como alteração da demanda.
create trigger carimbo before update on public.demandas
  for each row when (old.cliente_nome is not distinct from new.cliente_nome) execute function privado.carimbar();

create function privado.copiar_clientes_da_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.demanda_clientes c where c.demanda_id = new.id and c.pessoa_id <> all (new.clientes);
  insert into public.demanda_clientes (demanda_id, pessoa_id, escritorio_id, ordem)
  select new.id, u.id, new.escritorio_id, u.i::integer from unnest(new.clientes) with ordinality as u(id, i)
  on conflict (demanda_id, pessoa_id) do update set ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_clientes after insert or update of clientes on public.demandas
  for each row execute function privado.copiar_clientes_da_demanda();

-- O nome de um cliente que muda no cadastro muda também nas demandas dele.
create function privado.nome_do_cliente_nas_demandas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.demandas d set cliente_nome = privado.nomes_dos_clientes(d.clientes, '; ') where new.id = any(d.clientes);
  return null;
end $$;
create trigger nome_nas_demandas after update of nome on public.pessoas
  for each row when (old.nome is distinct from new.nome) execute function privado.nome_do_cliente_nas_demandas();

-- ---------------------------------------------------------------------
-- Histórico: o que mudou, campo a campo, com os nomes (das pessoas, do
-- responsável, dos colaboradores e da coluna) e o número do contrato.
-- ---------------------------------------------------------------------
create table public.demanda_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  demanda_id    uuid not null references public.demandas on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index demanda_historico_demanda on public.demanda_historico (demanda_id, em desc);

create function privado.nomes_da_equipe(p uuid[]) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(f.nome, 'usuário removido'), ', ' order by u.i)
  from unnest(coalesce(p, '{}')) with ordinality as u(id, i)
  left join public.perfis f on f.id = u.id
$$;

create function privado.historico_demanda() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'cliente_nome', 'contrato_codigo', 'objeto', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'colaboradores' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.colaboradores), 'para', privado.nomes_da_equipe(new.colaboradores)))
      when 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '), 'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.demanda_historico (escritorio_id, demanda_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.demandas for each row execute function privado.historico_demanda();
create trigger auditoria after insert or update or delete on public.demandas for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai do histórico das demandas em que já foi cliente.
create function privado.esquecer_pessoa_nas_demandas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.demanda_historico h
  set alteracoes = jsonb_set(h.alteracoes, '{clientes}', jsonb_build_object(
    'de', replace(h.alteracoes -> 'clientes' ->> 'de', old.nome, 'pessoa excluída'),
    'para', replace(h.alteracoes -> 'clientes' ->> 'para', old.nome, 'pessoa excluída')))
  where h.escritorio_id = old.escritorio_id and h.alteracoes ? 'clientes'
    and (position(old.nome in coalesce(h.alteracoes -> 'clientes' ->> 'de', '')) > 0
         or position(old.nome in coalesce(h.alteracoes -> 'clientes' ->> 'para', '')) > 0);
  return null;
end $$;
create trigger esquecer_nas_demandas after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nas_demandas();

-- ---------------------------------------------------------------------
-- Quem vê: administradores, quem criou, o responsável e os colaboradores.
-- ---------------------------------------------------------------------
create function privado.vejo_demanda(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_colaboradores uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_colaboradores))
$$;
revoke execute on function privado.vejo_demanda(uuid, uuid, uuid, uuid[]) from public, anon;
grant execute on function privado.vejo_demanda(uuid, uuid, uuid, uuid[]) to authenticated;

alter table public.demandas          enable row level security;
alter table public.demanda_clientes  enable row level security;
alter table public.demanda_historico enable row level security;
revoke all on public.demandas, public.demanda_clientes, public.demanda_historico from anon;
revoke insert, update, delete on public.demanda_clientes, public.demanda_historico from authenticated;

create policy leitura on public.demandas for select to authenticated
  using (privado.vejo_demanda(escritorio_id, criado_por, responsavel_id, colaboradores));
create policy incluir on public.demandas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'demandas'));
create policy alterar on public.demandas for update to authenticated
  using (privado.vejo_demanda(escritorio_id, criado_por, responsavel_id, colaboradores))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_valida(etapa_id, 'demandas'));
create policy apagar on public.demandas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
revoke update on public.demandas from authenticated;
grant update (titulo, descricao, prazo, responsavel_id, colaboradores, clientes, contrato_id, etapa_id, etapa_ordem,
  arquivado_em, arquivado_por) on public.demandas to authenticated;

-- Os clientes e o histórico seguem quem vê a demanda.
create policy leitura on public.demanda_clientes for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));
create policy leitura on public.demanda_historico for select to authenticated
  using (exists (select 1 from public.demandas d where d.id = demanda_id));

-- ---------------------------------------------------------------------
-- Demandas automáticas: o contrato que chega à coluna-marco "assinado"
-- ganha uma demanda para cada objeto, em "Para fazer" (uma vez só).
-- ---------------------------------------------------------------------
create table privado.contratos_com_demandas (
  contrato_id uuid primary key references public.contratos on delete cascade,
  em          timestamptz not null default now()
);
revoke all on privado.contratos_com_demandas from public, anon, authenticated;

create function privado.demandas_do_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_inicio uuid; v_base double precision := extract(epoch from clock_timestamp());
begin
  if tg_op = 'UPDATE' and new.etapa_id is not distinct from old.etapa_id then return null; end if;
  if not exists (select 1 from public.quadro_colunas where id = new.etapa_id and marco = 'assinado') then return null; end if;
  insert into privado.contratos_com_demandas (contrato_id) values (new.id) on conflict do nothing;
  if not found then return null; end if;
  select id into v_inicio from public.quadro_colunas
  where escritorio_id = new.escritorio_id and modulo = 'demandas' and marco = 'inicio';
  insert into public.demandas (escritorio_id, titulo, responsavel_id, clientes, contrato_id, objeto, etapa_id, etapa_ordem, criado_por)
  select new.escritorio_id, o.texto, new.responsavel_id, new.clientes, new.id, o.texto, v_inicio, v_base + o.n / 1000.0,
         coalesce(auth.uid(), new.criado_por)
  from unnest(new.objetos) with ordinality as o(texto, n);
  return null;
end $$;
create trigger demandas_automaticas after insert or update of etapa_id on public.contratos
  for each row execute function privado.demandas_do_contrato();

-- ---------------------------------------------------------------------
-- Comentários também nas demandas. Só se menciona quem vê a demanda.
-- ---------------------------------------------------------------------
alter table public.comentarios add column demanda_id uuid references public.demandas on delete cascade;
create index comentarios_da_demanda on public.comentarios (demanda_id, criado_em desc) where demanda_id is not null;
alter table public.comentarios drop constraint comentario_de_um_cartao;
alter table public.comentarios add constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id, demanda_id) = 1);

alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
              and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
              and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
              and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id)));

create or replace function privado.preparar_comentario() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_nome text;
begin
  new.texto := btrim(new.texto);
  if new.texto = '' then raise exception 'Escreva o comentário.'; end if;
  if tg_op = 'UPDATE' then new.editado_em := now(); end if;
  select coalesce(array_agg(distinct p.id), '{}') into new.mencoes
  from regexp_matches(new.texto, '(^|[^a-z0-9._-])@([a-z0-9._-]+)', 'gi') as m(partes)
  join public.perfis p on p.usuario = rtrim(lower(m.partes[2]), '.') and p.escritorio_id = new.escritorio_id and p.ativo;
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  if new.demanda_id is not null then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Quadro de demandas em cada escritório e o módulo ligado.
-- ---------------------------------------------------------------------
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('demandas', 'Para fazer', 1), ('demandas', 'Fazendo', 2), ('demandas', 'Aguardando retorno', 3), ('demandas', 'Concluído', 4)
on conflict do nothing;

insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco)
select e.id, 'demandas', s.nome, s.ordem, null, case s.nome when 'Para fazer' then 'inicio' when 'Concluído' then 'concluido' end
from public.escritorios e cross join public.quadro_sugestoes s
where s.modulo = 'demandas'
  and not exists (select 1 from public.quadro_colunas c where c.escritorio_id = e.id and c.modulo = 'demandas');

alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true, "demandas": true}';
update public.escritorios set modulos = modulos || '{"demandas": true}' where not modulos ? 'demandas';
