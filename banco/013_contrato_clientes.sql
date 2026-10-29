-- =====================================================================
-- 013 · Contrato com mais de um cliente
--   O contrato pode ter vários clientes assinando (um casal, sócios...).
--   Ficam em "clientes", na ordem do cadastro, e o banco copia cada um
--   para contrato_clientes, que liga a pessoa ao contrato: assim quem é
--   cliente de um contrato não pode ser excluído, e o contrato aparece no
--   cartão de cada cliente.
--
--   "cliente_nome" passa a juntar os nomes de todos ("A; B"): a tabela,
--   o quadro, a ordem por nome e a busca leem dele.
--
--   Só acrescenta. A versão anterior do site continua funcionando: o
--   primeiro cliente fica também em cliente_id, e quem grava só cliente_id
--   (a versão anterior) atualiza a lista.
-- =====================================================================

alter table public.contratos add column clientes uuid[] not null default '{}' check (cardinality(clientes) <= 10);

create table public.contrato_clientes (
  contrato_id   uuid not null references public.contratos on delete cascade,
  pessoa_id     uuid not null constraint contrato_clientes_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  ordem         integer not null default 0,
  primary key (contrato_id, pessoa_id)
);
create index contrato_clientes_pessoa on public.contrato_clientes (pessoa_id);

alter table public.contrato_clientes enable row level security;
revoke all on public.contrato_clientes from anon;
revoke insert, update, delete on public.contrato_clientes from authenticated;
create policy leitura on public.contrato_clientes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

grant update (clientes) on public.contratos to authenticated;

-- Nomes dos clientes juntos, na ordem da lista.
create function privado.nomes_dos_clientes(p uuid[], separador text) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(s.nome, 'pessoa excluída'), separador order by u.i)
  from unnest(coalesce(p, '{}')) with ordinality as u(id, i)
  left join public.pessoas s on s.id = u.id
$$;

-- Confere e arruma a lista antes de gravar: cada cliente do mesmo escritório, sem repetir, ao menos um e no
-- máximo 10. O primeiro fica em cliente_id; cliente_nome junta os nomes. Quem grava só cliente_id (a versão
-- anterior do site) troca a lista por esse cliente.
create or replace function privado.contrato_cliente_nome() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v uuid[] := '{}'; x uuid;
begin
  if (tg_op = 'INSERT' and cardinality(new.clientes) = 0)
     or (tg_op = 'UPDATE' and new.clientes is not distinct from old.clientes and new.cliente_id is distinct from old.cliente_id) then
    new.clientes := case when new.cliente_id is null then '{}'::uuid[] else array[new.cliente_id] end;
  end if;
  foreach x in array new.clientes loop
    continue when x is null or x = any(v);
    if not exists (select 1 from public.pessoas where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Cliente não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  if cardinality(v) = 0 then raise exception 'Escolha o cliente.'; end if;
  if cardinality(v) > 10 then raise exception 'Um contrato pode ter até 10 clientes.'; end if;
  new.clientes := v;
  new.cliente_id := v[1];
  new.cliente_nome := privado.nomes_dos_clientes(v, '; ');
  return new;
end $$;
drop trigger cliente_nome on public.contratos;
create trigger cliente_nome before insert or update of cliente_id, clientes on public.contratos
  for each row execute function privado.contrato_cliente_nome();

-- O nome de qualquer cliente que muda no cadastro muda também nos contratos dele.
create or replace function privado.nome_do_cliente_nos_contratos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.contratos k set cliente_nome = privado.nomes_dos_clientes(k.clientes, '; ') where new.id = any(k.clientes);
  return null;
end $$;

-- Copia a lista para contrato_clientes (quem sai, sai; quem fica guarda a linha).
create function privado.copiar_clientes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contrato_clientes c where c.contrato_id = new.id and c.pessoa_id <> all (new.clientes);
  insert into public.contrato_clientes (contrato_id, pessoa_id, escritorio_id, ordem)
  select new.id, u.id, new.escritorio_id, u.i::integer from unnest(new.clientes) with ordinality as u(id, i)
  on conflict (contrato_id, pessoa_id) do update set ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_clientes after insert or update of cliente_id, clientes on public.contratos
  for each row execute function privado.copiar_clientes();

-- O histórico mostra os clientes pelo nome, uma vez só (cliente_id acompanha a lista).
create or replace function privado.historico_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'objetos',
                        'participante_id', 'participante_percentual', 'cliente_id');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k = 'indicador_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = old.indicador_id),
        'para', (select nome from public.pessoas where id = new.indicador_id)))
      when k = 'clientes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.nomes_dos_clientes(old.clientes, ', '),
        'para', privado.nomes_dos_clientes(new.clientes, ', ')))
      when k = 'participantes' then jsonb_build_object(k, jsonb_build_object(
        'de', privado.participantes_legiveis(old.participantes),
        'para', privado.participantes_legiveis(new.participantes)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;

-- LGPD: ao excluir uma pessoa, o nome dela sai também da lista de clientes no histórico dos contratos.
create or replace function privado.esquecer_pessoa_nos_contratos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_padrao text := '(^|, )' || regexp_replace(old.nome, '([.*+?^${}()|\[\]\\])', '\\\1', 'g') || '( \(|,|$)';
begin
  update public.contrato_historico h
  set alteracoes = (
    select jsonb_object_agg(e.k, case
      when e.k in ('cliente_id', 'participante_id', 'indicador_id') then jsonb_build_object(
        'de',   case when e.v ->> 'de' = old.nome then to_jsonb('pessoa excluída'::text) else e.v -> 'de' end,
        'para', case when e.v ->> 'para' = old.nome then to_jsonb('pessoa excluída'::text) else e.v -> 'para' end)
      when e.k in ('participantes', 'clientes') then jsonb_build_object(
        'de',   to_jsonb(regexp_replace(e.v ->> 'de', v_padrao, '\1pessoa excluída\2', 'g')),
        'para', to_jsonb(regexp_replace(e.v ->> 'para', v_padrao, '\1pessoa excluída\2', 'g')))
      else e.v end)
    from jsonb_each(h.alteracoes) e(k, v))
  where h.escritorio_id = old.escritorio_id
    and exists (select 1 from jsonb_each(h.alteracoes) e(k, v)
                where (e.k in ('cliente_id', 'participante_id', 'indicador_id') and old.nome in (e.v ->> 'de', e.v ->> 'para'))
                   or (e.k in ('participantes', 'clientes') and (coalesce(e.v ->> 'de', '') ~ v_padrao or coalesce(e.v ->> 'para', '') ~ v_padrao)));
  return null;
end $$;

-- Contratos que já existem: o cliente entra na lista (sem mexer no histórico nem na data de alteração).
alter table public.contratos disable trigger historico;
alter table public.contratos disable trigger carimbo;
alter table public.contratos disable trigger auditoria;
update public.contratos set clientes = array[cliente_id];
alter table public.contratos enable trigger historico;
alter table public.contratos enable trigger carimbo;
alter table public.contratos enable trigger auditoria;
