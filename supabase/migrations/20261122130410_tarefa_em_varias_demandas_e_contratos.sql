-- =====================================================================
-- Tarefa ligada a mais de uma demanda e a mais de um contrato (#283)
--   Até aqui, cada tarefa tinha uma demanda (demanda_id) e um contrato (contrato_id). Agora ela pode ter várias de cada:
--   - as listas ficam na própria tarefa, em demanda_ids e contrato_ids (como as pessoas, em "pessoas"), na ordem em que foram
--     ligadas; o site grava a lista inteira, e o banco confere cada item novo (do escritório; a demanda, só a que quem liga pode ver,
--     como antes). Até 10 de cada (DEMANDAS_POR_TAREFA e CONTRATOS_POR_TAREFA em app/src/dados/limites.ts);
--   - as tabelas de ligação tarefa_demandas e tarefa_contratos (com escritorio_id e RLS) guardam uma linha por item ligado, com o
--     código dele, para mostrar a ligação mesmo a quem não pode abrir a demanda ou o contrato. Só o banco grava nelas, copiando das
--     listas da tarefa (como tarefa_pessoas);
--   - quem vê a tarefa considera todas as ligações: quem está em qualquer uma das demandas (ou no grupo dela) vê e altera a tarefa;
--     quem está em qualquer um dos contratos (ou no contrato de qualquer uma das demandas) a vê, só para ler (#326);
--   - a tarefa aparece na seção Tarefas (e no contador) de cada demanda e de cada contrato ligado;
--   - a demanda ou o contrato excluído sai da lista; a tarefa continua, ligada aos outros;
--   - o histórico registra a troca pelas listas de códigos ("Demandas: D1, D2 → D2").
--
-- Só acrescenta (colunas com default '{}', tabelas, funções e gatilhos novos; as funções e as regras trocadas mostram o mesmo de
-- antes e mais as outras ligações). A versão anterior do site continua funcionando:
--   - demanda_id e contrato_id continuam, sempre iguais ao primeiro da lista (a demanda e o contrato "principais"): o que ela lê
--     continua certo, e as ligações a mais ela simplesmente não mostra;
--   - quando ela grava demanda_id (ou contrato_id), a troca vale para o principal: o antigo sai da lista e o novo entra no lugar
--     dele; tirar (gravar null) tira só o principal, e o próximo da lista passa a ser o principal;
--   - as tabelas de ligação não têm chave estrangeira para demandas e contratos, de propósito: com ela, o PostgREST veria dois
--     caminhos de tarefas até demandas (demanda_id e a tabela de ligação) e recusaria o "demanda:demandas(...)" que a versão
--     anterior pede (PGRST201). A limpeza de quando a demanda ou o contrato é excluído vem pelos gatilhos abaixo.
-- =====================================================================

-- 1. As listas na tarefa. O primeiro de cada uma é o que demanda_id e contrato_id guardam.
alter table public.tarefas add column demanda_ids uuid[] not null default '{}'
  constraint tarefas_demanda_ids_maximo check (cardinality(demanda_ids) <= 10);    -- DEMANDAS_POR_TAREFA em limites.ts
alter table public.tarefas add column contrato_ids uuid[] not null default '{}'
  constraint tarefas_contrato_ids_maximo check (cardinality(contrato_ids) <= 10);  -- CONTRATOS_POR_TAREFA em limites.ts
create index tarefas_demanda_ids on public.tarefas using gin (demanda_ids);
create index tarefas_contrato_ids on public.tarefas using gin (contrato_ids);
grant update (demanda_ids, contrato_ids) on public.tarefas to authenticated;

-- 2. As tabelas de ligação: uma linha por demanda (ou contrato) ligada, com o código copiado.
create table public.tarefa_demandas (
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  demanda_id    uuid not null,                  -- sem chave estrangeira: veja o cabeçalho
  escritorio_id uuid not null references public.escritorios on delete cascade,
  codigo        text not null,                  -- o código da demanda, para mostrar mesmo a quem não pode abri-la
  ordem         integer not null default 0,
  primary key (tarefa_id, demanda_id)
);
create index tarefa_demandas_demanda on public.tarefa_demandas (demanda_id);
create index tarefa_demandas_escritorio on public.tarefa_demandas (escritorio_id);

create table public.tarefa_contratos (
  tarefa_id     uuid not null references public.tarefas on delete cascade,
  contrato_id   uuid not null,                  -- sem chave estrangeira: veja o cabeçalho
  escritorio_id uuid not null references public.escritorios on delete cascade,
  codigo        text not null,                  -- o número do contrato, para mostrar mesmo a quem não pode abri-lo
  ordem         integer not null default 0,
  primary key (tarefa_id, contrato_id)
);
create index tarefa_contratos_contrato on public.tarefa_contratos (contrato_id);
create index tarefa_contratos_escritorio on public.tarefa_contratos (escritorio_id);

-- Quem vê a tarefa vê as ligações dela, só do próprio escritório; ninguém grava nelas pela tela (só o banco, pelos gatilhos).
alter table public.tarefa_demandas enable row level security;
alter table public.tarefa_contratos enable row level security;
revoke all on public.tarefa_demandas, public.tarefa_contratos from anon;
revoke insert, update, delete, truncate, references, trigger on public.tarefa_demandas, public.tarefa_contratos from authenticated;
grant select on public.tarefa_demandas, public.tarefa_contratos to authenticated;
create policy leitura on public.tarefa_demandas for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.tarefas t where t.id = tarefa_id));
create policy leitura on public.tarefa_contratos for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()) and exists (select 1 from public.tarefas t where t.id = tarefa_id));

