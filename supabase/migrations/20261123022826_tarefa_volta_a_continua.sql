-- =====================================================================
-- Tarefa: o Desfazer de ligá-la a uma demanda a devolve à contínua, mesmo para quem não está no grupo dela (#313, correção da parte C)
--   Ao ser ligada a uma demanda de verdade, a tarefa avulsa sai da contínua; o Desfazer a devolve. Como a contínua já não estava na
--   tarefa, o banco conferia de novo se quem desfaz usa aquela contínua (está no grupo dela ou é administrador), e quem altera a
--   tarefa sem estar no grupo (por exemplo, o responsável que é de outro núcleo) recebia "Demanda não encontrada neste escritório."
--   Agora a volta à contínua é aceita: a tarefa que não estava em nenhuma contínua e fica só em contínuas (sem nenhuma demanda de
--   verdade), do mesmo escritório. A contínua não abre a tarefa a ninguém (estou_na_tarefa passa por cima dela), então não há o que
--   proteger. A tarefa nova e a troca de uma contínua por outra continuam pedindo quem usa a contínua. O mesmo de voltaAContinua em
--   app/src/regras/demandaContinua.ts.
--
-- Só acrescenta: troca o corpo de uma função (a de 20261123003418_demanda_continua.sql, com a condição a mais). A versão anterior do
-- site continua funcionando: só é recusada menos.
-- =====================================================================

CREATE OR REPLACE FUNCTION privado.ligacoes_da_tarefa()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v uuid[] := '{}'; x uuid; d public.demandas; antes_d uuid[] := '{}'; antes_k uuid[] := '{}';
  v_volta boolean := false;
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

  -- A volta à contínua (o Desfazer de ligar a tarefa a uma demanda): a tarefa não estava em nenhuma contínua e fica só em contínuas
  -- do escritório. Quem a altera pode fazê-la mesmo sem usar aquela contínua (#313).
  v_volta := tg_op = 'UPDATE' and new.demanda_ids is distinct from antes_d and coalesce(cardinality(new.demanda_ids), 0) > 0
    and not exists (select 1 from public.demandas dd where dd.id = any(antes_d) and dd.continua)
    and not exists (select 1 from unnest(new.demanda_ids) as u(id)
                    where u.id is not null and not exists (select 1 from public.demandas dd where dd.id = u.id and dd.escritorio_id = new.escritorio_id and dd.continua));

  foreach x in array new.demanda_ids loop
    continue when x is null or x = any(v);
    if not x = any(antes_d) then
      select * into d from public.demandas where id = x and escritorio_id = new.escritorio_id;
      if d.id is null or (auth.uid() is not null
          and not privado.estou_na_demanda(d.escritorio_id, d.criado_por, d.responsavel_id, d.colaboradores, d.grupos)
          and not (d.continua and (v_volta or privado.uso_a_continua(d.escritorio_id, d.continua_grupo_id)))) then
        raise exception 'Demanda não encontrada neste escritório.';
      end if;
    end if;
    v := v || x;
  end loop;
  -- A tarefa que ganha uma demanda de verdade deixa de ser avulsa: sai da contínua (#313).
  if exists (select 1 from public.demandas dd where dd.id = any(v) and not dd.continua) then
    v := array(select u.id from unnest(v) with ordinality as u(id, i)
               where not exists (select 1 from public.demandas dd where dd.id = u.id and dd.continua) order by u.i);
  end if;
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
end $function$;
