-- =====================================================================
-- 020 · Tarefas
--   A tarefa é a parte menor de um trabalho: a demanda "Pedido de registro
--   de marca" tem as tarefas "Busca de anterioridade", "Emitir a GRU",
--   "Pedir documentos ao cliente"...
--   - Código curto e aleatório, como o das pessoas e das demandas.
--   - Um responsável (qualquer um da equipe) e participantes (sempre da
--     equipe). Pode ser ligada a pessoas, a uma demanda e a um contrato,
--     mas nenhuma ligação é obrigatória: pode haver tarefa avulsa.
--   - Prazo opcional (vai para a agenda quando ela existir).
--   - Quadro: Para fazer, Fazendo, Aguardando retorno e Concluída. "Para
--     fazer" e "Concluída" são colunas-marco (inicio e concluido).
--   - Quem vê: os administradores; quem criou, o responsável e os
--     participantes; e quem vê a demanda ligada a ela.
--   - Só se liga uma demanda que se pode ver. Quem vê a tarefa mas não a
--     demanda vê só o código dela, sem abrir (como o contrato na demanda).
--   - Os comentários com @ valem também no cartão da tarefa. Nela, só se
--     menciona quem vê a tarefa.
--
--   Só acrescenta (tabelas, gatilhos e regras novos; a coluna tarefa_id
--   nos comentários). A regra dos comentários que diz "um cartão só" é
--   trocada por outra que também aceita a tarefa. A versão anterior do
--   site continua funcionando.
-- =====================================================================

create table public.tarefas (
  id             uuid primary key default gen_random_uuid(),
  escritorio_id  uuid not null default privado.meu_escritorio() references public.escritorios on delete cascade,
  codigo         text not null,                  -- dado pelo gatilho codigo (curto e aleatório)
  titulo         text not null check (btrim(titulo) <> '' and length(titulo) <= 300),   -- TAMANHO_TAREFA em limites.ts
  descricao      text check (descricao is null or length(descricao) <= 4000),
  prazo          date,
  responsavel_id uuid not null references public.perfis on delete restrict,
  participantes  uuid[] not null default '{}' check (cardinality(participantes) <= 20),   -- perfis da equipe
  pessoas        uuid[] not null default '{}' check (cardinality(pessoas) <= 10),         -- pessoas do cadastro
  pessoa_nome    text not null default '',       -- os nomes das pessoas juntos ("A; B"), para a lista e a busca
  demanda_id     uuid references public.demandas on delete set null,
  demanda_codigo text,                            -- o código da demanda, para mostrar mesmo a quem não pode abri-la
  contrato_id    uuid references public.contratos on delete set null,
  contrato_codigo text,                           -- o número do contrato, para mostrar mesmo a quem não pode abri-lo
  -- quadro
  etapa_id       uuid references public.quadro_colunas on delete set null,
  etapa_ordem    double precision,
  -- arquivo: só tarefas arquivadas podem ser excluídas
  arquivado_em   timestamptz,
  arquivado_por  uuid references auth.users on delete set null,
  criado_por     uuid default auth.uid() references auth.users on delete set null,
  criado_em      timestamptz not null default now(),
  atualizado_por uuid references auth.users on delete set null,
  atualizado_em  timestamptz not null default now(),
  busca          text generated always as (privado.sem_acento(
                   codigo || ' ' || titulo || ' ' || coalesce(descricao, '') || ' ' || pessoa_nome || ' '
                   || coalesce(demanda_codigo, '') || ' ' || coalesce(contrato_codigo, ''))) stored,
  unique (escritorio_id, codigo)
);
create index tarefas_etapa on public.tarefas (escritorio_id, etapa_id, etapa_ordem);
create index tarefas_responsavel on public.tarefas (responsavel_id);
create index tarefas_demanda on public.tarefas (demanda_id) where demanda_id is not null;
create index tarefas_contrato on public.tarefas (contrato_id) where contrato_id is not null;

create trigger codigo before insert on public.tarefas for each row execute function privado.gerar_codigo();

-- Liga cada pessoa à tarefa: quem está numa tarefa não pode ser excluído, e a tarefa aparece no cartão dele.
create table public.tarefa_pessoas (
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  pessoa_id     uuid not null constraint tarefa_pessoas_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  ordem         integer not null default 0,
  primary key (tarefa_id, pessoa_id)
);
create index tarefa_pessoas_pessoa on public.tarefa_pessoas (pessoa_id);