-- 3. As tarefas de hoje passam a ter a lista com a demanda e o contrato delas. Os gatilhos ficam desligados só durante este
--    preenchimento (como em 20261118200000_data_de_inicio.sql): não é uma alteração feita por alguém, então não entra no histórico
--    nem na auditoria e não muda o "atualizado em". As chaves estrangeiras não são gatilhos de usuário e continuam valendo.
alter table public.tarefas disable trigger user;
update public.tarefas set
  demanda_ids = case when demanda_id is null then '{}' else array[demanda_id] end,
  contrato_ids = case when contrato_id is null then '{}' else array[contrato_id] end
where demanda_id is not null or contrato_id is not null;
alter table public.tarefas enable trigger user;
insert into public.tarefa_demandas (tarefa_id, demanda_id, escritorio_id, codigo, ordem)
select t.id, t.demanda_id, t.escritorio_id, coalesce(t.demanda_codigo, d.codigo), 1
from public.tarefas t join public.demandas d on d.id = t.demanda_id;
insert into public.tarefa_contratos (tarefa_id, contrato_id, escritorio_id, codigo, ordem)
select t.id, t.contrato_id, t.escritorio_id, coalesce(t.contrato_codigo, k.codigo), 1
from public.tarefas t join public.contratos k on k.id = t.contrato_id;

