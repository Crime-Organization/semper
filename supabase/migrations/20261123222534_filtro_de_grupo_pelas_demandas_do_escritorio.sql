-- =====================================================================
-- O filtro "Grupo da equipe" trata a demanda comum do grupo como a contínua dele (#416, resposta 2 do dono de 23/11)
--   Em 20261123202316_grupo_com_demanda_continua.sql, os ids das contínuas pedidas vêm de privado.continuas_do_filtro, que não
--   passa pelas regras de leitura das demandas: quem está fora do grupo X e numa tarefa da contínua de X a vê ao filtrar por X.
--   Mas a parte das demandas comuns do grupo ainda lia public.demandas como quem chama: quem está numa tarefa de uma demanda do
--   grupo X, sem ver essa demanda (fora do grupo e da demanda, responsável só pela tarefa), não a via ao filtrar por X. O banco
--   fictício já a mostrava. Agora as duas partes usam ids que não passam pelas regras de leitura das demandas, só do escritório
--   de quem está logado. A função das tarefas continua rodando como quem chama: o filtro só escolhe entre as tarefas que a pessoa
--   já vê. Quem vê o quê continua igual (a demanda do grupo continua escondida de quem não a via).
--
-- Só acrescenta: uma função nova, e public.tarefas_do_filtro_de_grupo com a mesma assinatura e o mesmo resultado para quem vê as
-- demandas do grupo. public.tarefas_dos_grupos (da versão anterior do site) chama esta e segue funcionando.
-- =====================================================================

-- 1. Os ids das demandas que o filtro pede: as que têm um dos grupos e as contínuas deles (e a Geral, com p_geral). Só ids, só do
--    escritório de quem está logado, como privado.continuas_do_filtro.
create function privado.demandas_do_filtro(p_grupos uuid[], p_geral boolean) returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(d.id order by d.id), '{}') from public.demandas d
  where d.escritorio_id = privado.meu_escritorio()
    and (d.grupos && coalesce(p_grupos, '{}') or d.id = any (privado.continuas_do_filtro(p_grupos, p_geral)))
$$;
revoke execute on function privado.demandas_do_filtro(uuid[], boolean) from public, anon;
grant execute on function privado.demandas_do_filtro(uuid[], boolean) to authenticated;

-- 2. As tarefas do filtro: as que têm um dos grupos e as das demandas pedidas. Roda como quem chama: valem as regras de leitura
--    das tarefas.
CREATE OR REPLACE FUNCTION public.tarefas_do_filtro_de_grupo(p_grupos uuid[], p_geral boolean)
 RETURNS SETOF tarefas
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with d as (select privado.demandas_do_filtro(p_grupos, p_geral) as ids)
  select t.* from public.tarefas t, d
  where t.grupos && p_grupos
     or t.demanda_id = any (d.ids)
     or t.demanda_ids && d.ids
$function$;
