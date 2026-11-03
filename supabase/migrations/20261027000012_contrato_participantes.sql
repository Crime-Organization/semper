-- =====================================================================
-- 012 · Vários participantes por contrato
--   O contrato pode ter vários participantes, cada um com o seu %
--   (o indicador continua um só). Ficam em "participantes", uma lista
--   [{"pessoa_id": ..., "percentual": ...}] gravada junto com o contrato,
--   e o banco copia cada um para contrato_participantes, que liga a pessoa
--   ao contrato: assim quem participa de um contrato não pode ser excluído.
--
--   Todos os percentuais são sobre o total (decidido em 29/10): o
--   responsável fica com 100% − escritório − participantes − indicador.
--   A conta é feita na tela; a indicação de sócio fica para o Financeiro (#49).
--
--   Só acrescenta. A versão anterior do site continua funcionando: o
--   primeiro participante fica também em participante_id e
--   participante_percentual, e quem grava só esses dois (a versão
--   anterior) atualiza a lista.
-- =====================================================================

alter table public.contratos add column participantes jsonb not null default '[]'
  check (jsonb_typeof(participantes) = 'array' and jsonb_array_length(participantes) <= 10);

create table public.contrato_participantes (
  contrato_id   uuid not null references public.contratos on delete cascade,
  pessoa_id     uuid not null constraint contrato_participantes_pessoa_id_fkey references public.pessoas on delete restrict,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  percentual    numeric(5, 2) check (percentual between 0 and 100),
  ordem         integer not null default 0,
  primary key (contrato_id, pessoa_id)
);
create index contrato_participantes_pessoa on public.contrato_participantes (pessoa_id);

alter table public.contrato_participantes enable row level security;
revoke all on public.contrato_participantes from anon;
revoke insert, update, delete on public.contrato_participantes from authenticated;
create policy leitura on public.contrato_participantes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

grant update (participantes) on public.contratos to authenticated;

-- Confere e arruma a lista antes de gravar: cada pessoa do mesmo escritório, sem repetir, diferente do
-- indicador, com percentual de 0 a 100 (ou sem percentual). O primeiro participante fica também nas
-- colunas antigas; quem grava só as colunas antigas (a versão anterior do site) atualiza a lista.
create function privado.contrato_participantes() returns trigger
language plpgsql set search_path = '' as $$
declare v jsonb := '[]'; e jsonb; v_pessoa uuid; v_pct numeric;
begin
  if (tg_op = 'INSERT' and new.participantes = '[]' and new.participante_id is not null)
     or (tg_op = 'UPDATE' and new.participantes is not distinct from old.participantes
         and (new.participante_id is distinct from old.participante_id or new.participante_percentual is distinct from old.participante_percentual)) then
    if new.participante_id is null and new.participante_percentual is not null then
      raise exception 'Escolha o participante deste percentual.';
    end if;
    new.participantes := case when new.participante_id is null then '[]'::jsonb
      else jsonb_build_array(jsonb_build_object('pessoa_id', new.participante_id, 'percentual', new.participante_percentual)) end;
  end if;

  for e in select x from jsonb_array_elements(new.participantes) x loop
    begin
      v_pessoa := (e ->> 'pessoa_id')::uuid;
      v_pct := round((e ->> 'percentual')::numeric, 2);
    exception when others then
      raise exception 'Confira os participantes do contrato.';
    end;
    if v_pessoa is null then raise exception 'Escolha o participante deste percentual.'; end if;
    if v_pct is not null and (v_pct < 0 or v_pct > 100) then raise exception 'Use um percentual de 0 a 100.'; end if;
    if v_pessoa = new.indicador_id then raise exception 'O indicador e os participantes precisam ser pessoas diferentes.'; end if;
    if exists (select 1 from jsonb_array_elements(v) y where (y ->> 'pessoa_id')::uuid = v_pessoa) then
      raise exception 'A mesma pessoa aparece duas vezes nos participantes.';
    end if;
    if not exists (select 1 from public.pessoas where id = v_pessoa and escritorio_id = new.escritorio_id) then
      raise exception 'Participante não encontrado neste escritório.';
    end if;
    v := v || jsonb_build_array(jsonb_build_object('pessoa_id', v_pessoa, 'percentual', v_pct));
  end loop;

  new.participantes := v;
  new.participante_id := (v -> 0 ->> 'pessoa_id')::uuid;
  new.participante_percentual := (v -> 0 ->> 'percentual')::numeric;
  return new;
end $$;
create trigger participantes before insert or update of participantes, participante_id, participante_percentual, indicador_id
  on public.contratos for each row execute function privado.contrato_participantes();

-- Copia a lista para contrato_participantes (quem sai, sai; quem fica guarda a linha).
create function privado.copiar_participantes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.contrato_participantes c
  where c.contrato_id = new.id
    and not exists (select 1 from jsonb_array_elements(new.participantes) x where (x ->> 'pessoa_id')::uuid = c.pessoa_id);
  insert into public.contrato_participantes (contrato_id, pessoa_id, escritorio_id, percentual, ordem)
  select new.id, (x ->> 'pessoa_id')::uuid, new.escritorio_id, (x ->> 'percentual')::numeric, i::integer
  from jsonb_array_elements(new.participantes) with ordinality as l(x, i)
  on conflict (contrato_id, pessoa_id) do update set percentual = excluded.percentual, ordem = excluded.ordem;
  return null;
end $$;
create trigger copiar_participantes after insert or update of participantes, participante_id, participante_percentual
  on public.contratos for each row execute function privado.copiar_participantes();

-- Lista legível para o histórico: "NOME (20%), OUTRO NOME".
create function privado.participantes_legiveis(p jsonb) returns text
language sql stable security definer set search_path = '' as $$
  select nullif(string_agg(coalesce(s.nome, 'pessoa excluída')
           || coalesce(' (' || replace(trim_scale((x ->> 'percentual')::numeric)::text, '.', ',') || '%)', ''), ', ' order by i), '')
  from jsonb_array_elements(coalesce(p, '[]')) with ordinality as l(x, i)
  left join public.pessoas s on s.id = (x ->> 'pessoa_id')::uuid
$$;

-- O histórico mostra os participantes pelo nome, uma vez só (as colunas antigas acompanham a lista).
create or replace function privado.historico_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'objetos',
                        'participante_id', 'participante_percentual');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k in ('cliente_id', 'indicador_id') then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = (vo ->> k)::uuid),
        'para', (select nome from public.pessoas where id = (vn ->> k)::uuid)))
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