-- 4. Antes de gravar: as listas e as colunas de antes, sempre juntas.
--    - A versão anterior grava só demanda_id (ou contrato_id): a troca vale para o principal (o antigo sai da lista, o novo entra no
--      lugar dele). Na inclusão, a demanda_id que vier entra no começo da lista.
--    - Cada item que entra na lista é conferido: do escritório e, na demanda, uma que quem liga pode ver (como antes). Os que já
--      estavam não são conferidos de novo: quem não vê uma das demandas ligadas por outra pessoa ainda tira as suas.
--    - Sem repetir; demanda_id e contrato_id passam a ser o primeiro de cada lista, com o código copiado.
--    Roda antes de "preparar" (os gatilhos rodam em ordem alfabética), que agora só confere as pessoas e a equipe.
create function privado.ligacoes_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v uuid[] := '{}'; x uuid; d public.demandas; antes_d uuid[] := '{}'; antes_k uuid[] := '{}';
begin
  if tg_op = 'INSERT' then
    if new.demanda_id is not null then new.demanda_ids := new.demanda_id || array_remove(new.demanda_ids, new.demanda_id); end if;
    if new.contrato_id is not null then new.contrato_ids := new.contrato_id || array_remove(new.contrato_ids, new.contrato_id); end if;
  else
    -- A tarefa gravada sem a lista (com os gatilhos desligados, numa importação) conta com a lista do principal.
    antes_d := case when cardinality(old.demanda_ids) = 0 and old.demanda_id is not null then array[old.demanda_id] else old.demanda_ids end;
    antes_k := case when cardinality(old.contrato_ids) = 0 and old.contrato_id is not null then array[old.contrato_id] else old.contrato_ids end;
    if new.demanda_ids is not distinct from old.demanda_ids then
      new.demanda_ids := antes_d;
      if new.demanda_id is distinct from old.demanda_id then
        new.demanda_ids := array_remove(antes_d, old.demanda_id);
        if new.demanda_id is not null then new.demanda_ids := new.demanda_id || array_remove(new.demanda_ids, new.demanda_id); end if;
      end if;
    end if;
    if new.contrato_ids is not distinct from old.contrato_ids then
      new.contrato_ids := antes_k;
      if new.contrato_id is distinct from old.contrato_id then
        new.contrato_ids := array_remove(antes_k, old.contrato_id);
        if new.contrato_id is not null then new.contrato_ids := new.contrato_id || array_remove(new.contrato_ids, new.contrato_id); end if;
      end if;
    end if;
  end if;

  foreach x in array new.demanda_ids loop
    continue when x is null or x = any(v);
    if not x = any(antes_d) then
      select * into d from public.demandas where id = x and escritorio_id = new.escritorio_id;
      if d.id is null or (auth.uid() is not null
          and not privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)) then
        raise exception 'Demanda não encontrada neste escritório.';
      end if;
    end if;
    v := v || x;
  end loop;
  new.demanda_ids := v;
  if tg_op = 'INSERT' or v[1] is distinct from old.demanda_id then
    new.demanda_id := v[1];
    new.demanda_codigo := (select codigo from public.demandas where id = v[1]);
  end if;

  v := '{}';
  foreach x in array new.contrato_ids loop
    continue when x is null or x = any(v);
    if not x = any(antes_k)
       and not exists (select 1 from public.contratos where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'Contrato não encontrado neste escritório.';
    end if;
    v := v || x;
  end loop;
  new.contrato_ids := v;
  if tg_op = 'INSERT' or v[1] is distinct from old.contrato_id then
    new.contrato_id := v[1];
    new.contrato_codigo := (select codigo from public.contratos where id = v[1]);
  end if;
  return new;
end $$;
revoke execute on function privado.ligacoes_da_tarefa() from public, anon, authenticated;
create trigger ligacoes before insert or update on public.tarefas for each row execute function privado.ligacoes_da_tarefa();

-- A de antes (20261119233811_grupos_da_equipe.sql), sem a demanda e o contrato: eles são conferidos e copiados acima, pela lista.
-- Se ficassem aqui, tirar a demanda principal conferiria de novo a próxima, e quem não a vê não conseguiria tirar a sua.
CREATE OR REPLACE FUNCTION privado.preparar_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v uuid[] := '{}'; x uuid;
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
    -- Confere só quem está entrando: quem já estava e saiu da equipe não trava a saída de ninguém.
    if (tg_op = 'INSERT' or x <> all(old.participantes))
       and not exists (select 1 from public.perfis where id = x and escritorio_id = new.escritorio_id) then
      raise exception 'O participante precisa ser alguém da equipe do escritório.';
    end if;
    v := v || x;
  end loop;
  new.participantes := v;
  return new;
end $function$;

-- 5. Depois de gravar: as tabelas de ligação copiam as listas (com o código de cada item e a ordem).
create function privado.copiar_ligacoes_da_tarefa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.demanda_ids is not distinct from old.demanda_ids and new.contrato_ids is not distinct from old.contrato_ids then
    return null;
  end if;
  delete from public.tarefa_demandas l where l.tarefa_id = new.id and l.demanda_id <> all (new.demanda_ids);
  insert into public.tarefa_demandas (tarefa_id, demanda_id, escritorio_id, codigo, ordem)
  select new.id, u.id, new.escritorio_id, d.codigo, u.i::integer
  from unnest(new.demanda_ids) with ordinality as u(id, i) join public.demandas d on d.id = u.id
  on conflict (tarefa_id, demanda_id) do update set ordem = excluded.ordem;
  delete from public.tarefa_contratos l where l.tarefa_id = new.id and l.contrato_id <> all (new.contrato_ids);
  insert into public.tarefa_contratos (tarefa_id, contrato_id, escritorio_id, codigo, ordem)
  select new.id, u.id, new.escritorio_id, k.codigo, u.i::integer
  from unnest(new.contrato_ids) with ordinality as u(id, i) join public.contratos k on k.id = u.id
  on conflict (tarefa_id, contrato_id) do update set ordem = excluded.ordem;
  return null;
end $$;
revoke execute on function privado.copiar_ligacoes_da_tarefa() from public, anon, authenticated;
create trigger copiar_ligacoes after insert or update on public.tarefas for each row execute function privado.copiar_ligacoes_da_tarefa();

-- 6. A demanda ou o contrato excluído sai das listas das tarefas; elas continuam, ligadas aos outros. (Quando é o principal, a
--    chave estrangeira de demanda_id/contrato_id já o tira, e o gatilho "ligacoes" põe o próximo da lista no lugar.)
create function privado.demanda_sai_das_tarefas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tarefas set demanda_ids = array_remove(demanda_ids, old.id)
  where escritorio_id = old.escritorio_id and demanda_ids @> array[old.id];
  return null;
end $$;
revoke execute on function privado.demanda_sai_das_tarefas() from public, anon, authenticated;
create trigger sai_das_tarefas after delete on public.demandas for each row execute function privado.demanda_sai_das_tarefas();

create function privado.contrato_sai_das_tarefas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.tarefas set contrato_ids = array_remove(contrato_ids, old.id)
  where escritorio_id = old.escritorio_id and contrato_ids @> array[old.id];
  return null;
end $$;
revoke execute on function privado.contrato_sai_das_tarefas() from public, anon, authenticated;
create trigger sai_das_tarefas after delete on public.contratos for each row execute function privado.contrato_sai_das_tarefas();

-- 7. O histórico: as listas pelos códigos, em ordem ("demanda excluída" para a que não existe mais). Quando a lista muda, a coluna
--    de antes (o principal) não entra de novo. Igual à de 20261121164027_tempo_apagar_e_corrigir.sql, salvo isso.
create function privado.codigos_das_demandas(p uuid[]) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(d.codigo, 'demanda excluída'), ', ' order by u.i)
  from unnest(coalesce(p, '{}')) with ordinality as u(id, i) left join public.demandas d on d.id = u.id