-- Confere e arruma a tarefa antes de gravar:
-- - pessoas do escritório, sem repetir; os nomes juntos em pessoa_nome;
-- - responsável da equipe do escritório;
-- - participantes da equipe, sem repetir e sem o responsável;
-- - a demanda do escritório e que quem liga pode ver; o código dela copiado;
-- - o número do contrato copiado (para mostrar a quem não pode abrir o contrato).
create function privado.preparar_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid; d public.demandas;
begin
  new.titulo := btrim(new.titulo);
  foreach x in array new.pessoas loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Pessoa não encontrada neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.pessoas := v;
  new.pessoa_nome := coalesce(privado.nomes_dos_clientes(v, '; '), '');

  if not exists (select 1 from public.perfis where id = new.responsavel_id and escritorio_id = new.escritorio_id) then
    raise exception 'O responsável precisa ser alguém da equipe do escritório.';
  end if;
  v := '{}';
  foreach x in array new.participantes loop
    continue when x is null or x = any(v) or x = new.responsavel_id;
    if not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;

  if new.demanda_id is null then
    new.demanda_codigo := null;
  elsif tg_op = 'INSERT' or new.demanda_id is distinct from old.demanda_id then
    select * into d from public.demandas where id = new.demanda_id and escritorio_id = new.escritorio_id;
    if d.id is null or (auth.uid() is not null
        and not privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)) then
      raise exception 'Demanda não encontrada neste escritório.';
    end if;
    new.demanda_codigo := d.codigo;
  end if;

  if new.contrato_id is null then
    new.contrato_codigo := null;
  elsif tg_op = 'INSERT' or new.contrato_id is distinct from old.contrato_id then
    select codigo into new.contrato_codigo from public.contratos where id = new.contrato_id and escritorio_id = new.escritorio_id;
    if new.contrato_codigo is null then raise exception 'Contrato não encontrado neste escritório.'; end if;
  end if;
  return new;
end $$;
create trigger preparar before insert or update of titulo, pessoas, responsavel_id, participantes, demanda_id, contrato_id on public.tarefas
  for each row execute function privado.preparar_tarefa();
-- A cópia dos nomes das pessoas não conta como alteração da tarefa.
create trigger carimbo before update on public.tarefas
  for each row when (old.pessoa_nome is not distinct from new.pessoa_nome) execute function privado.carimbar();

create function privado.copiar_pessoas_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.tarefa_pessoas p where p.tarefa_id = new.id and p.pessoa_id <> all (new.pessoas);
  insert into public.tarefa_pessoas (tarefa_id, pessoa_id, escritorio_id, ordem)
  select new.id, u.id, new.escritorio_id, u.i::integer from unnest(new.pessoas) with ordinality as u(id, i)
  on conflict (tarefa_id, pessoa_id) do update set ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_pessoas after insert or update of pessoas on public.tarefas
  for each row execute function privado.copiar_pessoas_da_tarefa();

-- O nome de uma pessoa que muda no cadastro muda também nas tarefas dela.
create function privado.nome_da_pessoa_nas_tarefas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tarefas t set pessoa_nome = privado.nomes_dos_clientes(t.pessoas, '; ') where new.id = any(t.pessoas);
  return null;
end $$;
create trigger nome_nas_tarefas after update of nome on public.pessoas
  for each row when (old.nome is distinct from new.nome) execute function privado.nome_da_pessoa_nas_tarefas();

-- ---------------------------------------------------------------------
-- Histórico: o que mudou, campo a campo, com os nomes (das pessoas, do
-- responsável, dos participantes e da coluna) e os códigos da demanda e
-- do contrato.
-- ---------------------------------------------------------------------
create table public.tarefa_historico (
  id            bigint generated always as identity primary key,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  alteracoes    jsonb not null,                  -- {"campo": {"de": ..., "para": ...}}
  feito_por     uuid references auth.users on delete set null,
  em            timestamptz not null default now()
);
create index tarefa_historico_tarefa on public.tarefa_historico (tarefa_id, em desc);

create function privado.historico_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case k
      when 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_da_equipe(old.participantes), 'para', privado.nomes_da_equipe(new.participantes)))
      when 'pessoas' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.pessoas, ', '), 'para', privado.nomes_dos_clientes(new.pessoas, ', ')))
      when 'demanda_id' then jsonb_build_object('demanda', jsonb_build_object('de', old.demanda_codigo, 'para', new.demanda_codigo))
      when 'contrato_id' then jsonb_build_object('contrato', jsonb_build_object('de', old.contrato_codigo, 'para', new.contrato_codigo))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;
create trigger historico after update on public.tarefas for each row execute function privado.historico_tarefa();
create trigger auditoria after insert or update or delete on public.tarefas for each row execute function privado.auditar();

-- LGPD: ao excluir uma pessoa, o nome dela sai do histórico das tarefas em que já esteve.
create function privado.esquecer_pessoa_nas_tarefas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tarefa_historico h
  set alteracoes = jsonb_set(h.alteracoes, '{pessoas}', jsonb_build_object(
    'de', replace(h.alteracoes -> 'pessoas' ->> 'de', old.nome, 'pessoa excluída'),
    'para', replace(h.alteracoes -> 'pessoas' ->> 'para', old.nome, 'pessoa excluída')))
  where h.escritorio_id = old.escritorio_id and h.alteracoes ? 'pessoas'
    and (position(old.nome in coalesce(h.alteracoes -> 'pessoas' ->> 'de', '')) > 0
         or position(old.nome in coalesce(h.alteracoes -> 'pessoas' ->> 'para', '')) > 0);
  return null;
