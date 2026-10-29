-- =====================================================================
-- 010 · Vários objetos por contrato e lista de objetos do escritório
--   O contrato passa a ter um ou mais objetos (ex.: registro de marca;
--   busca de anterioridade), guardados um a um em "objetos", para que o
--   módulo Demandas crie uma demanda por objeto quando o contrato for
--   assinado (#45). Valor, entrada e parcelas continuam do contrato inteiro.
--
--   Cada objeto salvo entra na lista do escritório (objeto_sugestoes),
--   que aparece como sugestão para todos ao cadastrar outro contrato.
--
--   "servico" continua existindo, com os objetos juntos ("a; b"): a tabela,
--   o quadro, a busca e a versão anterior do site leem dele. O banco mantém
--   os dois iguais: quem grava "objetos" atualiza "servico", e quem grava só
--   "servico" (a versão anterior do site) atualiza "objetos".
--
--   Só acrescenta, com uma exceção compatível: o limite de "servico" sobe
--   de 300 para 6.100 caracteres, para caberem os objetos juntos.
-- =====================================================================

alter table public.contratos
  add column objetos text[] not null default '{}' check (cardinality(objetos) <= 20);

-- "servico" passa a guardar os objetos juntos: até 20 objetos de 300 caracteres e os separadores.
alter table public.contratos drop constraint contratos_servico_check;
alter table public.contratos add constraint contratos_servico_tamanho check (btrim(servico) <> '' and length(servico) <= 6100);

-- Objetos limpos: sem espaços nas pontas, sem linhas vazias e sem repetir (ignorando maiúsculas e acentos),
-- na ordem em que foram escritos.
create function privado.limpar_objetos(p text[]) returns text[]
language sql immutable parallel safe set search_path = '' as $$
  select coalesce(array_agg(o order by primeira), '{}')
  from (select min(i) as primeira, (array_agg(btrim(x) order by i))[1] as o
        from unnest(coalesce(p, '{}')) with ordinality as u(x, i)
        where btrim(coalesce(x, '')) <> ''
        group by privado.sem_acento(btrim(x))) s
$$;

-- Mantém "objetos" e "servico" iguais. Na versão anterior do site, que só grava "servico", os objetos
-- saem do texto, separados por ";".
create function privado.contrato_objetos() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and cardinality(new.objetos) = 0)
     or (tg_op = 'UPDATE' and new.objetos is not distinct from old.objetos and new.servico is distinct from old.servico) then
    new.objetos := string_to_array(new.servico, ';');
  end if;
  new.objetos := privado.limpar_objetos(new.objetos);
  if cardinality(new.objetos) = 0 then raise exception 'Informe ao menos um objeto do contrato.'; end if;
  if cardinality(new.objetos) > 20 then raise exception 'Um contrato pode ter até 20 objetos.'; end if;
  if exists (select 1 from unnest(new.objetos) o where length(o) > 300) then
    raise exception 'Cada objeto do contrato pode ter até 300 caracteres.';
  end if;
  new.servico := array_to_string(new.objetos, '; ');
  return new;
end $$;
create trigger objetos before insert or update of servico, objetos on public.contratos
  for each row execute function privado.contrato_objetos();

grant update (objetos) on public.contratos to authenticated;

-- O histórico registra a mudança dos objetos uma vez só, pelo texto de "servico" ("a; b" → "a; c").
create or replace function privado.historico_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'numero', 'sigla', 'ano', 'codigo', 'cliente_nome', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'objetos');
    continue when vo -> k is not distinct from vn -> k;
    a := a || case
      when k = 'etapa_id' then jsonb_build_object('etapa', jsonb_build_object(
        'de', (select nome from public.quadro_colunas where id = old.etapa_id),
        'para', (select nome from public.quadro_colunas where id = new.etapa_id)))
      when k = 'responsavel_id' then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.perfis where id = old.responsavel_id),
        'para', (select nome from public.perfis where id = new.responsavel_id)))
      when k in ('cliente_id', 'participante_id', 'indicador_id') then jsonb_build_object(k, jsonb_build_object(
        'de', (select nome from public.pessoas where id = (vo ->> k)::uuid),
        'para', (select nome from public.pessoas where id = (vn ->> k)::uuid)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.contrato_historico (escritorio_id, contrato_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------
-- Lista de objetos do escritório: cada objeto salvo num contrato entra
-- aqui (uma vez só) e aparece como sugestão para todos do escritório.
-- ---------------------------------------------------------------------
create table public.objeto_sugestoes (
  id            uuid primary key default gen_random_uuid(),
  escritorio_id uuid not null references public.escritorios on delete cascade,
  descricao     text not null check (btrim(descricao) <> '' and length(descricao) <= 300),
  criado_por    uuid references auth.users on delete set null,
  criado_em     timestamptz not null default now()
);
create unique index objeto_sugestoes_unico on public.objeto_sugestoes (escritorio_id, privado.sem_acento(btrim(descricao)));

create function privado.guardar_objetos() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.objeto_sugestoes (escritorio_id, descricao, criado_por)
  select new.escritorio_id, o, auth.uid() from unnest(new.objetos) o
  on conflict (escritorio_id, privado.sem_acento(btrim(descricao))) do nothing;
  return null;
end $$;
create trigger guardar_objetos after insert or update of servico, objetos on public.contratos
  for each row execute function privado.guardar_objetos();

alter table public.objeto_sugestoes enable row level security;
revoke all on public.objeto_sugestoes from anon;
revoke insert, update, delete on public.objeto_sugestoes from authenticated;
create policy leitura on public.objeto_sugestoes for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

-- ---------------------------------------------------------------------
-- Contratos que já existem: o serviço vira a lista de objetos (separada
-- por ";"), e os objetos entram na lista do escritório.
-- ---------------------------------------------------------------------
update public.contratos set objetos = string_to_array(servico, ';');