$$;
revoke execute on function privado.codigos_das_demandas(uuid[]) from public, anon, authenticated;
create function privado.codigos_dos_contratos(p uuid[]) returns text
language sql stable security definer set search_path = '' as $$
  select string_agg(coalesce(k.codigo, 'contrato excluído'), ', ' order by u.i)
  from unnest(coalesce(p, '{}')) with ordinality as u(id, i) left join public.contratos k on k.id = u.id
$$;
revoke execute on function privado.codigos_dos_contratos(uuid[]) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION privado.historico_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a jsonb := '{}'; k text; vo jsonb := to_jsonb(old); vn jsonb := to_jsonb(new);
begin
  for k in select jsonb_object_keys(vn) loop
    continue when k in ('id', 'escritorio_id', 'codigo', 'pessoa_nome', 'demanda_codigo', 'contrato_codigo', 'busca', 'etapa_ordem',
                        'arquivado_por', 'criado_por', 'criado_em', 'atualizado_por', 'atualizado_em', 'concluida_em');
    continue when vo -> k is not distinct from vn -> k;
    -- O processo excluído tira a ligação sozinho (on delete set null): sem nome dos dois lados, não há o que mostrar.
    continue when k = 'processo_id' and new.processo_id is null and privado.nome_do_processo_no_historico(old.processo_id) is null;
    -- A lista mudou: ela já conta a troca do principal (#283).
    continue when k = 'demanda_id' and new.demanda_ids is distinct from old.demanda_ids;
    continue when k = 'contrato_id' and new.contrato_ids is distinct from old.contrato_ids;
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
      when 'demanda_ids' then jsonb_build_object('demandas', jsonb_build_object(
        'de', privado.codigos_das_demandas(old.demanda_ids), 'para', privado.codigos_das_demandas(new.demanda_ids)))
      when 'contrato_ids' then jsonb_build_object('contratos', jsonb_build_object(
        'de', privado.codigos_dos_contratos(old.contrato_ids), 'para', privado.codigos_dos_contratos(new.contrato_ids)))
      when 'processo_id' then jsonb_build_object('processo', jsonb_build_object(
        'de', privado.nome_do_processo_no_historico(old.processo_id), 'para', privado.nome_do_processo_no_historico(new.processo_id)))
      when 'grupos' then jsonb_build_object(k, jsonb_build_object('de', privado.nomes_dos_grupos(old.grupos), 'para', privado.nomes_dos_grupos(new.grupos)))
      else jsonb_build_object(k, jsonb_build_object('de', vo -> k, 'para', vn -> k))
    end;
  end loop;
  if a <> '{}' then
    insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
    values (new.escritorio_id, new.id, a, auth.uid());
  end if;
  return null;
end $function$;

-- 8. "Estou na tarefa" com todas as demandas: a de antes (estou_na_tarefa, com a principal, p_demanda) e as outras da lista.
--    Recebe as duas porque uma tarefa gravada com os gatilhos desligados (importação) pode ter só a principal.
create function privado.estou_na_tarefa_ligada(p_escritorio uuid, p_criado_por uuid, p_responsavel uuid, p_participantes uuid[], p_demanda uuid,
  p_demandas uuid[], p_grupos uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select privado.estou_na_tarefa(p_escritorio, p_criado_por, p_responsavel, p_participantes, p_demanda, p_grupos)
      or (coalesce(cardinality(p_demandas), 0) > 0 and p_escritorio = privado.meu_escritorio()
          and exists (select 1 from unnest(p_demandas) as u(id) join public.demandas d on d.id = u.id
                      where u.id is distinct from p_demanda
                        and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
$$;
revoke execute on function privado.estou_na_tarefa_ligada(uuid, uuid, uuid, uuid[], uuid, uuid[], uuid[]) from public, anon;
grant execute on function privado.estou_na_tarefa_ligada(uuid, uuid, uuid, uuid[], uuid, uuid[], uuid[]) to authenticated;

-- 9. As regras: as de hoje (20261119233811_grupos_da_equipe.sql), com a função nova e, na leitura, as demandas e os contratos a mais.
--    O caminho de antes (pelo principal, com o hash das demandas do grupo) continua primeiro; as listas só são olhadas quando têm
--    mais de um item, para a leitura continuar rápida (#278). As demandas a mais do grupo entram pela função (estou_na_demanda
--    conta o grupo), sem comparar a lista inteira das demandas do grupo cartão a cartão.
alter policy leitura on public.tarefas
  using (escritorio_id = (select privado.meu_escritorio())
         and ((select privado.sou_admin()) or (select privado.equipe_edita_tudo()) or (select privado.equipe_ve_tudo())
              or (select auth.uid()) in (criado_por, responsavel_id) or (select auth.uid()) = any(participantes)
              or contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
              or demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
              or grupos && (select privado.meus_grupos())
              or demanda_id in (select unnest((select privado.demandas_dos_meus_grupos())))
              or (cardinality(contrato_ids) > 1 and contrato_ids && (select privado.contratos_em_que_estou())::uuid[])
              or (cardinality(demanda_ids) > 1 and demanda_ids && (select privado.demandas_dos_meus_contratos())::uuid[])
              or (demanda_id is not null and privado.estou_na_tarefa_ligada(escritorio_id, criado_por, responsavel_id, participantes, demanda_id, demanda_ids, grupos))));
alter policy alterar on public.tarefas
  using (privado.estou_na_tarefa_ligada(escritorio_id, criado_por, responsavel_id, participantes, demanda_id, demanda_ids, grupos));

alter policy tudo on public.demanda_listas
  using ((escritorio_id = (select privado.meu_escritorio()))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_listas.demanda_id
                                            and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = demanda_listas.tarefa_id
                                           and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)))
         and (contrato_id is null or privado.altero_o_contrato(contrato_id)))
  with check ((escritorio_id = (select privado.meu_escritorio()))
         and (demanda_id is null or exists (select 1 from public.demandas d where d.id = demanda_listas.demanda_id
                                            and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
         and (tarefa_id is null or exists (select 1 from public.tarefas t where t.id = demanda_listas.tarefa_id
                                           and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)))
         and (contrato_id is null or privado.altero_o_contrato(contrato_id)));
alter policy apagar on public.tarefa_etiquetas
  using (escritorio_id = (select privado.meu_escritorio())
         and exists (select 1 from public.tarefas t where t.id = tarefa_etiquetas.tarefa_id
                     and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)));
alter policy incluir on public.tarefa_etiquetas
  with check (escritorio_id = (select privado.meu_escritorio())
              and exists (select 1 from public.tarefas t where t.id = tarefa_etiquetas.tarefa_id
                          and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)));
