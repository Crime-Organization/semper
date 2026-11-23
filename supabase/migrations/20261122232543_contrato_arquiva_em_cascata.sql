-- =====================================================================
-- Arquivar o contrato arquiva junto o que está ligado a ele (#284, parte 1)
--   Ao arquivar um contrato, o banco arquiva junto:
--   - as demandas do contrato que estavam ativas;
--   - as tarefas ativas ligadas ao contrato ou a qualquer demanda dele (#283: a tarefa pode ter várias), desde que não tenham
--     outra ligação ativa: outro contrato não arquivado, outra demanda não arquivada (de outro contrato ou sem contrato) ou um
--     processo não arquivado. Essas continuam ativas, porque ainda servem ao restante (decisão do dono, 22/11).
--   Ao desarquivar o contrato, voltam só as demandas e as tarefas que foram arquivadas junto com ele. O que já estava arquivado
--   antes continua arquivado.
--   Mover o contrato para a coluna Encerrado não mexe em nada: só a mudança de arquivado_em dispara o gatilho.
--
--   A marca "arquivado junto com o contrato" fica numa tabela própria, privado.arquivados_com_contrato, e não numa coluna das
--   demandas e tarefas: assim o histórico do cartão não ganha uma linha com um código interno, e a tela não precisa saber dela.
--   A marca some quando a demanda ou a tarefa é arquivada ou desarquivada sozinha (pelo cartão): se a pessoa desarquivar e arquivar
--   de novo de propósito, desarquivar o contrato não a traz de volta.
--
--   Demanda contínua (#313, feita em paralelo): ela nunca é arquivada. A coluna demandas.continua ainda pode não existir quando esta
--   migração roda, por isso ela é lida por to_jsonb (que dá nulo sem a coluna) em privado.demanda_continua(). A contínua também não
--   conta como "outra ligação ativa" da tarefa: ela só agrupa as tarefas sem demanda, e a tarefa do contrato arquivado sai com ele.
--   Na junção com a #313 (lote 9), 20261123030754_contrato_cascata_com_a_continua.sql passou a ler a coluna real em
--   privado.demanda_continua(), depois de a #313 criá-la.
--
--   O gatilho roda como sistema: quem arquiva o contrato arquiva junto demandas e tarefas que talvez não pudesse arquivar sozinho.
--   É o que a tarefa pede. O histórico e a auditoria de cada item registram o arquivamento, como se fosse feito pela pessoa.
--
-- Só acrescenta (uma tabela no esquema privado, funções e gatilhos novos). A versão anterior do site continua funcionando: ela grava
-- arquivado_em no contrato como antes, e o banco faz a cascata por ela.
-- =====================================================================

-- 1. A marca: o que cada contrato arquivou junto. Só o banco lê e grava (o esquema privado não aparece na API).
create table privado.arquivados_com_contrato (
  contrato_id   uuid not null references public.contratos on delete cascade,
  escritorio_id uuid not null references public.escritorios on delete cascade,
  demanda_id    uuid references public.demandas on delete cascade,
  tarefa_id     uuid references public.tarefas on delete cascade,
  constraint arquivados_com_contrato_um_item check (num_nonnulls(demanda_id, tarefa_id) = 1)
);
create unique index arquivados_com_contrato_demanda on privado.arquivados_com_contrato (demanda_id) where demanda_id is not null;
create unique index arquivados_com_contrato_tarefa on privado.arquivados_com_contrato (tarefa_id) where tarefa_id is not null;
create index arquivados_com_contrato_contrato on privado.arquivados_com_contrato (contrato_id);
create index arquivados_com_contrato_escritorio on privado.arquivados_com_contrato (escritorio_id);
-- Ninguém lê nem grava pela tela; se um dia ficar visível, cada escritório vê só as suas linhas.
alter table privado.arquivados_com_contrato enable row level security;
revoke all on privado.arquivados_com_contrato from public, anon, authenticated;
create policy leitura on privado.arquivados_com_contrato for select to authenticated
  using (escritorio_id = (select privado.meu_escritorio()));

-- 2. A demanda contínua (#313) nunca é arquivada junto. Lida por to_jsonb: sem a coluna, nenhuma demanda é contínua.
create function privado.demanda_continua(d public.demandas) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce((to_jsonb(d) ->> 'continua')::boolean, false)
$$;
revoke execute on function privado.demanda_continua(public.demandas) from public, anon, authenticated;

-- 3. O gatilho do contrato: arquiva ou desarquiva em cascata quando arquivado_em muda de vazio para preenchido, ou ao contrário.
create function privado.contrato_arquiva_em_cascata() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  dem uuid[];   -- as demandas do contrato (todas, mesmo as já arquivadas: as tarefas delas também saem com o contrato)
  arq uuid[];   -- as demandas (e depois as tarefas) que este arquivamento arquiva
begin
  if old.arquivado_em is null and new.arquivado_em is not null then
    select coalesce(array_agg(d.id), '{}'),
           coalesce(array_agg(d.id) filter (where d.arquivado_em is null), '{}')
      into dem, arq
      from public.demandas d
     where d.contrato_id = new.id and d.escritorio_id = new.escritorio_id and not privado.demanda_continua(d);

    update public.demandas set arquivado_em = new.arquivado_em, arquivado_por = new.arquivado_por where id = any(arq);
    insert into privado.arquivados_com_contrato (contrato_id, escritorio_id, demanda_id)
    select new.id, new.escritorio_id, x from unnest(arq) as x;

    -- As tarefas ativas do contrato ou das demandas dele, sem outra ligação ativa. As demandas do contrato já estão arquivadas
    -- aqui (menos a contínua, que não conta), então "outra demanda ativa" é de outro contrato ou sem contrato.
    -- A marca é gravada num comando à parte: os gatilhos "depois" das tarefas rodam no fim do comando que as muda, e o que apaga
    -- a marca (abaixo) a apagaria se ela fosse gravada no mesmo comando.
    with sai as (
      update public.tarefas t set arquivado_em = new.arquivado_em, arquivado_por = new.arquivado_por
       where t.escritorio_id = new.escritorio_id and t.arquivado_em is null
         and (new.id = any(t.contrato_ids) or t.contrato_id = new.id or t.demanda_ids && dem or t.demanda_id = any(dem))
         and not exists (select 1 from public.contratos k
                          where k.id = any(t.contrato_ids || t.contrato_id) and k.id <> new.id and k.arquivado_em is null)
         and not exists (select 1 from public.demandas d
                          where d.id = any(t.demanda_ids || t.demanda_id) and d.arquivado_em is null and not privado.demanda_continua(d))
         and not exists (select 1 from public.processos p where p.id = t.processo_id and p.arquivado_em is null)
      returning t.id
    )
    select coalesce(array_agg(sai.id), '{}') into arq from sai;
    insert into privado.arquivados_com_contrato (contrato_id, escritorio_id, tarefa_id)
    select new.id, new.escritorio_id, x from unnest(arq) as x;

  elsif old.arquivado_em is not null and new.arquivado_em is null then
    -- Voltam só os que têm a marca deste contrato. Desarquivar apaga a marca (gatilho do item, abaixo).
    update public.demandas set arquivado_em = null, arquivado_por = null
     where id in (select demanda_id from privado.arquivados_com_contrato where contrato_id = new.id and demanda_id is not null);
    update public.tarefas set arquivado_em = null, arquivado_por = null
     where id in (select tarefa_id from privado.arquivados_com_contrato where contrato_id = new.id and tarefa_id is not null);
    delete from privado.arquivados_com_contrato where contrato_id = new.id;
  end if;
  return null;
end $$;
revoke execute on function privado.contrato_arquiva_em_cascata() from public, anon, authenticated;
create trigger arquiva_em_cascata after update of arquivado_em on public.contratos
  for each row when (old.arquivado_em is distinct from new.arquivado_em) execute function privado.contrato_arquiva_em_cascata();

-- 4. A demanda ou a tarefa arquivada ou desarquivada sozinha perde a marca. Na cascata, a marca é gravada depois de arquivar, e
--    desarquivar pelo contrato também a apaga: os dois caminhos acabam certos.
create function privado.esquecer_arquivado_com_contrato() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from privado.arquivados_com_contrato where demanda_id = new.id or tarefa_id = new.id;
  return null;
end $$;
revoke execute on function privado.esquecer_arquivado_com_contrato() from public, anon, authenticated;
create trigger esquecer_arquivado_com_contrato after update of arquivado_em on public.demandas
  for each row when (old.arquivado_em is distinct from new.arquivado_em) execute function privado.esquecer_arquivado_com_contrato();
create trigger esquecer_arquivado_com_contrato after update of arquivado_em on public.tarefas
  for each row when (old.arquivado_em is distinct from new.arquivado_em) execute function privado.esquecer_arquivado_com_contrato();