end $$;
create trigger esquecer_nas_tarefas after delete on public.pessoas
  for each row execute function privado.esquecer_pessoa_nas_tarefas();

-- ---------------------------------------------------------------------
-- Quem vê: administradores, quem criou, o responsável, os participantes
-- e quem vê a demanda ligada.
-- ---------------------------------------------------------------------
create function privado.vejo_tarefa(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_escritorio = privado.meu_escritorio()
     and (privado.sou_admin() or auth.uid() in (p_criado_por, p_responsavel) or auth.uid() = any(p_participantes)
          or exists (select 1 from public.demandas d where d.id = p_demanda
                     and privado.vejo_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores)))
$$;
revoke execute on function privado.vejo_tarefa(uuid, uuid, uuid, uuid[], uuid) from public, anon;
grant execute on function privado.vejo_tarefa(uuid, uuid, uuid, uuid[], uuid) to authenticated;

alter table public.tarefas          enable row level security;
alter table public.tarefa_pessoas   enable row level security;
alter table public.tarefa_historico enable row level security;
revoke all on public.tarefas, public.tarefa_pessoas, public.tarefa_historico from anon;
revoke insert, update, delete on public.tarefa_pessoas, public.tarefa_historico from authenticated;

create policy leitura on public.tarefas for select to authenticated
  using (privado.vejo_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id));
create policy incluir on public.tarefas for insert to authenticated
  with check (escritorio_id = (select privado.meu_escritorio()) and criado_por = (select auth.uid())
              and privado.etapa_valida(etapa_id, 'tarefas'));
create policy alterar on public.tarefas for update to authenticated
  using (privado.vejo_tarefa(escritorio_id, criado_por, responsavel_id, participantes, demanda_id))
  with check (escritorio_id = (select privado.meu_escritorio()) and privado.etapa_valida(etapa_id, 'tarefas'));
create policy apagar on public.tarefas for delete to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and arquivado_em is not null
         and (criado_por = (select auth.uid()) or (select privado.sou_admin())));
revoke update on public.tarefas from authenticated;
grant update (titulo, descricao, prazo, responsavel_id, participantes, pessoas, demanda_id, contrato_id, etapa_id, etapa_ordem,
  arquivado_em, arquivado_por) on public.tarefas to authenticated;

-- As pessoas e o histórico seguem quem vê a tarefa.
create policy leitura on public.tarefa_pessoas for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy leitura on public.tarefa_historico for select to authenticated
  using (exists (select 1 from public.tarefas t where t.id = tarefa_id));

-- ---------------------------------------------------------------------
-- Comentários também nas tarefas. Só se menciona quem vê a tarefa.
-- ---------------------------------------------------------------------
alter table public.comentarios add column tarefa_id uuid references public.tarefas on delete cascade;
create index comentarios_da_tarefa on public.comentarios (tarefa_id, criado_em desc) where tarefa_id is not null;
alter table public.comentarios drop constraint comentario_de_um_cartao;
alter table public.comentarios add constraint comentario_de_um_cartao check (num_nonnulls(pessoa_id, contrato_id, demanda_id, tarefa_id) = 1);

alter policy leitura on public.comentarios
  using (escritorio_id = (select privado.meu_escritorio())
         and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
         and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));
alter policy incluir on public.comentarios
  with check (escritorio_id = (select privado.meu_escritorio()) and autor_id = (select auth.uid())
              and (pessoa_id is null or exists (select 1 from public.pessoas p where p.id = pessoa_id))
              and (contrato_id is null or exists (select 1 from public.contratos k where k.id = contrato_id))
              and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_id))
              and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = tarefa_id)));

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
  -- Na tarefa: quem não é administrador, não está nela e não vê a demanda ligada a ela.
  if new.tarefa_id is not null then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and not exists (select 1 from public.demandas d where d.id = t.demanda_id
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)))
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------
-- Quadro de tarefas em cada escritório e o módulo ligado.
-- ---------------------------------------------------------------------
insert into public.quadro_sugestoes (modulo, nome, ordem) values
  ('tarefas', 'Para fazer', 1), ('tarefas', 'Fazendo', 2), ('tarefas', 'Aguardando retorno', 3), ('tarefas', 'Concluída', 4)
on conflict do nothing;

insert into public.quadro_colunas (escritorio_id, modulo, nome, ordem, criado_por, marco)
select e.id, 'tarefas', s.nome, s.ordem, null, case s.nome when 'Para fazer' then 'inicio' when 'Concluída' then 'concluido' end
from public.escritorios e cross join public.quadro_sugestoes s
where s.modulo = 'tarefas'
  and not exists (select 1 from public.quadro_colunas c where c.escritorio_id = e.id and c.modulo = 'tarefas');

alter table public.escritorios alter column modulos set default '{"pessoas": true, "contratos": true, "demandas": true, "tarefas": true}';
update public.escritorios set modulos = modulos || '{"tarefas": true}' where not modulos ? 'tarefas';