alter policy incluir on public.tarefa_tempos
  with check (escritorio_id = (select privado.meu_escritorio()) and perfil_id = (select auth.uid())
              and exists (select 1 from public.tarefas t where t.id = tarefa_tempos.tarefa_id
                          and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)));

-- 10. As funções que conferiam a tarefa pela demanda e pelo contrato principais passam a olhar as listas (iguais às de hoje, salvo isso).
CREATE OR REPLACE FUNCTION privado.altero_a_lista(p_lista uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.demanda_listas l
                 left join public.demandas d on d.id = l.demanda_id
                 left join public.tarefas t on t.id = l.tarefa_id
                 where l.id = p_lista
                   and (l.demanda_id is null or (d.id is not null and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)))
                   and (l.tarefa_id is null or (t.id is not null and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)))
                   and (l.contrato_id is null or privado.altero_o_contrato(l.contrato_id)))
$function$;

CREATE OR REPLACE FUNCTION privado.anotacoes_pelos_itens()
 RETURNS uuid[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(array_agg(distinct l.anotacao_id), '{}')
    from public.anotacao_ligacoes l
    left join public.processos p on p.id = l.processo_id
    left join public.demandas d on d.id = l.demanda_id
    left join public.tarefas t on t.id = l.tarefa_id
    left join public.compromissos c on c.id = l.compromisso_id
    left join public.contratos k on k.id = l.contrato_id
    where l.escritorio_id = (select privado.meu_escritorio())
      and ((p.id is not null and privado.estou_no_processo(p.escritorio_id, p.criado_por, p.responsavel_id, p.colaboradores, '{}'))
        or (p.id is not null and p.escritorio_id = (select privado.meu_escritorio()) and p.grupos && (select privado.meus_grupos()))
        or (d.id is not null and privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, '{}'))
        or (d.id is not null and d.escritorio_id = (select privado.meu_escritorio())
            and (d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[]) or d.grupos && (select privado.meus_grupos())))
        or (t.id is not null and privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, '{}'))
        or (t.id is not null and t.escritorio_id = (select privado.meu_escritorio())
            and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                 or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
                 or t.grupos && (select privado.meus_grupos())
                 or t.demanda_id = any ((select privado.demandas_dos_meus_grupos())::uuid[])
                 or t.contrato_ids && (select privado.contratos_em_que_estou())::uuid[]
                 or t.demanda_ids && (select privado.demandas_dos_meus_contratos())::uuid[]
                 or t.demanda_ids && (select privado.demandas_dos_meus_grupos())))
        or (c.id is not null and ((c.geral and c.escritorio_id = (select privado.meu_escritorio()))
                                  or privado.estou_no_compromisso(c.escritorio_id, c.criado_por, c.responsavel_id, c.participantes, c.processo_id, '{}')
                                  or (c.escritorio_id = (select privado.meu_escritorio())
                                      and (c.grupos && (select privado.meus_grupos())
                                           or c.processo_id = any ((select privado.processos_dos_meus_grupos())::uuid[])))))
        or (k.id is not null and k.escritorio_id = (select privado.meu_escritorio())
            and ((select privado.sou_admin())
                 or (select auth.uid()) in (k.criado_por, k.responsavel_id)
                 or k.participantes @> jsonb_build_array(jsonb_build_object('pessoa_id', (select privado.minha_pessoa())))
                 or k.id = any ((select privado.contratos_em_que_me_mencionaram())::uuid[])
                 or k.grupos && (select privado.meus_grupos()))))