-- LGPD: ao excluir uma pessoa, o nome dela sai também da lista de participantes no histórico dos contratos.
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
      when e.k = 'participantes' then jsonb_build_object(
        'de',   to_jsonb(regexp_replace(e.v ->> 'de', v_padrao, '\1pessoa excluída\2', 'g')),
        'para', to_jsonb(regexp_replace(e.v ->> 'para', v_padrao, '\1pessoa excluída\2', 'g')))
      else e.v end)
    from jsonb_each(h.alteracoes) e(k, v))
  where h.escritorio_id = old.escritorio_id
    and exists (select 1 from jsonb_each(h.alteracoes) e(k, v)
                where (e.k in ('cliente_id', 'participante_id', 'indicador_id') and old.nome in (e.v ->> 'de', e.v ->> 'para'))
                   or (e.k = 'participantes' and (coalesce(e.v ->> 'de', '') ~ v_padrao or coalesce(e.v ->> 'para', '') ~ v_padrao)));
  return null;
end $$;

-- Contratos que já têm participante: ele entra na lista (sem mexer no histórico nem na data de alteração).
alter table public.contratos disable trigger historico;
alter table public.contratos disable trigger carimbo;
alter table public.contratos disable trigger auditoria;
update public.contratos
set participantes = jsonb_build_array(jsonb_build_object('pessoa_id', participante_id, 'percentual', participante_percentual))
where participante_id is not null;
alter table public.contratos enable trigger historico;
alter table public.contratos enable trigger carimbo;
alter table public.contratos enable trigger auditoria;