$function$;

-- Na tarefa, pode ser mencionado também quem está em qualquer uma das demandas ligadas (ou no contrato dela, ou no grupo dela) e
-- quem está em qualquer um dos contratos ligados.
CREATE OR REPLACE FUNCTION privado.conferir_mencoes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_nome text;
begin
  if new.contrato_id is not null then
    select p.nome into v_nome from public.perfis p where p.id = any(new.mencoes) and p.funcao <> 'advogado' order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % em contratos: só advogados podem ser mencionados.', v_nome;
    end if;
  end if;
  -- Na demanda: quem não é administrador, não está nela e não está no contrato dela.
  if new.demanda_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.demandas d
    where d.id = new.demanda_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from d.criado_por and p.id <> d.responsavel_id and not p.id = any(d.colaboradores)
      and not privado.perfil_no_contrato(p.id, d.contrato_id)
      and not privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta demanda: inclua essa pessoa como colaboradora antes.', v_nome;
    end if;
  end if;
  -- Na tarefa: quem não é administrador, não está nela, não vê nenhuma das demandas ligadas e não está em nenhum dos contratos
  -- dela (nem no de uma das demandas).
  if new.tarefa_id is not null and not privado.equipe_ve_tudo() then
    select p.nome into v_nome from public.perfis p, public.tarefas t
    where t.id = new.tarefa_id and p.id = any(new.mencoes) and p.papel not in ('master', 'admin')
      and p.id is distinct from t.criado_por and p.id <> t.responsavel_id and not p.id = any(t.participantes)
      and not exists (select 1 from public.demandas d where (d.id = t.demanda_id or t.demanda_ids @> array[d.id])
                      and (p.id = d.criado_por or p.id = d.responsavel_id or p.id = any(d.colaboradores)
                           or privado.perfil_no_contrato(p.id, d.contrato_id)
                           or privado.perfil_nos_grupos(d.escritorio_id, p.id, d.grupos)))
      and not privado.perfil_no_contrato(p.id, t.contrato_id)
      and not exists (select 1 from unnest(t.contrato_ids) as k(id) where privado.perfil_no_contrato(p.id, k.id))
      and not privado.perfil_nos_grupos(t.escritorio_id, p.id, t.grupos)
    order by p.nome limit 1;
    if v_nome is not null then
      raise exception 'Não é possível mencionar % nesta tarefa: inclua essa pessoa como participante antes.', v_nome;
    end if;
  end if;
  return null;
end $function$;

CREATE OR REPLACE FUNCTION privado.preparar_andamento()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.texto := btrim(new.texto);
  new.local := nullif(btrim(new.local), '');
  -- A tarefa foi desligada (ou excluída) sem ninguém mexer na marcação: a intimação volta a ficar a tratar.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is null and new.tratada_em is not distinct from old.tratada_em then
    new.tratada_em := null;
  end if;
  if new.tratada_em is null then
    new.tratada_por := null;
  elsif tg_op = 'INSERT' or old.tratada_em is null then
    new.tratada_em := now();
    new.tratada_por := auth.uid();
  else
    new.tratada_em := old.tratada_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION privado.preparar_prazo()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
  new.descricao := btrim(new.descricao);
  if new.concluido_em is null then
    new.concluido_por := null;
  elsif tg_op = 'INSERT' or old.concluido_em is null then
    new.concluido_em := now();
    new.concluido_por := auth.uid();
  else
    new.concluido_em := old.concluido_em;
  end if;
  if new.excluido_em is not null then
    new.excluido_em := case when tg_op = 'UPDATE' and old.excluido_em is not null then old.excluido_em else now() end;
  end if;
  if new.andamento_id is not null and (tg_op = 'INSERT' or new.andamento_id is distinct from old.andamento_id)
     and not exists (select 1 from public.processo_andamentos a where a.id = new.andamento_id and a.processo_id = new.processo_id) then
    raise exception 'Este andamento não é deste processo.';
  end if;
  -- Outra pessoa já criou a tarefa, com a tela desatualizada aqui: não troca uma tarefa por outra.
  if tg_op = 'UPDATE' and old.tarefa_id is not null and new.tarefa_id is not null and new.tarefa_id <> old.tarefa_id then
    raise exception 'Já existe uma tarefa ligada a este item.';
  end if;
  if new.tarefa_id is not null and (tg_op = 'INSERT' or new.tarefa_id is distinct from old.tarefa_id)
     and not exists (select 1 from public.tarefas t where t.id = new.tarefa_id and t.escritorio_id = new.escritorio_id
                     and (auth.uid() is null or privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos))) then
    raise exception 'Tarefa não encontrada neste escritório.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.itens_para_pedir(p_termo text)
 RETURNS TABLE(modulo text, grupo text, id uuid, codigo text, numero text, pedido_id uuid)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select c.modulo, c.grupo, c.id, c.codigo, c.numero,
         (select p.id from public.pedidos_de_participacao p
          where p.item_id = c.id and p.pedido_por = (select auth.uid()) and p.situacao = 'pendente')
  from privado.itens_pelo_codigo(p_termo) c
  where not case c.modulo
    when 'tarefas' then exists (select 1 from public.tarefas x where x.id = c.id)
    when 'demandas' then exists (select 1 from public.demandas x where x.id = c.id)
    when 'processos' then exists (select 1 from public.processos x where x.id = c.id)
    when 'compromissos' then exists (select 1 from public.compromissos x where x.id = c.id)
    when 'anotacoes' then exists (select 1 from public.anotacoes x where x.id = c.id)
    when 'contratos' then exists (select 1 from public.contratos_da_equipe x where x.id = c.id)
  end
  and (c.modulo <> 'contratos'
       or exists (select 1 from public.demandas d where d.contrato_id = c.id)
       or exists (select 1 from public.tarefas t where t.contrato_id = c.id)
       or exists (select 1 from public.tarefas t where t.contrato_ids @> array[c.id]))
$function$;

CREATE OR REPLACE FUNCTION public.resumo_do_tempo(p_tarefa uuid)
 RETURNS TABLE(perfil_id uuid, percentual numeric, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with visivel as (
    select t.id from public.tarefas t
    where t.id = p_tarefa
      and (privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos)
           or (t.escritorio_id = privado.meu_escritorio()
               and (t.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])
                    or t.demanda_id = any ((select privado.demandas_dos_meus_contratos())::uuid[])
                    or t.contrato_ids && (select privado.contratos_em_que_estou())::uuid[]
                    or t.demanda_ids && (select privado.demandas_dos_meus_contratos())::uuid[])))
  ), por_pessoa as (
    select tt.perfil_id, sum(tt.segundos)::bigint as s from public.tarefa_tempos tt join visivel v on v.id = tt.tarefa_id group by tt.perfil_id
  ), soma as (select coalesce(sum(greatest(s, 0)), 0)::bigint as total from por_pessoa)
  select p.perfil_id, round(100.0 * p.s / soma.total, 1), soma.total
  from por_pessoa p, soma where p.s > 0 and soma.total > 0
  order by 2 desc
$function$;

CREATE OR REPLACE FUNCTION public.tarefas_dos_grupos(p_grupos uuid[])
 RETURNS SETOF tarefas
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select t.* from public.tarefas t
  where t.grupos && p_grupos
     or t.demanda_id in (select d.id from public.demandas d where d.grupos && p_grupos)
     or (cardinality(t.demanda_ids) > 1 and t.demanda_ids && array(select d.id from public.demandas d where d.grupos && p_grupos))
$function$;

-- O tempo da demanda soma o de todas as tarefas ligadas a ela (a tarefa de duas demandas conta nas duas).
CREATE OR REPLACE FUNCTION public.tempo_da_demanda(p_demanda uuid)
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select greatest(coalesce(sum(tt.segundos), 0), 0)::bigint
  from public.demandas d
  join public.tarefas t on (t.demanda_id = d.id or t.demanda_ids @> array[d.id])
  join public.tarefa_tempos tt on tt.tarefa_id = t.id
  where d.id = p_demanda
    and (privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)
         or (d.escritorio_id = privado.meu_escritorio() and d.contrato_id = any ((select privado.contratos_em_que_estou())::uuid[])))
$function$;

CREATE OR REPLACE FUNCTION public.tempo_devolver(p_tarefa uuid, p_perfil uuid, p_inicio timestamp with time zone, p_segundos integer, p_ajuste boolean, p_motivo text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_escritorio uuid := privado.meu_escritorio(); v_id bigint;
begin
  if v_escritorio is null or not (privado.sou_admin() or (p_perfil is not null and p_perfil = auth.uid())) then
    raise exception 'Só quem registrou o tempo, ou um administrador, devolve o registro.';
  end if;
  -- A tarefa que quem pede vê, nas mesmas condições das regras de leitura das tarefas ("leitura", na versão de
  -- 20261122130410_tarefa_em_varias_demandas_e_contratos.sql, e "equipe_ve_tudo"), que valem para apagar o registro: quem apaga também devolve.
  if not exists (select 1 from public.tarefas t where t.id = p_tarefa and t.escritorio_id = v_escritorio
                 and (privado.equipe_ve_tudo()
                      or t.contrato_id = any (privado.contratos_em_que_estou()::uuid[])
                      or t.demanda_id = any (privado.demandas_dos_meus_contratos()::uuid[])
                      or t.demanda_id in (select unnest(privado.demandas_dos_meus_grupos()))
                      or t.contrato_ids && privado.contratos_em_que_estou()::uuid[]
                      or t.demanda_ids && privado.demandas_dos_meus_contratos()::uuid[]
                      or t.demanda_ids && privado.demandas_dos_meus_grupos()
                      or privado.estou_na_tarefa_ligada(t.escritorio_id, t.criado_por, t.responsavel_id, t.participantes, t.demanda_id, t.demanda_ids, t.grupos))) then
    raise exception 'Tarefa não encontrada.';
  end if;
  if p_perfil is not null and not exists (select 1 from public.perfis where id = p_perfil and escritorio_id = v_escritorio) then
    raise exception 'Usuário não encontrado.';
  end if;
  insert into public.tarefa_tempos (escritorio_id, tarefa_id, perfil_id, inicio, segundos, ajuste, motivo)
  values (v_escritorio, p_tarefa, p_perfil, p_inicio, p_segundos, p_ajuste, case when p_ajuste then p_motivo end)
  returning id into v_id;
  insert into public.tarefa_historico (escritorio_id, tarefa_id, alteracoes, feito_por)
  values (v_escritorio, p_tarefa, jsonb_build_object('tempo', jsonb_build_object('de', null,
    'para', 'Devolvido ' || privado.registro_de_tempo_no_historico(p_perfil, p_ajuste, p_inicio))), auth.uid());
  return v_id;
end $function$;
